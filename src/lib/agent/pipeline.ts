import "server-only";
import { createVersion, projectSummary, recentChat, toVersionFull, updateProject, type ProjectRow, type VersionRow } from "@/lib/db/queries";
import { AppError, isAppError } from "@/lib/errors";
import { toAppError } from "@/lib/http";
import { callJson } from "@/lib/llm/call";
import { clip, log } from "@/lib/log";
import type { Emit } from "@/lib/sse";
import { isTemplateId, type TemplateId } from "@/lib/templates/registry";
import type { QaMeta, VersionSource } from "@/types/api";
import type { RuntimeError } from "@/types/runtime";
import type { ThemeStyle } from "@/lib/templates/themes";
import { styleSpec } from "./design-spec";
import { TIMEOUTS, fixOnce, generateConfig, generateFreeHtml, patchWithRetry, restyleConfig, type StepEnv } from "./engineer";
import { normalizeIntent, templateRejection } from "./intent";
import { fmtK, type Messenger } from "./messages";
import { buildPmSystem, buildPmUser } from "./prompts/pm";
import { applyQaResult } from "./qa-result";
import { staticCheck } from "./qa-static";
import { PmOutputSchema, type PmOutput } from "./schemas";
import { decideStyle, sameStyle, styleName, styleOfVersion, type StylePick } from "./style";

/** 服务端 turn 编排（docs/07 §10）。所有步骤写 messages 表并发 SSE，刷新后 UI 可原样恢复。 */

export const FIX_BUDGET = 2;

export interface TurnResult {
  versionId: string | null;
  fixRoundsUsed: number;
}

function parseJson<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function checkAborted(signal: AbortSignal) {
  if (signal.aborted) throw new AppError("ABORTED");
}

/** code_delta 节流（100ms 合并一次）+ 每秒刷新一次工程师消息的进度文案（只发 SSE）。 */
function deltaEmitter(emit: Emit, msg: Messenger, msgId: string, label: string) {
  let pending = "";
  let total = 0;
  let lastFlush = 0;
  let lastProgress = 0;
  const flush = () => {
    if (pending) emit({ type: "code_delta", text: pending });
    pending = "";
  };
  const onDelta = (t: string) => {
    pending += t;
    total += t.length;
    const now = Date.now();
    if (now - lastFlush >= 100) {
      flush();
      lastFlush = now;
    }
    if (now - lastProgress >= 1000) {
      msg.progress(msgId, `${label} 已写 ${fmtK(total)} 字符`);
      lastProgress = now;
    }
  };
  return { onDelta, flush };
}

interface DeliverInput {
  projectId: string;
  turnId: string;
  html: string;
  source: VersionSource;
  templateId: string | null;
  config: unknown | null;
  plan: PmOutput | null;
  label: string;
  parentVersionId: string | null;
  errors: RuntimeError[];
  fixRoundsUsed: number;
}

/**
 * 入库并通知：版本 + 版本卡片 + 测试员"正在检查运行情况"消息。
 * 静态检查仍失败（预算用尽）时版本直接记为 error，并按 give_up 逻辑回退；此时返回 versionId=null，
 * 客户端重新拉取项目详情以同步当前版本。
 */
export function deliverVersion(d: DeliverInput, emit: Emit, msg: Messenger): TurnResult {
  const failed = d.errors.length > 0;
  const version = createVersion({
    projectId: d.projectId,
    turnId: d.turnId,
    label: d.label,
    source: d.source,
    templateId: d.templateId,
    config: d.config,
    html: d.html,
    plan: d.plan,
    status: failed ? "error" : "pending",
    errors: failed ? d.errors : null,
    parentVersionId: d.parentVersionId,
  });
  const vmsg = msg.add("system", "version", version.label, { meta: { seq: version.seq, source: version.source }, versionId: version.id });
  emit({ type: "version", version: toVersionFull(version), message: vmsg });
  const meta: QaMeta = { phase: failed ? "static" : "runtime", errors: d.errors, round: d.fixRoundsUsed, outcome: "fixing" };
  const qa = msg.start("qa", "qa_report", failed ? `发现 ${d.errors.length} 个问题` : "正在检查运行情况…", { meta, versionId: version.id });
  if (!failed) return { versionId: version.id, fixRoundsUsed: d.fixRoundsUsed };

  const r = applyQaResult({ version, status: "error", errors: d.errors, qa: { outcome: "give_up", round: d.fixRoundsUsed, phase: "static" } });
  if (r.message) emit({ type: "message_update", id: qa.id, patch: { status: r.message.status, content: r.message.content, meta: r.message.meta, finishedAt: r.message.finishedAt } });
  return { versionId: null, fixRoundsUsed: d.fixRoundsUsed };
}

