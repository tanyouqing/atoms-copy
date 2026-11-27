import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { setDbForTests } from "@/lib/db";
import { resetEnvForTests } from "@/lib/env";
import { callJson, streamCode } from "@/lib/llm/call";

/** 用假的 fetch 验证真实模型路径：请求体注入 thinking/response_format、JSON 提取与校验重试、流式解析。 */
const saved = { ...process.env };
const bodies: Record<string, unknown>[] = [];

function completion(content: string) {
  return new Response(
    JSON.stringify({ id: "x", object: "chat.completion", created: 1, model: "deepseek-flash", choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }),
    { headers: { "content-type": "application/json" } },
  );
}

function streamResponse(parts: string[]) {
  const chunks = parts.map((p) => `data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 1, model: "m", choices: [{ index: 0, delta: { content: p }, finish_reason: null }] })}\n\n`);
  chunks.push(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 1, model: "m", choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 } })}\n\n`, "data: [DONE]\n\n");
  return new Response(new ReadableStream({ start(c) { for (const ch of chunks) c.enqueue(new TextEncoder().encode(ch)); c.close(); } }), { headers: { "content-type": "text/event-stream" } });
}

const base = { system: "s", temperature: 0.2, maxOutputTokens: 100, timeoutMs: 5000, signal: new AbortController().signal, ctx: { projectId: null, turnId: null }, mock: { kind: "free" as const, prompt: "" } };

describe("callJson / streamCode（真实路径，假 fetch）", () => {
  let queue: Response[] = [];
  beforeEach(() => {
    Object.assign(process.env, { LLM_MOCK: "0", DEEPSEEK_API_KEY: "sk-test", DEEPSEEK_BASE_URL: "https://api.deepseek.test" });
    resetEnvForTests();
    setDbForTests(":memory:");
    bodies.length = 0;
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      const r = queue.shift();
      if (!r) throw new Error("no response queued");
      return r;
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...saved };
    resetEnvForTests();
  });

  it("请求体含 thinking disabled 与 response_format；校验失败带错误重试一次", async () => {
    queue = [completion('```json\n{"n":"x"}\n```'), completion('好的 {"n": 3}')];
    const r = await callJson({ ...base, step: "pm", prompt: "p", schema: z.object({ n: z.number() }) });
    expect(r).toEqual({ n: 3 });
    expect(bodies[0]?.thinking).toEqual({ type: "disabled" });
    expect(bodies[0]?.response_format).toEqual({ type: "json_object" });
    expect(bodies[0]?.model).toBe("deepseek-flash");
    const msgs = bodies[1]?.messages as { content: string }[];
    expect(msgs.at(-1)?.content).toContain("没有通过校验");
  });

  it("两次都不合法 → LLM_BAD_OUTPUT", async () => {
    queue = [completion("no json"), completion("{}")];
    await expect(callJson({ ...base, step: "pm", prompt: "p", schema: z.object({ n: z.number() }) })).rejects.toMatchObject({ code: "LLM_BAD_OUTPUT" });
  });

  it("streamCode 拼接增量，流式请求不带 response_format", async () => {
    queue = [streamResponse(["<html>", "<body>hi</body>", "</html>"])];
    const deltas: string[] = [];
    const r = await streamCode({ ...base, step: "free", prompt: "p", onDelta: (t) => deltas.push(t) });
    expect(r.text).toBe("<html><body>hi</body></html>");
    expect(r.finishReason).toBe("stop");
    expect(deltas.length).toBe(3);
    expect(bodies[0]?.stream).toBe(true);
    expect(bodies[0]?.response_format).toBeUndefined();
    expect(bodies[0]?.thinking).toEqual({ type: "disabled" });
  });
});
