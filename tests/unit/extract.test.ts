import { describe, expect, it } from "vitest";
import { extractHtml, extractJson, joinContinuation } from "@/lib/agent/extract";

describe("extractJson", () => {
  it("带 ```json 围栏", () => expect(JSON.parse(extractJson('```json\n{"a":1}\n```') ?? "")).toEqual({ a: 1 }));
  it("前后有说明文字", () => expect(JSON.parse(extractJson('好的：{"a":{"b":2}} 以上') ?? "")).toEqual({ a: { b: 2 } }));
  it("字符串中的 } 与转义引号", () => expect(JSON.parse(extractJson('{"a":"x}\\"y{","b":[{"c":1}]}') ?? "")).toEqual({ a: 'x}"y{', b: [{ c: 1 }] }));
  it("没有 JSON", () => expect(extractJson("没有")).toBeNull());
});

describe("extractHtml", () => {
  it("带 ```html 围栏", () => {
    const r = extractHtml("```html\n<!DOCTYPE html><html><body>x</body></html>\n```");
    expect(r).toEqual({ html: "<!DOCTYPE html><html><body>x</body></html>", complete: true });
  });
  it("无 DOCTYPE 只有 <html", () => expect(extractHtml("说明 <html><body></body></html> 尾巴").html).toBe("<html><body></body></html>"));
  it("截断", () => expect(extractHtml("<!doctype html><html><body>").complete).toBe(false));
  it("无起点报错", () => expect(() => extractHtml("hello")).toThrow());
});

describe("joinContinuation", () => {
  it("去掉重叠", () => {
    const buf = "a".repeat(20) + "<div class='abcdefghij'>";
    expect(joinContinuation(buf, "<div class='abcdefghij'></div></html>")).toBe(buf + "</div></html>");
  });
  it("无重叠直接拼接", () => expect(joinContinuation("abc", "def")).toBe("abcdef"));
});