/** 静态检查 + 服务端修复（共享 2 轮预算）。返回最终 html、剩余错误与已用轮数。 */
async function staticQa(env: StepEnv, html: string, rounds: number, msg: Messenger, emit: Emit) {
  let errors = staticCheck(html);
  let fixed = false;
  while (errors.length && rounds < FIX_BUDGET) {
    rounds++;
    const qa = msg.start("qa", "qa_report", `发现 ${errors.length} 个问题，正在修复（第 ${rounds}/${FIX_BUDGET} 轮）`, { meta: { phase: "static", errors, round: rounds, outcome: "fixing" } satisfies QaMeta });
    const eng = msg.start("engineer", "engineer_patch", "正在修复问题…");
    const d = deltaEmitter(emit, msg, eng.id, "正在修复问题…");
    try {
      const r = await fixOnce({ ...env, onDelta: d.onDelta }, { html, errors });
      d.flush();
      html = r.html;
      fixed = true;
      msg.update(eng.id, { status: "done", content: `修改了 ${r.patches.length} 处`, meta: { patches: r.patches } });
      msg.update(qa.id, { status: "done" });
    } catch (e) {
      if (!isAppError(e) || e.code !== "PATCH_FAILED") throw e;
      msg.update(eng.id, { status: "error", content: "修复未能应用" });
      msg.update(qa.id, { status: "done" });
      break;
    }
    errors = staticCheck(html);
  }
  return { html, errors, rounds, fixed };
}

export interface TurnInput {
  project: ProjectRow;
  current: VersionRow | null;
  prompt: string;
  turnId: string;
  signal: AbortSignal;
  isFirstTurn: boolean;
  /** 用户在风格卡片上选的风格 */
  style?: ThemeStyle | null;
  /** 工作台的风格切换按钮：只换风格，模板应用不调用模型 */
  styleOnly?: boolean;
}

const styleLabel = (p: StylePick) => (p.custom ? `custom：${p.custom.name}` : `${p.style}（${styleName(p)}）`);

/** 模板应用只换风格：不调用模型，直接换 theme 重新渲染。 */
function restyleTurn(input: TurnInput & { current: VersionRow }, currentConfig: unknown, currentPlan: PmOutput | null, pick: StylePick, emit: Emit, msg: Messenger): TurnResult {
  const { current, project } = input;
  const name = styleName(pick);
  const plan: PmOutput = {
    ...(currentPlan ?? { intent: "config_edit", templateId: current.templateId, appName: project.title.slice(0, 20), features: ["换风格"], unsupported: [], language: "zh-CN", themeColor: "indigo" }),
    intent: "config_edit",
    versionLabel: `换成${name}`.slice(0, 16),
    reply: `好的，换成「${name}」，内容和数据都不变。`,
    changes: [`风格换成${name}`],
    style: pick.custom ? "custom" : pick.style,
    customTheme: pick.custom,
    styleOnly: true,
  };
  msg.add("pm", "pm_plan", plan.reply, { meta: plan });
  const r = restyleConfig(current.templateId as TemplateId, currentConfig, pick);
  msg.add("engineer", "engineer_config", `已切换为「${name}」`, { meta: { templateId: current.templateId, config: r.config } });
  log.info("turn.restyle", { projectId: project.id, style: pick.style, custom: !!pick.custom });
  const qa = staticCheck(r.html);
  return deliverVersion(
    { projectId: project.id, turnId: input.turnId, html: r.html, source: "config_edit", templateId: current.templateId, config: r.config, plan, label: plan.versionLabel, parentVersionId: current.id, errors: qa, fixRoundsUsed: 0 },
    emit,
    msg,
  );
}

