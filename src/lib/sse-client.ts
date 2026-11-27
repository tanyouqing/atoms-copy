import type { SseEvent } from "@/types/sse";

/**
 * SSE 增量解析器（docs/06 §5）：处理一个 chunk 含多个事件、一个事件跨 chunk、`: ping` 注释行。
 * 只解析 data 行（事件类型也在 JSON 的 type 字段里）。
 */
export class SseParser {
  private buf = "";

  feed(chunk: string): SseEvent[] {
    this.buf += chunk.replace(/\r\n/g, "\n");
    const out: SseEvent[] = [];
    let idx: number;
    while ((idx = this.buf.indexOf("\n\n")) >= 0) {
      const block = this.buf.slice(0, idx);
      this.buf = this.buf.slice(idx + 2);
      const data = block
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).replace(/^ /, ""))
        .join("\n");
      if (!data) continue;
      try {
        out.push(JSON.parse(data) as SseEvent);
      } catch {
        // 非法事件丢弃
      }
    }
    return out;
  }
}
