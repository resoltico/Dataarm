import { defineConfig, devices } from '@playwright/test';
import {
  managedPlaywrightReportRoot,
  managedPlaywrightTestResultsRoot,
} from './scripts/lib/artifact-roots.mjs';

if (process.env.NO_COLOR) {
  delete process.env.NO_COLOR;
}

if (process.env.FORCE_COLOR) {
  delete process.env.FORCE_COLOR;
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  outputDir: managedPlaywrightTestResultsRoot(),
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never', outputFolder: managedPlaywrightReportRoot() }]],
  ...(process.env.CI ? { workers: 1 } : {}),

  use: {
    baseURL: 'http://localhost:1420',
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