export async function runTurn(input: TurnInput, emit: Emit, msg: Messenger): Promise<TurnResult> {
  const { project, current, prompt, turnId, signal } = input;
  const env: StepEnv = { signal, ctx: { projectId: project.id, turnId } };

  const currentPlan = parseJson<PmOutput>(current?.planJson ?? null);
  const currentConfig = parseJson<unknown>(current?.configJson ?? null);
  const currentStyle = current ? styleOfVersion(currentConfig, currentPlan) : null;
  const canRestyle = !!current && !!current.templateId && isTemplateId(current.templateId) && currentConfig !== null;

  // 0. 风格切换按钮：模板应用瞬间切换，不经过模型
  if (input.styleOnly && input.style && current && canRestyle) {
    return restyleTurn({ ...input, current }, currentConfig, currentPlan, { style: input.style }, emit, msg);
  }

  // 1. 产品经理
  const pmMsg = msg.start("pm", "pm_plan", "正在分析需求…");
  const pm = await callJson({
    step: "pm",
    schema: PmOutputSchema,
    system: buildPmSystem(),
    prompt: buildPmUser({
      currentApp: current ? { title: project.title, templateId: current.configJson ? current.templateId : null, features: currentPlan?.features ?? [], config: currentConfig, style: currentStyle ? styleLabel(currentStyle) : null } : null,
      recent: recentChat(project.id).slice(0, -1),
      prompt,
      pickedStyle: !current && input.style ? styleLabel({ style: input.style }) : input.styleOnly && input.style ? styleLabel({ style: input.style }) : null,
    }),
    temperature: 0.2,
    maxOutputTokens: 800,
    timeoutMs: TIMEOUTS.pm,
    signal,
    ctx: env.ctx,
    mock: { kind: "pm", prompt, hasCurrent: !!current, currentTemplateId: current?.templateId ?? null, currentTheme: currentPlan?.themeColor ?? null, pickedStyle: input.style ?? null },
  });
  const intent = normalizeIntent(pm, current);
  const isNew = intent === "new_app" || intent === "regenerate";
  // 工作台按钮换风格（自由生成的应用走到这里）时，以按钮为准
  const style = input.styleOnly && input.style ? { style: input.style } : decideStyle({ pm, picked: input.style ?? null, current: currentStyle, isNew });
  const styleChanged = !isNew && !sameStyle(currentStyle, style);
  // 修改类意图保持当前模板；新建类以 PM 选择为准
  let templateIdPick = intent === "config_edit" ? (current?.templateId ?? null) : pm.templateId;
  // 新建类：模板做不出用户点名的东西（如 2048 被套成贪吃蛇）时改走自由生成
  if ((intent === "new_app" || intent === "regenerate") && templateIdPick && isTemplateId(templateIdPick)) {
    const reason = templateRejection(templateIdPick, prompt, pm.unsupported);
    if (reason) {
      log.info("pm.template_rejected", { projectId: project.id, templateId: templateIdPick, reason, unsupported: pm.unsupported });
      templateIdPick = null;
    }
  }
  const plan: PmOutput = { ...pm, intent, templateId: templateIdPick, style: style.custom ? "custom" : style.style, customTheme: style.custom };
  // 非模板应用换风格：把风格说明交给工程师（模板应用直接换 theme，不需要）
  if (styleChanged && !(intent === "config_edit" && canRestyle)) plan.changes = [...plan.changes, `把整体视觉风格换成「${styleName(style)}」，只改样式不改功能和数据：\n${styleSpec(style)}`].slice(0, 8);
  msg.update(pmMsg.id, { status: "done", content: pm.reply, meta: plan });
  log.info("pm.done", { projectId: project.id, intent, modelIntent: pm.intent, templateId: plan.templateId, prompt: clip(prompt) });
  if (input.isFirstTurn && !project.titleLocked) {
    const p = updateProject(project.id, { title: pm.appName });
    if (p) emit({ type: "project", project: projectSummary(p) });
  }
  checkAborted(signal);

  // PM 判断这次只换风格、且是模板应用：不再调用模型生成配置
  if ((pm.styleOnly || input.styleOnly) && intent === "config_edit" && canRestyle && current && styleChanged) {
    const r = restyleConfig(current.templateId as TemplateId, currentConfig, style);
    msg.add("engineer", "engineer_config", `已切换为「${styleName(style)}」`, { meta: { templateId: current.templateId, config: r.config } });
    const qaErrors = staticCheck(r.html);
    return deliverVersion(
      { projectId: project.id, turnId, html: r.html, source: "config_edit", templateId: current.templateId, config: r.config, plan, label: plan.versionLabel, parentVersionId: current.id, errors: qaErrors, fixRoundsUsed: 0 },
      emit,
      msg,
    );
  }

  // 2. 工程师
  let html: string;
  let source: VersionSource;
  let templateId: TemplateId | null = null;
  let config: unknown | null = null;

  const templateNew = (intent === "new_app" || intent === "regenerate") && plan.templateId && isTemplateId(plan.templateId);
  const configEdit = intent === "config_edit" && current?.templateId && isTemplateId(current.templateId) && currentConfig !== null;

  const runFree = async (currentHtml?: string) => {
    const m = msg.start("engineer", "engineer_code", "正在编写代码…");
    const d = deltaEmitter(emit, msg, m.id, "正在编写代码…");
    const out = await generateFreeHtml({ ...env, onDelta: d.onDelta }, { pm: plan, prompt, currentHtml, style });
    d.flush();
    msg.update(m.id, { status: "done", content: `已完成代码编写（${fmtK(out.length)} 字符）`, meta: { chars: out.length } });
    return out;
  };

  if (templateNew || configEdit) {
    const tid = (configEdit ? current?.templateId : plan.templateId) as TemplateId;
    const m = msg.start("engineer", "engineer_config", "正在填写应用配置…");
    try {
      const r = await generateConfig(env, { templateId: tid, pm: plan, prompt, currentConfig: configEdit ? currentConfig : null, style });
      html = r.html;
      config = r.config;
      templateId = tid;
      source = configEdit ? "config_edit" : "template";
      msg.update(m.id, { status: "done", content: "已生成应用配置", meta: { templateId: tid, config } });
    } catch (e) {
      // 新建时配置两次都不合法：降级为自由生成，保证主流程有结果（README 设计说明）
      if (!isAppError(e) || e.code !== "LLM_BAD_OUTPUT" || configEdit) throw e;
      msg.update(m.id, { status: "error", content: "模板配置未通过校验，改为自由编写代码" });
      html = await runFree();
      source = "free";
    }
  } else if (intent === "code_patch" && current) {
    const m = msg.start("engineer", "engineer_patch", "正在修改代码…");
    const d = deltaEmitter(emit, msg, m.id, "正在修改代码…");
    const r = await patchWithRetry({ ...env, onDelta: d.onDelta }, { html: current.html, pm: plan, prompt, style });
    d.flush();
    html = r.html;
    source = r.rewritten ? "free" : "patch";
    msg.update(m.id, {
      status: "done",
      content: r.rewritten ? `已完成代码编写（${fmtK(html.length)} 字符）（局部修改未成功，已整页重写）` : `修改了 ${r.patches.length} 处`,
      meta: r.rewritten ? { patches: [], fallback: "rewrite" } : { patches: r.patches },
    });
    templateId = (current.templateId as TemplateId | null) ?? null;
  } else {
    html = await runFree();
    source = "free";
  }
  checkAborted(signal);

  // 3. 测试员：静态检查（必要时服务端修复）
  const qa = await staticQa(env, html, 0, msg, emit);
  checkAborted(signal);

  // 4. 入库
  return deliverVersion(
    {
      projectId: project.id,
      turnId,
      html: qa.html,
      source,
      templateId,
      config: qa.fixed ? null : config,
      plan,
      label: plan.versionLabel,
      parentVersionId: current?.id ?? null,
      errors: qa.errors,
      fixRoundsUsed: qa.rounds,
    },
    emit,
    msg,
  );
}

