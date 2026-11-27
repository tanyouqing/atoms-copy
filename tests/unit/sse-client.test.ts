import { describe, expect, it } from "vitest";
import { SseParser } from "@/lib/sse-client";

const ev = (o: object) => `event: x\ndata: ${JSON.stringify(o)}\n\n`;

describe("SseParser", () => {
  it("一个 chunk 多个事件", () => {
    const p = new SseParser();
    expect(p.feed(ev({ type: "code_delta", text: "a" }) + ev({ type: "code_delta", text: "b" })).map((e) => e.type === "code_delta" && e.text)).toEqual(["a", "b"]);
  });
  it("事件跨 chunk", () => {
    const p = new SseParser();
    const s = ev({ type: "done", turnId: "t", versionId: null, fixRoundsUsed: 0 });
    expect(p.feed(s.slice(0, 10))).toEqual([]);
    expect(p.feed(s.slice(10, 30))).toEqual([]);
    expect(p.feed(s.slice(30))).toHaveLength(1);
  });
  it("忽略 : ping 注释行", () => {
    const p = new SseParser();
    expect(p.feed(": ping\n\n" + ev({ type: "code_delta", text: "x" }) + ": ping\n\n")).toHaveLength(1);
  });
});
