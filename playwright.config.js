// Runs every component test and the end-to-end checks in Chromium, Firefox and WebKit.
// Locally, PW_CHROMIUM_CHANNEL=chrome uses an installed Chrome instead of Playwright's Chromium.
const { defineConfig, devices } = require('@playwright/test')

module.exports = defineConfig({
  testDir: '.',
  testMatch: ['src/**/*.test.js', 'test/e2e/**/*.spec.js'],
  fullyParallel: true,
  webServer: {
    command: 'node test/e2e/serve.js',
    url: 'http://127.0.0.1:4173/src/components/button/index.html',
    reuseExistingServer: !process.env.CI,
  },
  reporter: process.env.CI ? 'github' : 'list',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHROMIUM_CHANNEL || undefined } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
