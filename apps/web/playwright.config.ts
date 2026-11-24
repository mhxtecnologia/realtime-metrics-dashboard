import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

// Sobe o servidor WebSocket e o Next.js já compilado (`pnpm build` antes).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @realtime-metrics/server start',
      url: 'http://127.0.0.1:4000/healthz',
      reuseExistingServer: !isCI,
      timeout: 60_000,
      env: { ALLOWED_ORIGINS: 'http://localhost:3000', TICK_MS: '500' },
    },
    {
      command: 'pnpm start',
      url: 'http://localhost:3000',
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],
});
