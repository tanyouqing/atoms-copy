import "server-only";
import fs from "node:fs";
import path from "node:path";
import { isTemplateId, type TemplateId } from "@/lib/templates/registry";
import { loadExample } from "@/lib/templates/render";

/**
 * LLM_MOCK=1 时的固定输出（docs/07 §12）。返回的是"模型原始文本"，
 * 和真实模型走同一套 JSON 提取、zod 校验、补丁应用、静态检查流程。
 */
export type MockCtx =
  | { kind: "pm"; prompt: string; hasCurrent: boolean; currentTemplateId: string | null; currentTheme: string | null }
  | { kind: "config"; templateId: TemplateId; themeColor: string; currentConfig: unknown | null; prompt: string }
  | { kind: "free"; prompt: string }
  | { kind: "patch"; prompt: string }
  | { kind: "fix"; html: string };

const FIXTURES = path.join(process.cwd(), "tests/fixtures/llm");
const fixture = (name: string) => fs.readFileSync(path.join(FIXTURES, name), "utf8");

const isBrokenHard = (p: string) => p.includes("#broken-hard");
const isBroken = (p: string) => p.includes("#broken");

function pickTemplate(p: string): TemplateId {
  if (p.includes("看板")) return "kanban";
  if (p.includes("记账")) return "ledger";
  if (/游戏|翻牌|贪吃蛇/.test(p)) return "game";
  if (p.includes("报名") || p.includes("问卷")) return "form";
  if (p.includes("介绍页") || p.includes("落地页")) return "landing";
  if (p.includes("仪表盘")) return "dashboard";
  if (p.includes("通讯录") || p.includes("书单")) return "crud";
  return "todo";
}

const NAMES: Record<TemplateId, string> = {
  todo: "每日习惯打卡",
  ledger: "家庭记账本",
  form: "活动报名表",
  kanban: "招聘进度看板",
  landing: "咖啡馆主页",
  dashboard: "门店经营看板",
  game: "记忆翻牌",
  crud: "我的书架",
};

function pm(ctx: Extract<MockCtx, { kind: "pm" }>): unknown {
  const p = ctx.prompt;
  const base = { language: "zh-CN", changes: [] as string[] };
  if (isBroken(p)) {
    return { ...base, intent: ctx.hasCurrent ? "regenerate" : "new_app", templateId: null, appName: "番茄专注钟", versionLabel: isBrokenHard(p) ? "番茄钟（难修）" : "番茄钟初版", reply: "好的，我会做一个番茄钟：25 分钟专注、5 分钟休息，带开始、暂停和重置。", features: ["25 分钟专注倒计时", "5 分钟休息", "开始 / 暂停 / 重置"], themeColor: "rose" };
  }
  if (ctx.hasCurrent && /改成绿色|改色|主色/.test(p)) {
    return { ...base, intent: "config_edit", templateId: ctx.currentTemplateId, appName: "每日习惯打卡", versionLabel: "主色改为绿色", reply: "好的，我会把应用的主色改成绿色，其余内容保持不变。", features: ["主色改为绿色"], changes: ["theme.primary 改为 emerald"], themeColor: "emerald" };
  }
  if (ctx.hasCurrent && p.includes("导出")) {
    return { ...base, intent: "code_patch", templateId: ctx.currentTemplateId, appName: "每日习惯打卡", versionLabel: "增加导出按钮", reply: "好的，我会在页面上加一个导出按钮，把数据导出为 JSON 文件。", features: ["导出数据"], changes: ["在页面底部增加一个导出按钮"], themeColor: ctx.currentTheme ?? "indigo" };
  }
  if (ctx.hasCurrent && !/做一个|改成一个/.test(p)) {
    return { ...base, intent: "code_patch", templateId: ctx.currentTemplateId, appName: "每日习惯打卡", versionLabel: "增加导出按钮", reply: "好的，我会按你的要求调整页面。", features: ["按要求调整"], changes: ["在页面底部增加一个导出按钮"], themeColor: ctx.currentTheme ?? "indigo" };
  }
  const t = pickTemplate(p);
  // 模拟 PM 发现模板做不到的功能（如日历视图）：服务端据此改走自由生成
  const unsupported = p.includes("日历") ? ["月历视图"] : [];
  return { ...base, unsupported, intent: ctx.hasCurrent ? "regenerate" : "new_app", templateId: t, appName: NAMES[t], versionLabel: `初版${NAMES[t]}`.slice(0, 16), reply: `好的，我会用"${NAMES[t]}"的思路帮你搭建这个应用，先做出核心功能，你可以继续让我修改。`, features: ["核心功能一应俱全", "数据保存在浏览器", "手机上也能用"], themeColor: t === "todo" ? "indigo" : "violet" };
}

function config(ctx: Extract<MockCtx, { kind: "config" }>): unknown {
  if (ctx.currentConfig && typeof ctx.currentConfig === "object") {
    const cur = ctx.currentConfig as { theme?: Record<string, unknown> };
    return { ...cur, theme: { ...(cur.theme ?? {}), primary: ctx.themeColor } };
  }
  return loadExample(isTemplateId(ctx.templateId) ? ctx.templateId : "todo");
}

export function mockJson(ctx: MockCtx): string {
  if (ctx.kind === "pm") return JSON.stringify(pm(ctx));
  if (ctx.kind === "config") return "```json\n" + JSON.stringify(config(ctx)) + "\n```";
  throw new Error(`mock: ${ctx.kind} 不是 JSON 步骤`);
}

function split(text: string, n: number): string[] {
  const size = Math.ceil(text.length / n);
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

export function mockStream(ctx: MockCtx): string[] {
  if (ctx.kind === "free") {
    const file = isBrokenHard(ctx.prompt) ? "broken-hard.html" : isBroken(ctx.prompt) ? "broken.html" : "free.html";
    return split(fixture(file), 20);
  }
  if (ctx.kind === "patch") return split(fixture("patch.txt"), 4);
  if (ctx.kind === "fix") {
    if (ctx.html.includes("undefinedFunctionCallHard();")) return [fixture("fix-hard.txt")];
    return [fixture("fix.txt")];
  }
  throw new Error(`mock: ${ctx.kind} 不是流式步骤`);
}
