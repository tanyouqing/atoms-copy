import "server-only";
import { APICallError, generateText, streamText } from "ai";
import type { z } from "zod";
import { parseJsonLoose } from "@/lib/agent/extract";
import { recordLlmCall } from "@/lib/db/queries";
import { getEnv } from "@/lib/env";
import { AppError, isAppError } from "@/lib/errors";
import { log } from "@/lib/log";
import { mockJson, mockStream, type MockCtx } from "./mock";
import { model } from "./provider";

/** 统一的模型调用（docs/07 §4、§6.3）：超时、重试、JSON 提取与校验、用量记录。 */

export type Step = "pm" | "config" | "free" | "patch" | "fix";

export interface CallCtx {
  projectId: string | null;
  turnId: string | null;
}

interface BaseOpts {
  step: Step;
  system: string;
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
  signal: AbortSignal;
  ctx: CallCtx;
  mock: MockCtx;
}

interface Usage {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
}

function record(opts: BaseOpts, attempt: number, t0: number, ok: boolean, usage?: Usage, errorCode?: string) {
  const env = getEnv();
  try {
    recordLlmCall({
      projectId: opts.ctx.projectId,
      turnId: opts.ctx.turnId,
      step: opts.step,
      model: env.mock ? "mock" : env.DEEPSEEK_MODEL,
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      cachedInputTokens: usage?.cachedInputTokens ?? null,
      durationMs: Date.now() - t0,
      ok,
      errorCode: errorCode ?? null,
      attempt,
    });
  } catch (e) {
    log.warn("llm.record_failed", { err: String(e) });
  }
  log.info("llm.call", { step: opts.step, attempt, ok, ms: Date.now() - t0, in: usage?.inputTokens, out: usage?.outputTokens, promptChars: opts.prompt.length, errorCode });
}

/** 把底层异常转换为 AppError：用户取消 → ABORTED，超时 → LLM_TIMEOUT，其他 → LLM_ERROR。 */
function toLlmError(e: unknown, userSignal: AbortSignal, timeoutSignal: AbortSignal): AppError {
  if (isAppError(e)) return e;
  if (userSignal.aborted) return new AppError("ABORTED");
  if (timeoutSignal.aborted) return new AppError("LLM_TIMEOUT");
  if (APICallError.isInstance(e)) log.warn("llm.api_error", { status: e.statusCode, msg: e.message.slice(0, 200) });
  else log.warn("llm.error", { msg: String(e instanceof Error ? e.message : e).slice(0, 200) });
  return new AppError("LLM_ERROR");
}

const mockDelay = (signal: AbortSignal, ms: number) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new AppError("ABORTED"));
      },
      { once: true },
    );
  });

async function rawText(opts: BaseOpts, prompt: string, attempt: number): Promise<string> {
  const timeout = AbortSignal.timeout(opts.timeoutMs);
  const signal = AbortSignal.any([opts.signal, timeout]);
  const t0 = Date.now();
  try {
    if (getEnv().mock) {
      await mockDelay(signal, 300);
      const text = mockJson(opts.mock);
      record(opts, attempt, t0, true);
      return text;
    }
    const r = await generateText({
      model: model(),
      system: opts.system,
      prompt,
      temperature: opts.temperature,
      maxOutputTokens: opts.maxOutputTokens,
      abortSignal: signal,
      maxRetries: 2,
    });
    record(opts, attempt, t0, true, r.usage);
    return r.text;
  } catch (e) {
    const err = toLlmError(e, opts.signal, timeout);
    record(opts, attempt, t0, false, undefined, err.code);
    throw err;
  }
}

function issuesText(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join(".") || "(根)"}: ${i.message}`)
    .join("\n");
}

/**
 * 结构化输出：请求体带 response_format=json_object（provider 中注入），
 * 提取 JSON → zod 校验；失败时把校验错误追加到 prompt 重试 1 次，再失败抛 LLM_BAD_OUTPUT。
 */
export async function callJson<S extends z.ZodType>(opts: BaseOpts & { schema: S }): Promise<z.infer<S>> {
  let prompt = opts.prompt;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const text = await rawText(opts, prompt, attempt);
    let parsed: unknown;
    try {
      parsed = parseJsonLoose(text);
    } catch (e) {
      log.warn("llm.bad_json", { step: opts.step, attempt, chars: text.length });
      prompt = `${opts.prompt}\n\n你上一次的输出没有通过校验，错误如下：\n(根): 不是合法的 JSON 对象（${String(e instanceof Error ? e.message : e).slice(0, 100)}）\n请只输出修正后的完整 JSON 对象。`;
      continue;
    }
    const r = opts.schema.safeParse(parsed);
    if (r.success) return r.data as z.infer<S>;
    log.warn("llm.schema_mismatch", { step: opts.step, attempt, issues: r.error.issues.length });
    prompt = `${opts.prompt}\n\n你上一次的输出没有通过校验，错误如下：\n${issuesText(r.error)}\n请只输出修正后的完整 JSON 对象。`;
  }
  throw new AppError("LLM_BAD_OUTPUT");
}

export interface StreamResult {
  text: string;
  finishReason: string;
}

/** 长文本流式输出（自由生成、补丁、修复）。onDelta 收到每个增量。 */
export async function streamCode(opts: BaseOpts & { onDelta?: (t: string) => void; attempt?: number }): Promise<StreamResult> {
  const timeout = AbortSignal.timeout(opts.timeoutMs);
  const signal = AbortSignal.any([opts.signal, timeout]);
  const attempt = opts.attempt ?? 1;
  const t0 = Date.now();
  try {
    if (getEnv().mock) {
      await mockDelay(signal, 300);
      const chunks = mockStream(opts.mock);
      let text = "";
      for (const c of chunks) {
        await mockDelay(signal, 50);
        text += c;
        opts.onDelta?.(c);
      }
      record(opts, attempt, t0, true);
      return { text, finishReason: "stop" };
    }
    let streamError: unknown = null;
    const r = streamText({
      model: model(),
      system: opts.system,
      prompt: opts.prompt,
      temperature: opts.temperature,
      maxOutputTokens: opts.maxOutputTokens,
      abortSignal: signal,
      maxRetries: 2,
      onError: ({ error }) => {
        streamError = error;
      },
    });
    let text = "";
    for await (const part of r.fullStream) {
      if (part.type === "text-delta") {
        text += part.text;
        opts.onDelta?.(part.text);
      } else if (part.type === "error") {
        streamError = part.error;
      } else if (part.type === "abort") {
        streamError = new Error("aborted");
      }
    }
    if (streamError || signal.aborted) throw streamError ?? new Error("aborted");
    const [finishReason, usage] = await Promise.all([r.finishReason, r.usage]);
    record(opts, attempt, t0, true, usage);
    return { text, finishReason };
  } catch (e) {
    const err = toLlmError(e, opts.signal, timeout);
    record(opts, attempt, t0, false, undefined, err.code);
    throw err;
  }
}

