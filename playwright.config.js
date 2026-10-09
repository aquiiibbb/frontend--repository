import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 120000,
  workers: 1, // Single worker so tests run sequentially in 1 browser window
  webServer: {
    command: 'npx vite --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    headless: false, // Real Chrome browser window on screen
    viewport: { width: 1280, height: 800 },
    actionTimeout: 15000,
    ignoreHTTPSErrors: true,
    launchOptions: {
      slowMo: 1500, // 1.5 second delay between actions
    },
  },
});
