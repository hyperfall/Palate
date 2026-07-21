import { defineConfig, devices } from '@playwright/test'

import 'dotenv/config'

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // CHROME_PATH lets a machine with a partial Playwright browser download
        // point at a working Chromium instead of failing to launch.
        launchOptions: process.env.CHROME_PATH
          ? { executablePath: process.env.CHROME_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    reuseExistingServer: true,
    url: BASE_URL,
    timeout: 120_000,
  },
})