export interface FixInput {
  project: ProjectRow;
  version: VersionRow;
  turnId: string;
  errors: RuntimeError[];
  round: number;
  signal: AbortSignal;
  manual: boolean;
}

/** 运行时报错的修复（docs/06 POST /api/fix）。补丁失败抛 PATCH_FAILED，由客户端按预算决定下一步。 */
export async function runFix(input: FixInput, emit: Emit, msg: Messenger, qaMsgId: string | null): Promise<TurnResult> {
  const { project, version, errors, round, signal } = input;
  const env: StepEnv = { signal, ctx: { projectId: project.id, turnId: input.turnId } };
  const meta: QaMeta = { phase: "runtime", errors, round, outcome: "fixing" };
  const content = `发现 ${errors.length} 个问题，正在修复（第 ${round}/${FIX_BUDGET} 轮）`;
  if (qaMsgId) msg.update(qaMsgId, { status: "done", content, meta });
  else msg.add("qa", "qa_report", content, { meta, versionId: version.id });

  const eng = msg.start("engineer", "engineer_patch", "正在修复问题…");
  const d = deltaEmitter(emit, msg, eng.id, "正在修复问题…");
  const r = await fixOnce({ ...env, onDelta: d.onDelta }, { html: version.html, errors });
  d.flush();
  const staticErrors = staticCheck(r.html);
  if (staticErrors.length) throw new AppError("PATCH_FAILED", undefined, "修复后的代码没有通过检查");
  msg.update(eng.id, { status: "done", content: `修改了 ${r.patches.length} 处`, meta: { patches: r.patches } });
  checkAborted(signal);

  const plan = parseJson<PmOutput>(version.planJson);
  return deliverVersion(
    {
      projectId: project.id,
      turnId: input.turnId,
      html: r.html,
      source: "fix",
      templateId: version.templateId,
      config: null,
      plan,
      label: `修复：${version.label}`.slice(0, 16),
      parentVersionId: version.id,
      errors: [],
      fixRoundsUsed: round,
    },
    emit,
    msg,
  );
}

