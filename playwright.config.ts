import { defineConfig, devices } from "@playwright/test";

/** E2E 一律在 LLM_MOCK=1 下运行，使用独立数据库 ./data/test.db（启动前删除）。 */
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "off", ...devices["Desktop Chrome"], viewport: { width: 1400, height: 900 } },
  webServer: {
    command: `node scripts/e2e-server.mjs`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: { LLM_MOCK: "1", PORT: String(PORT), DATABASE_PATH: "./data/test.db", NODE_ENV: "production" },
  },
});
