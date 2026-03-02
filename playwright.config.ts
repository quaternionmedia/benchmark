import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: false,
  retries: 0,
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:8347/benchmark/',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Mobile Chrome — used by tests/mobile.spec.ts
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      // Mobile Safari — used by tests/mobile.spec.ts
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  webServer: {
    command: 'vite --port 8347',
    url: 'http://localhost:8347/benchmark/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
