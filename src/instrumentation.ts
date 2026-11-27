/** 服务启动时校验环境变量：缺少 Key 且非 mock 模式时直接报错退出（T0.2）。 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getEnv } = await import("@/lib/env");
  try {
    const env = getEnv();
    const { log } = await import("@/lib/log");
    log.info("server.start", { model: env.DEEPSEEK_MODEL, mock: env.mock, db: env.DATABASE_PATH });
  } catch (e) {
    console.error(String(e instanceof Error ? e.message : e));
    process.exit(1);
  }
}
