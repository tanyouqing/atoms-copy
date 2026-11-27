import "server-only";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getEnv } from "@/lib/env";

/**
 * DeepSeek 接入（docs/03 §3.1）。DeepSeek 默认开启思考模式，AI SDK 不认识这个字段，
 * 所以用自定义 fetch 在每个请求体里注入 thinking: disabled；
 * 非流式请求（callJson）没有 response_format 时补上 json_object（docs/07 §4）。
 */
export const deepseekFetch: typeof fetch = async (input, init) => {
  if (init?.body && typeof init.body === "string") {
    const body = JSON.parse(init.body) as Record<string, unknown>;
    body.thinking = { type: "disabled" };
    if (!body.stream && !body.response_format) body.response_format = { type: "json_object" };
    if (process.env.LLM_DEBUG_BODY === "1") {
      // 联调用：只打印请求体中的控制字段，不打印提示词与 Key
      const { messages: _m, ...rest } = body;
      console.log(JSON.stringify({ event: "llm.request_body", ...rest, messages: Array.isArray(_m) ? `[${_m.length} messages]` : undefined }));
    }
    init = { ...init, body: JSON.stringify(body) };
  }
  return fetch(input, init);
};

let provider: ReturnType<typeof createOpenAICompatible> | null = null;

export function model() {
  const env = getEnv();
  provider ??= createOpenAICompatible({
    name: "deepseek",
    baseURL: env.DEEPSEEK_BASE_URL,
    apiKey: env.DEEPSEEK_API_KEY,
    fetch: deepseekFetch,
    includeUsage: true,
  });
  return provider(env.DEEPSEEK_MODEL);
}
