import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    serviceWorkers: "allow",
  },
  projects: [
    {
      name: "mobile-375",
      use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 375, height: 812 } },
    },
    {
      name: "desktop-1440",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  // Production build (the service worker only registers in production) against a separate e2e.db.
  webServer: {
    command: `npm run build && node scripts/reset-db.mjs --quiet && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/categories`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: { DATABASE_URL: "file:./e2e.db" },
  },
});
