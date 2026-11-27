import "server-only";
import type { SseEvent } from "@/types/sse";

export type Emit = (e: SseEvent) => void;

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

export function encodeEvent(e: SseEvent): string {
  return `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`;
}

/**
 * 创建 SSE 响应：run(emit) 执行期间每 15 秒发一次 `: ping`。
 * 客户端断开后 emit 静默丢弃；run 结束（或抛错）后关闭流。
 */
export function sseResponse(run: (emit: Emit) => Promise<void>): Response {
  const enc = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (s: string) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(s));
        } catch {
          closed = true;
        }
      };
      const ping = setInterval(() => write(": ping\n\n"), 15_000);
      void run((e) => write(encodeEvent(e))).finally(() => {
        clearInterval(ping);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // 已被客户端取消
          }
        }
      });
    },
    cancel() {
      closed = true;
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}
