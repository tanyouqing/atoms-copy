// E2E 用服务：删除测试库 → next build（若无产物或设置 E2E_BUILD=1）→ 启动 standalone。
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const db = path.resolve(process.env.DATABASE_PATH || "./data/test.db");
for (const f of [db, `${db}-wal`, `${db}-shm`]) fs.rmSync(f, { force: true });
if (process.env.E2E_BUILD === "1" || !fs.existsSync(".next/standalone/server.js")) execSync("npm run build", { stdio: "inherit" });
const child = spawn(process.execPath, [".next/standalone/server.js"], { stdio: "inherit", env: { ...process.env, DATABASE_PATH: db, HOSTNAME: "127.0.0.1" } });
const stop = () => child.kill("SIGTERM");
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
child.on("exit", (code) => process.exit(code ?? 0));
