import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import {
  BROWSER_WORKBENCH_MODE,
  BROWSER_WORKBENCH_RPC_PATH,
  BROWSER_WORKBENCH_SESSION_COOKIE,
  BROWSER_WORKBENCH_SESSION_HEADER,
} from './constants.mjs';
import { ensureBrowserWorkbenchFixtures, prepareBrowserWorkbenchTemplate } from './fixtures.mjs';
import { recordTargetRunNotification, recordWorkspaceRunNotification } from './notifications.mjs';
import { createRustWorkbenchBridge } from './rust-bridge.mjs';

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString('utf8');
    });
    req.on('end', () => {
      try {
        resolve(body.length === 0 ? {} : JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function parseCookies(header) {
  if (typeof header !== 'string' || header.trim().length === 0) {
    return new Map();
  }

  return new Map(
    header
      .split(';')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0)
      .map((segment) => {
        const separator = segment.indexOf('=');
        if (separator < 0) {
          return [segment, ''];
        }
        return [segment.slice(0, separator), decodeURIComponent(segment.slice(separator + 1))];
      }),
  );
}

function acceptsHtml(req) {
  return typeof req.headers.accept === 'string' && req.headers.accept.includes('text/html');
}

function resolveSessionIdFromRequest(payloadSessionId, headerSessionId, cookies) {
  if (typeof payloadSessionId === 'string' && payloadSessionId.trim().length > 0) {
    return payloadSessionId;
  }
  if (Array.isArray(headerSessionId) && headerSessionId.length > 0) {
    return headerSessionId[0];
  }
  if (typeof headerSessionId === 'string' && headerSessionId.trim().length > 0) {
    return headerSessionId;
  }
  return cookies.get(BROWSER_WORKBENCH_SESSION_COOKIE);
}

function workspaceSourceForPath(session, workspacePath) {
  return workspacePath === session.paths.demoRoot ? 'demo' : 'user';
}

function workspaceName(workspacePath) {
  const segments = workspacePath.split('/').filter(Boolean);
  return segments.at(-1) ?? 'watch-root';
}

function createServerState(paths) {
  return {
    paths,
    currentWorkspacePath: paths.demoRoot,
    recentWorkspaces: [],
    notificationSequence: 0,
    notificationCenter: {
      settings: {
        notifyWhen: 'changes_and_errors',
        delivery: 'in_app',
      },
      permissionState: 'unknown',
      items: [],
    },
  };
}

function cloneNotificationCenter(notificationCenter) {
  return deepClone(notificationCenter);
}

function recentsWithHead(state, workspacePath) {
  const next = {
    workspaceName: workspaceName(workspacePath),
    workspacePath,
    workspaceSource: workspaceSourceForPath(state, workspacePath),
    lastOpenedAt: new Date().toISOString(),
  };
  state.recentWorkspaces = [
    next,
    ...state.recentWorkspaces.filter((entry) => entry.workspacePath !== workspacePath),
  ].slice(0, 10);
}

function workspaceSnapshot(state, inventory) {
  return {
    summary: inventory.summary,
    recentWorkspaces: deepClone(state.recentWorkspaces),
    notificationCenter: cloneNotificationCenter(state.notificationCenter),
    targets: inventory.targets,
  };
}

function currentWorkspacePath(state) {
  return state.currentWorkspacePath ?? state.paths.demoRoot;
}

function resolveTargetDirectory(workspacePath, directoryName) {
  const workspaceRoot = path.resolve(workspacePath);
  const targetRoot = path.resolve(workspaceRoot, directoryName);
  if (path.dirname(targetRoot) !== workspaceRoot) {
    throw new Error('Target directory must name a direct child of the active workspace.');
  }
  return targetRoot;
}

async function ensureInventory(bridge, session, workspacePath) {
  return bridge.request('inventory_workspace', {
    workspace_path: workspacePath,
    workspace_source: workspaceSourceForPath(session, workspacePath),
  });
}

export function dataarmBrowserWorkbenchPlugin() {
  if (process.env.VITE_DATAARM_BROWSER_BACKEND !== BROWSER_WORKBENCH_MODE) {
    return null;
  }

  const bridge = createRustWorkbenchBridge();
  const sessions = new Map();
  let templateReadyPromise = null;

  function ensureTemplateReady() {
    templateReadyPromise ??= prepareBrowserWorkbenchTemplate(bridge);
    return templateReadyPromise;
  }

  async function ensureSession(sessionId) {
    await ensureTemplateReady();

    const existing = sessions.get(sessionId);
    if (existing) {
      if (existing.initialized) {
        return existing;
      }
      await existing.initializePromise;
      return existing;
    }

    const session = {
      paths: null,
      state: null,
      initialized: false,
      initializePromise: null,
    };
    session.initializePromise = (async () => {
      session.paths = await ensureBrowserWorkbenchFixtures(bridge, sessionId);
      session.state = createServerState(session.paths);
      recentsWithHead(session.state, session.paths.demoRoot);
      session.state.currentWorkspacePath = session.paths.demoRoot;
      session.initialized = true;
    })();
    sessions.set(sessionId, session);
    await session.initializePromise;
    return session;
  }

  async function handle(sessionId, method, params) {
    const session = await ensureSession(sessionId);
    const state = session.state;

    switch (method) {
      case 'bootstrap': {
        const inventory = await ensureInventory(bridge, session, currentWorkspacePath(state));
        return {
          app: await bridge.request('app_info'),
          workspace: workspaceSnapshot(state, inventory),
        };
      }
      case 'open_workspace': {
        const workspacePath = params?.workspacePath ?? session.paths.demoRoot;
        const inventory = await ensureInventory(bridge, session, workspacePath);
        state.currentWorkspacePath = workspacePath;
        recentsWithHead(state, workspacePath);
        return workspaceSnapshot(state, inventory);
      }
      case 'refresh_workspace': {
        const inventory = await ensureInventory(bridge, session, currentWorkspacePath(state));
        return workspaceSnapshot(state, inventory);
      }
      case 'create_workspace': {
        const workspacePath = params?.workspacePath;
        if (typeof workspacePath !== 'string' || workspacePath.trim().length === 0) {
          throw new Error('Workspace path is required.');
        }
        fs.mkdirSync(workspacePath, { recursive: true });
        const inventory = await ensureInventory(bridge, session, workspacePath);
        state.currentWorkspacePath = workspacePath;
        recentsWithHead(state, workspacePath);
        return workspaceSnapshot(state, inventory);
      }
      case 'read_target':
        return bridge.request('read_target', {
          workspace_path: currentWorkspacePath(state),
          directory_name: params.directoryName,
        });
      case 'get_target_template':
        return bridge.request('get_target_template', { kind: params.kind });
      case 'preview_target':
        return bridge.request('preview_target', { request: params.request });
      case 'save_target': {
        const payload = await bridge.request('save_target', {
          workspace_path: currentWorkspacePath(state),
          request: params.request,
        });
        return {
          workspace: workspaceSnapshot(state, payload.inventory),
          directoryName: payload.directoryName,
        };
      }
      case 'update_notification_settings': {
        state.notificationCenter.settings = deepClone(params.settings);
        const inventory = await ensureInventory(bridge, session, currentWorkspacePath(state));
        return workspaceSnapshot(state, inventory);
      }
      case 'clear_notification_feed': {
        state.notificationCenter.items = [];
        const inventory = await ensureInventory(bridge, session, currentWorkspacePath(state));
        return workspaceSnapshot(state, inventory);
      }
      case 'delete_target': {
        const targetRoot = resolveTargetDirectory(
          currentWorkspacePath(state),
          params.directoryName,
        );
        fs.rmSync(targetRoot, { force: true, recursive: true });
        const inventory = await ensureInventory(bridge, session, currentWorkspacePath(state));
        return workspaceSnapshot(state, inventory);
      }
      case 'run_target': {
        const payload = await bridge.request('run_target', {
          workspace_path: currentWorkspacePath(state),
          directory_name: params.directoryName,
        });
        const target = payload.inventory.targets.find(
          (entry) => entry.directoryName === payload.directoryName,
        );
        const notification =
          target?.displayName == null
            ? null
            : recordTargetRunNotification(
                state,
                payload.inventory.summary.workspaceName,
                target.displayName ?? target.directoryName,
                payload.runReport,
              );
        return {
          workspace: workspaceSnapshot(state, payload.inventory),
          directoryName: payload.directoryName,
          statusReport: payload.statusReport,
          runReport: payload.runReport,
          notification,
        };
      }
      case 'run_workspace': {
        const payload = await bridge.request('run_workspace', {
          workspace_path: currentWorkspacePath(state),
          max_concurrency: params.maxConcurrency ?? null,
        });
        const notification = recordWorkspaceRunNotification(
          state,
          payload.inventory.summary.workspaceName,
          payload.batchReport,
          payload.skippedDirectories,
        );
        return {
          workspace: workspaceSnapshot(state, payload.inventory),
          batchReport: payload.batchReport,
          skippedDirectories: payload.skippedDirectories,
          notification,
        };
      }
      case 'open_workspace_path':
      case 'open_target_path':
        return null;
      default:
        throw new Error(`Unknown browser workbench RPC method ${String(method)}.`);
    }
  }

  return {
    name: 'dataarm-browser-workbench',
    async configureServer(server) {
      await ensureTemplateReady();

      server.middlewares.use(async (req, res, next) => {
        if (
          req.method !== 'GET' ||
          req.url == null ||
          req.url.startsWith(BROWSER_WORKBENCH_RPC_PATH)
        ) {
          next();
          return;
        }
        if (!acceptsHtml(req)) {
          next();
          return;
        }

        try {
          const cookies = parseCookies(req.headers.cookie);
          let sessionId = resolveSessionIdFromRequest(
            null,
            req.headers[BROWSER_WORKBENCH_SESSION_HEADER],
            cookies,
          );
          if (!sessionId) {
            sessionId = randomUUID();
            res.setHeader(
              'Set-Cookie',
              `${BROWSER_WORKBENCH_SESSION_COOKIE}=${encodeURIComponent(
                sessionId,
              )}; Path=/; SameSite=Lax; HttpOnly`,
            );
          }
          await ensureSession(sessionId);
          next();
        } catch (error) {
          next(error);
        }
      });

      server.middlewares.use(BROWSER_WORKBENCH_RPC_PATH, async (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }

        try {
          const payload = await readJson(req);
          const cookies = parseCookies(req.headers.cookie);
          const sessionHeader = req.headers[BROWSER_WORKBENCH_SESSION_HEADER];
          let sessionId = resolveSessionIdFromRequest(payload.sessionId, sessionHeader, cookies);
          if (!sessionId) {
            sessionId = randomUUID();
            res.setHeader(
              'Set-Cookie',
              `${BROWSER_WORKBENCH_SESSION_COOKIE}=${encodeURIComponent(
                sessionId,
              )}; Path=/; SameSite=Lax; HttpOnly`,
            );
          }
          const result = await handle(sessionId, payload.method, payload.params ?? {});
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, result }));
        } catch (error) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      });

      server.httpServer?.once('close', () => {
        bridge.close();
      });
    },
  };
}
