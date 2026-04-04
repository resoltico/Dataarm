import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  ...(process.env.CI ? { workers: 1 } : {}),

  // Base setup explicitly mapping automated headless overrides
  // ensuring the runner operates securely apart from real user settings
  use: {
    baseURL: 'http://localhost:1420',
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
    // Mock the host dependencies explicitly when CI drops in headless variables
    // process.env.FFHN_DESKTOP_FFHN_BIN will override the Sidecar resolution natively
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

  // Launch Tauri / Vite specifically for executing local automated bounds
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
