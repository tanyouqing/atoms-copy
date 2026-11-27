/**
 * token 用量与估算费用汇总（docs/07 §13）。读取 DATABASE_PATH（默认 ./data/app.db）中的 llm_calls。
 * 用法：npm run usage
 */
import path from "node:path";
import Database from "better-sqlite3";

const file = process.env.DATABASE_PATH || "./data/app.db";
const PRICE_IN = Number(process.env.LLM_PRICE_INPUT_PER_M || 0.15);
const PRICE_CACHED = Number(process.env.LLM_PRICE_CACHED_INPUT_PER_M || 0.003);
const PRICE_OUT = Number(process.env.LLM_PRICE_OUTPUT_PER_M || 0.6);

interface Row {
  step: string;
  calls: number;
  ok: number;
  input: number;
  cached: number;
  output: number;
  avg_ms: number;
}

const db = new Database(path.resolve(file), { readonly: true, fileMustExist: true });
const rows = db
  .prepare(
    `select step, count(*) calls, sum(ok) ok, coalesce(sum(input_tokens),0) input, coalesce(sum(cached_input_tokens),0) cached,
            coalesce(sum(output_tokens),0) output, avg(duration_ms) avg_ms from llm_calls where model != 'mock' group by step order by step`,
  )
  .all() as Row[];
const turns = (db.prepare(`select count(distinct turn_id) n from llm_calls where model != 'mock'`).get() as { n: number }).n;

const cost = (r: Pick<Row, "input" | "cached" | "output">) => ((r.input - r.cached) * PRICE_IN + r.cached * PRICE_CACHED + r.output * PRICE_OUT) / 1e6;
const total = rows.reduce((a, r) => ({ input: a.input + r.input, cached: a.cached + r.cached, output: a.output + r.output }), { input: 0, cached: 0, output: 0 });

console.log(`数据库：${file}`);
console.table(
  rows.map((r) => ({ 步骤: r.step, 调用: r.calls, 成功: r.ok, 输入token: r.input, 缓存命中: r.cached, 输出token: r.output, 平均耗时s: (r.avg_ms / 1000).toFixed(1), 费用USD: cost(r).toFixed(5) })),
);
console.log(`合计：${turns} 轮，输入 ${total.input} token（缓存 ${total.cached}），输出 ${total.output} token，约 $${cost(total).toFixed(4)}`);
if (turns) console.log(`平均每轮：$${(cost(total) / turns).toFixed(5)}（按非高峰价 输入 $${PRICE_IN}/M、输出 $${PRICE_OUT}/M 估算）`);
