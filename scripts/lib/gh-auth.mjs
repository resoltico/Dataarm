import { spawnSync } from 'node:child_process';

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

export function ghEnvironment() {
  if (process.env.GH_TOKEN) {
    return process.env;
  }

  const tokenResult = spawnSync('gh', ['auth', 'token'], {
    encoding: 'utf8',
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (tokenResult.error) {
    throw tokenResult.error;
  }

  if (tokenResult.status !== 0) {
    const reason = tokenResult.stderr.trim() || tokenResult.stdout.trim() || 'gh auth token failed';
    fail(`GitHub authentication is required: ${reason}`);
  }

  const token = tokenResult.stdout.trim();
  if (!token) {
    fail('GitHub authentication is required: gh auth token returned an empty token');
  }

  return {
    ...process.env,
    GH_TOKEN: token,
  };
}
