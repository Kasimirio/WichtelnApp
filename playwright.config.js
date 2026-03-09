const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined
        }
      }
    }
  ],
  use: {
    baseURL: 'http://localhost:3948',
    headless: true
  },
  webServer: {
    command: 'python3 -m http.server 3948',
    port: 3948,
    reuseExistingServer: true
  }
});
