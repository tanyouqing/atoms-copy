import "server-only";
import { z } from "zod";

const num = (def: number) => z.coerce.number().int().positive().default(def);
const price = (def: number) => z.coerce.number().nonnegative().default(def);

const EnvSchema = z
  .object({
    LLM_MOCK: z.enum(["0", "1"]).default("0"),
    DEEPSEEK_API_KEY: z.string().trim().optional(),
    DEEPSEEK_BASE_URL: z.string().url().default("https://api.deepseek.com"),
    DEEPSEEK_MODEL: z.string().trim().min(1).default("deepseek-flash"),
    DATABASE_PATH: z.string().trim().min(1).default("./data/app.db"),
    RATE_LIMIT_VISITOR_PER_DAY: num(40),
    RATE_LIMIT_IP_PER_DAY: num(80),
    RATE_LIMIT_GLOBAL_PER_DAY: num(1000),
    LLM_PRICE_INPUT_PER_M: price(0.15),
    LLM_PRICE_CACHED_INPUT_PER_M: price(0.003),
    LLM_PRICE_OUTPUT_PER_M: price(0.6),
  })
  .refine((e) => e.LLM_MOCK === "1" || !!e.DEEPSEEK_API_KEY, {
    message: "缺少 DEEPSEEK_API_KEY（或设置 LLM_MOCK=1 使用模拟模型）",
    path: ["DEEPSEEK_API_KEY"],
  });

export type Env = z.infer<typeof EnvSchema> & { mock: boolean };

let cached: Env | null = null;

/** 惰性解析环境变量（构建阶段不触发）。校验失败抛出列出全部问题的错误。 */
export function getEnv(): Env {
  if (cached) return cached;
  const raw = Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v]));
  const r = EnvSchema.safeParse(raw);
  if (!r.success) {
    const lines = r.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`环境变量配置有误：\n${lines}\n请参考 .env.example。`);
  }
  cached = { ...r.data, mock: r.data.LLM_MOCK === "1" };
  return cached;
}

/** 仅测试使用：清除缓存以便重新读取 process.env。 */
export function resetEnvForTests() {
  cached = null;
}
