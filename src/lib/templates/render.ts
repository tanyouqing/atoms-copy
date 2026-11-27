import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { TemplateId } from "./registry";
import { TEMPLATE_SCHEMAS, type LedgerConfig } from "./schemas";
import { buildThemeHead, type ThemeInput } from "./themes";

const TEMPLATES_DIR = path.join(process.cwd(), "templates");
const cache = new Map<string, string>();

function readCached(rel: string): string {
  let text = cache.get(rel);
  if (text === undefined) {
    text = fs.readFileSync(path.join(TEMPLATES_DIR, rel), "utf8");
    cache.set(rel, text);
  }
  return text;
}

/** 模板契约原文（§4.0 共享类型 + 该模板类型），用于配置提示词的 {{CONTRACT}}。 */
export function loadContract(id: TemplateId): string {
  return `${readCached("_shared/contract-base.ts.txt").trimEnd()}\n\n${readCached(`${id}/contract.ts.txt`).trimEnd()}\n`;
}

/** example.json 原文，用于配置提示词的 {{EXAMPLE}}、LLM_MOCK 和 dev 画廊。 */
export function loadExampleText(id: TemplateId): string {
  return readCached(`${id}/example.json`);
}

export function loadExample(id: TemplateId): unknown {
  return JSON.parse(loadExampleText(id));
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** JSON 放进 <script type="application/json">：转义 `<` 防止提前闭合，转义 U+2028/2029。 */
export function serializeConfig(config: unknown): string {
  return JSON.stringify(config).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/**
 * docs/08 §4.2：seedEntries 中早于 60 天前的日期平移到最近 30 天内（保持"距今天数"对 30 取模），
 * 让用户打开记账本时本月能看到数据。这是唯一允许在渲染时改写配置的逻辑。
 */
export function shiftLedgerDates(config: LedgerConfig, now: Date = new Date()): LedgerConfig {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const DAY = 86_400_000;
  return {
    ...config,
    seedEntries: config.seedEntries.map((e) => {
      const ageDays = Math.round((today.getTime() - parseYmd(e.date).getTime()) / DAY);
      if (ageDays <= 60) return e;
      return { ...e, date: ymd(new Date(today.getTime() - (ageDays % 30) * DAY)) };
    }),
  };
}

export function renderTemplate(id: TemplateId, config: unknown, now: Date = new Date()): string {
  let parsed: unknown = TEMPLATE_SCHEMAS[id].parse(config);
  if (id === "ledger") parsed = shiftLedgerDates(parsed as LedgerConfig, now);
  const { title, theme } = parsed as { title: string; theme: ThemeInput };
  const html = readCached(`${id}/template.html`);
  // 主题样式是一行，替换后模板行号不变
  return html.split("__APP_THEME__").join(buildThemeHead(theme)).split("__APP_TITLE__").join(escapeHtml(title)).split("__APP_CONFIG__").join(serializeConfig(parsed));
}
