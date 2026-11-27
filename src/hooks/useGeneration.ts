"use client";

import { useCallback, useRef, type Dispatch } from "react";
import type { WorkspaceAction } from "@/components/workspace/state";
import { SseParser } from "@/lib/sse-client";
import type { SseEvent } from "@/types/sse";

export type RunResult =
  | { kind: "done"; event: Extract<SseEvent, { type: "done" }> }
  | { kind: "error"; code: string; message: string; retryable: boolean; http: boolean }
  | { kind: "aborted" }
  | { kind: "interrupted" };

/** 发起 SSE 请求（/api/generate、/api/fix）、解析事件并派发到 reducer；支持停止。 */
export function useGeneration(dispatch: Dispatch<WorkspaceAction>) {
  const acRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (url: "/api/generate" | "/api/fix", body: unknown, opts: { kind: "generate" | "fix"; prompt?: string }): Promise<RunResult> => {
      dispatch({ type: "run/start", kind: opts.kind, prompt: opts.prompt });
      const ac = new AbortController();
      acRef.current = ac;
      let res: Response;
      try {
        res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ac.signal });
      } catch {
        dispatch({ type: "run/end" });
        if (ac.signal.aborted) return { kind: "aborted" };
        dispatch({ type: "notice", text: "网络连接失败，请检查网络后重试" });
        return { kind: "interrupted" };
      }
      if (!res.ok || !res.body) {
        const b = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } | null;
        dispatch({ type: "run/end" });
        const message = b?.error?.message ?? "服务器开小差了，请重试";
        dispatch({ type: "notice", text: message });
        return { kind: "error", code: b?.error?.code ?? "INTERNAL", message, retryable: res.status >= 500, http: true };
      }

      const parser = new SseParser();
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let terminal: RunResult | null = null;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          for (const e of parser.feed(value)) {
            dispatch({ type: "sse", event: e });
            if (e.type === "done") terminal = { kind: "done", event: e };
            if (e.type === "error") terminal = { kind: "error", code: e.code, message: e.message, retryable: e.retryable, http: false };
          }
        }
      } catch {
        if (ac.signal.aborted) {
          dispatch({ type: "run/stopped" });
          return { kind: "aborted" };
        }
      } finally {
        if (acRef.current === ac) acRef.current = null;
      }
      if (terminal) return terminal;
      dispatch({ type: "run/end" });
      dispatch({ type: "notice", text: "连接中断，请刷新页面查看进度" });
      return { kind: "interrupted" };
    },
    [dispatch],
  );

  const stop = useCallback(() => {
    acRef.current?.abort();
  }, []);

  return { start, stop };
}
