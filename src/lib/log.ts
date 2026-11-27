/** 单行 JSON 日志（docs/04 §8）。不记录 API Key 与提示词全文。 */
type Level = "info" | "warn" | "error";

function write(level: Level, event: string, fields?: Record<string, unknown>) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields?: Record<string, unknown>) => write("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => write("error", event, fields),
};

/** 用户输入只记前 80 个字符。 */
export const clip = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n)}…` : s);
