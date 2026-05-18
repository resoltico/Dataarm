import { spawn } from 'node:child_process';
import readline from 'node:readline';
import path from 'node:path';

import { repoRoot } from '../lib/artifact-roots.mjs';

function bridgeCommand() {
  return [
    'cargo',
    [
      'run',
      '--quiet',
      '--manifest-path',
      path.join(repoRoot, 'src-tauri', 'Cargo.toml'),
      '--example',
      'browser_workbench_bridge',
      '--',
    ],
  ];
}

export function createRustWorkbenchBridge() {
  let child = null;
  let closed = false;
  let active = null;
  const pending = [];

  function rejectAll(message) {
    const error = new Error(message);
    if (active) {
      active.reject(error);
      active = null;
    }
    while (pending.length > 0) {
      const next = pending.shift();
      next.reject(error);
    }
  }

  function flush() {
    if (closed || active || pending.length === 0) {
      return;
    }

    ensureStarted();
    active = pending.shift();
    const payload =
      active.params == null
        ? { method: active.method }
        : { method: active.method, params: active.params };
    child.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  function ensureStarted() {
    if (child) {
      return;
    }

    const [command, args] = bridgeCommand();
    child = spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const stdout = readline.createInterface({ input: child.stdout });
    stdout.on('line', (line) => {
      if (!active) {
        return;
      }

      let decoded;
      try {
        decoded = JSON.parse(line);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : `Failed to decode bridge response ${String(error)}`;
        active.reject(new Error(message));
        active = null;
        flush();
        return;
      }

      const current = active;
      active = null;
      if (decoded.ok) {
        current.resolve(decoded.result);
      } else {
        current.reject(new Error(decoded.error ?? 'Browser workbench bridge request failed.'));
      }
      flush();
    });

    let stderrBuffer = '';
    child.stderr.on('data', (chunk) => {
      stderrBuffer += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      rejectAll(`Browser workbench bridge failed: ${error.message}`);
    });

    child.on('exit', (code, signal) => {
      child = null;
      if (closed) {
        return;
      }

      const reason = signal
        ? `signal ${signal}`
        : `exit code ${String(code)}${stderrBuffer.trim() ? `\n${stderrBuffer.trim()}` : ''}`;
      rejectAll(`Browser workbench bridge exited unexpectedly with ${reason}.`);
    });
  }

  return {
    async request(method, params) {
      if (closed) {
        throw new Error('Browser workbench bridge is closed.');
      }

      return new Promise((resolve, reject) => {
        pending.push({ method, params, resolve, reject });
        flush();
      });
    },
    close() {
      closed = true;
      rejectAll('Browser workbench bridge was closed.');
      if (child) {
        child.kill();
        child = null;
      }
    },
  };
}