/**
 * 统一收尾：成功发 done；用户停止 → 消息置 stopped + "已停止"；
 * 其他错误 → running 消息置 error、插入系统错误消息（可关闭）、发 error 事件。
 */
export async function guardTurn(opts: { turnId: string; signal: AbortSignal; emit: Emit; msg: Messenger; systemErrorMessage: boolean; logCtx: Record<string, unknown> }, fn: () => Promise<TurnResult>) {
  const { emit, msg, turnId } = opts;
  const t0 = Date.now();
  try {
    const r = await fn();
    emit({ type: "done", turnId, versionId: r.versionId, fixRoundsUsed: r.fixRoundsUsed });
    log.info("turn.done", { ...opts.logCtx, turnId, versionId: r.versionId, fixRoundsUsed: r.fixRoundsUsed, ms: Date.now() - t0 });
  } catch (e) {
    const aborted = opts.signal.aborted || (isAppError(e) && e.code === "ABORTED");
    if (aborted) {
      msg.finishAll("stopped");
      msg.add("system", "notice", "已停止");
      emit({ type: "done", turnId, versionId: null, fixRoundsUsed: 0 });
      log.info("turn.stopped", { ...opts.logCtx, turnId, ms: Date.now() - t0 });
      return;
    }
    const err = toAppError(e);
    if (err.code === "INTERNAL") log.error("turn.error", { ...opts.logCtx, turnId, err: String(e instanceof Error ? e.stack : e).slice(0, 1000) });
    else log.warn("turn.failed", { ...opts.logCtx, turnId, code: err.code, ms: Date.now() - t0 });
    msg.finishAll("error", err.message);
    if (opts.systemErrorMessage) msg.add("system", "error", err.message, { status: "error", meta: { code: err.code, retryable: err.retryable } });
    emit({ type: "error", code: err.code, message: err.message, retryable: err.retryable });
  }
}

