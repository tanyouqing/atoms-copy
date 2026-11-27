import { describe, expect, it } from "vitest";
import { applyPatches, parsePatches } from "@/lib/agent/patch";

const block = (s: string, r: string) => `<<<<<<< SEARCH\n${s}\n=======\n${r}\n>>>>>>> REPLACE`;
const doc = ["<html>", "<body>", "  <h1>Title</h1>", "  <p>one</p>", "  <p>two</p>", "</body>", "</html>"].join("\n");

describe("parsePatches", () => {
  it("解析多个块和空 replace", () => {
    const ps = parsePatches(`说明\n${block("a", "b")}\n\n${block("c\nd", "")}`);
    expect(ps).toEqual([
      { search: "a", replace: "b" },
      { search: "c\nd", replace: "" },
    ]);
  });
  it("无法解析 → parse", () => {
    expect(applyPatches(doc, parsePatches("随便写点什么"))).toEqual({ ok: false, failures: [{ index: 0, reason: "parse" }] });
  });
});

describe("applyPatches", () => {
  it("精确匹配单块", () => {
    const r = applyPatches(doc, parsePatches(block("  <h1>Title</h1>", "  <h1>New</h1>")));
    expect(r.ok && r.html).toContain("<h1>New</h1>");
  });
  it("多块顺序依赖", () => {
    const r = applyPatches(doc, parsePatches(`${block("<p>one</p>", "<p>uno</p>")}\n${block("<p>uno</p>", "<p>eins</p>")}`));
    expect(r.ok && r.html).toContain("<p>eins</p>");
  });
  it("宽松匹配：缩进不同", () => {
    const r = applyPatches(doc, parsePatches(block("<h1>Title</h1>\n<p>one</p>", "  <h1>T</h1>")));
    expect(r.ok && r.html).toBe(["<html>", "<body>", "  <h1>T</h1>", "  <p>two</p>", "</body>", "</html>"].join("\n"));
  });
  it("宽松匹配：行尾空格", () => {
    const r = applyPatches(doc, parsePatches(block("  <p>two</p>   ", "  <p>2</p>")));
    expect(r.ok && r.html).toContain("<p>2</p>");
  });
  it("CRLF 文本", () => {
    const crlf = doc.replace(/\n/g, "\r\n");
    const r = applyPatches(crlf, parsePatches(block("  <p>one</p>\n  <p>two</p>", "  <p>x</p>")));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.html).toContain("<p>x</p>\r\n</body>");
      expect(r.html.split("\r\n")).toHaveLength(6);
    }
  });
  it("CRLF 补丁文本", () => {
    const r = applyPatches(doc, parsePatches(block("  <p>one</p>", "  <p>1</p>").replace(/\n/g, "\r\n")));
    expect(r.ok && r.html).toContain("<p>1</p>");
  });
  it("SEARCH 不唯一 → ambiguous", () => {
    const d = "<p>x</p>\n<p>x</p>";
    expect(applyPatches(d, parsePatches(block("<p>x</p>", "y")))).toEqual({ ok: false, failures: [{ index: 0, reason: "ambiguous" }] });
  });
  it("找不到 → not_found，且任一失败原文不变", () => {
    const r = applyPatches(doc, parsePatches(`${block("<p>one</p>", "<p>1</p>")}\n${block("<p>nope</p>", "")}`));
    expect(r).toEqual({ ok: false, failures: [{ index: 1, reason: "not_found" }] });
  });
  it("空 replace 删除", () => {
    const r = applyPatches(doc, parsePatches(block("  <p>one</p>", "")));
    expect(r.ok && r.html).not.toContain("one");
  });
});
