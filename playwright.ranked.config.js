import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-ranked',
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4183', browserName: 'chromium', viewport: { width: 1280, height: 800 } },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4183 --strictPort',
    url: 'http://127.0.0.1:4183',
    reuseExistingServer: false,
    env: {
      VITE_RUN_API_BASE_URL: 'http://127.0.0.1:4183/v1',
      VITE_LEADERBOARD_API_BASE_URL: 'http://127.0.0.1:4183/v1',
    },
    timeout: 30_000,
  },
});
