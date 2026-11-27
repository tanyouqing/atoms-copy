import "server-only";
import { callJson, streamCode, type CallCtx } from "@/lib/llm/call";
import { AppError } from "@/lib/errors";
import { getTemplateMeta, type TemplateId } from "@/lib/templates/registry";
import { loadContract, loadExampleText, renderTemplate } from "@/lib/templates/render";
import { TEMPLATE_SCHEMAS } from "@/lib/templates/schemas";
import { stripSeedData } from "@/lib/templates/seeds";
import type { RuntimeError } from "@/types/runtime";
import { closeHtml, extractHtml, joinContinuation } from "./extract";
import { applyPatches, describeFailures, parsePatches, summarizePatches, type Patch } from "./patch";
import { buildConfigSystem, buildConfigUserEdit, buildConfigUserNew } from "./prompts/config";
import { buildFixSystem, buildFixUser } from "./prompts/fix";
import { buildContinueUser, buildFreeSystem, buildFreeUserNew, buildFreeUserRewrite } from "./prompts/free";
import { buildPatchRetrySuffix, buildPatchSystem, buildPatchUser } from "./prompts/patch";
import type { PmOutput } from "./schemas";

/** 工程师（Leo）的各个步骤（docs/07 §5–§8）。只负责调用模型与处理输出，不写库。 */

export const TIMEOUTS = { pm: 45_000, config: 45_000, free: 150_000, patch: 150_000, fix: 90_000 } as const;

export interface StepEnv {
  signal: AbortSignal;
  ctx: CallCtx;
  onDelta?: (t: string) => void;
}

const LANG = (l: string) => (l === "en" ? "English" : "简体中文");

// ---------- 模板配置 ----------

export async function generateConfig(env: StepEnv, a: { templateId: TemplateId; pm: PmOutput; prompt: string; currentConfig: unknown | null }) {
  const meta = getTemplateMeta(a.templateId);
  const system = buildConfigSystem({ templateName: meta.name, contract: loadContract(a.templateId), example: loadExampleText(a.templateId), language: LANG(a.pm.language), themeColor: a.pm.themeColor });
  const prompt = a.currentConfig !== null ? buildConfigUserEdit({ currentConfig: a.currentConfig, changes: a.pm.changes, prompt: a.prompt }) : buildConfigUserNew({ appName: a.pm.appName, prompt: a.prompt, features: a.pm.features });
  const raw: unknown = await callJson({
    step: "config",
    schema: TEMPLATE_SCHEMAS[a.templateId],
    system,
    prompt,
    temperature: 0.3,
    maxOutputTokens: 4000,
    timeoutMs: TIMEOUTS.config,
    signal: env.signal,
    ctx: env.ctx,
    mock: { kind: "config", templateId: a.templateId, themeColor: a.pm.themeColor, currentConfig: a.currentConfig, prompt: a.prompt },
  });
  // 新建应用不带示例数据（从空白状态开始）；修改时保留用户已有的配置
  const config = a.currentConfig === null ? stripSeedData(a.templateId, raw) : raw;
  return { config, html: renderTemplate(a.templateId, config) };
}

// ---------- 自由生成（含截断续写） ----------

export async function generateFreeHtml(env: StepEnv, a: { pm: PmOutput; prompt: string; currentHtml?: string }): Promise<string> {
  const system = buildFreeSystem();
  const prompt = a.currentHtml
    ? buildFreeUserRewrite({ currentHtml: a.currentHtml, changes: a.pm.changes, prompt: a.prompt })
    : buildFreeUserNew({ appName: a.pm.appName, language: LANG(a.pm.language), themeColor: a.pm.themeColor, prompt: a.prompt, features: a.pm.features });
  const common = { step: "free" as const, system, temperature: 0.5, maxOutputTokens: 16000, timeoutMs: TIMEOUTS.free, signal: env.signal, ctx: env.ctx, mock: { kind: "free" as const, prompt: a.prompt }, onDelta: env.onDelta };
  const first = await streamCode({ ...common, prompt });
  let buffer = first.text;
  let ex = extractHtml(buffer);
  if (!ex.complete && first.finishReason === "length") {
    const cont = await streamCode({ ...common, prompt: buildContinueUser(ex.html.slice(-1500)), attempt: 2 });
    buffer = joinContinuation(ex.html, cont.text);
    ex = extractHtml(buffer);
    if (!ex.complete) throw new AppError("LLM_TRUNCATED");
  }
  return ex.complete ? ex.html : closeHtml(ex.html);
}

// ---------- 补丁（修改 / 修复共用） ----------

interface PatchRun {
  step: "patch" | "fix";
  system: string;
  prompt: string;
  html: string;
  mock: Parameters<typeof streamCode>[0]["mock"];
}

/** 输出补丁 → 应用；失败时把失败原因追加到提示词重试 1 次。返回 null 表示两次都失败。 */
async function patchTwice(env: StepEnv, r: PatchRun): Promise<{ html: string; patches: Patch[] } | null> {
  let prompt = r.prompt;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const out = await streamCode({
      step: r.step,
      system: r.system,
      prompt,
      temperature: 0.1,
      maxOutputTokens: 6000,
      timeoutMs: r.step === "fix" ? TIMEOUTS.fix : TIMEOUTS.patch,
      signal: env.signal,
      ctx: env.ctx,
      mock: r.mock,
      onDelta: env.onDelta,
      attempt,
    });
    const patches = parsePatches(out.text);
    const applied = applyPatches(r.html, patches);
    if (applied.ok) return { html: applied.html, patches: summarizePatches(patches) };
    prompt = r.prompt + buildPatchRetrySuffix(describeFailures(applied.failures));
  }
  return null;
}

export interface PatchOutcome {
  html: string;
  patches: Patch[];
  rewritten: boolean;
}

/** code_patch：补丁失败重试 1 次，仍失败则整页重写（docs/07 §7.5）。 */
export async function patchWithRetry(env: StepEnv, a: { html: string; pm: PmOutput; prompt: string }): Promise<PatchOutcome> {
  const r = await patchTwice(env, { step: "patch", system: buildPatchSystem(), prompt: buildPatchUser({ currentHtml: a.html, changes: a.pm.changes, prompt: a.prompt }), html: a.html, mock: { kind: "patch", prompt: a.prompt } });
  if (r) return { ...r, rewritten: false };
  const html = await generateFreeHtml(env, { pm: a.pm, prompt: a.prompt, currentHtml: a.html });
  return { html, patches: [], rewritten: true };
}

/** 修复一轮：补丁失败重试 1 次，仍失败抛 PATCH_FAILED（修复不走整页重写）。 */
export async function fixOnce(env: StepEnv, a: { html: string; errors: RuntimeError[] }): Promise<{ html: string; patches: Patch[] }> {
  const r = await patchTwice(env, { step: "fix", system: buildFixSystem(), prompt: buildFixUser({ currentHtml: a.html, errors: a.errors }), html: a.html, mock: { kind: "fix", html: a.html } });
  if (!r) throw new AppError("PATCH_FAILED");
  return r;
}
