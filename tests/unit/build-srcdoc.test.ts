import { describe, expect, it } from "vitest";
import { buildSrcdoc } from "@/lib/preview/build-srcdoc";
import { RUNTIME_SOURCE } from "@/lib/preview/runtime";
import { TAILWIND_CDN } from "@/lib/vendor";

const html = `<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<script src="${TAILWIND_CDN}"></script>\n</head>\n<body>\n<script>\nthrow new Error("x");\n</script>\n</body>\n</html>`;

describe("buildSrcdoc", () => {
  const out = buildSrcdoc({ html, channel: "c1", storage: { "app:todo:data": '{"x":"</script>"}' }, origin: "http://1.2.3.4" });

  it("输出与输入行数相同", () => {
    expect(out.split("\n")).toHaveLength(html.split("\n").length);
  });
  it("runtime 位于 <head> 同一行", () => {
    expect(out.split("\n")[2]).toMatch(/^<head><script>window\.__ATOMS__=/);
  });
  it("vendor 地址被替换为本站地址", () => {
    expect(out).not.toContain(TAILWIND_CDN);
    expect(out).toContain("http://1.2.3.4/vendor/tailwindcss-browser.js");
  });
  it("快照中的 </script> 被转义", () => {
    const injected = out.split("\n")[2] ?? "";
    expect(injected.match(/<\/script>/g)).toHaveLength(1);
  });
  it("runtime 源码不含换行，且语法合法", () => {
    expect(RUNTIME_SOURCE).not.toContain("\n");
    expect(() => new Function(RUNTIME_SOURCE)).not.toThrow();
  });
  it("没有 <head> 时插在 <html> 之后", () => {
    const r = buildSrcdoc({ html: "<html><body></body></html>", channel: "c", storage: {}, origin: "" });
    expect(r.startsWith("<html><script>")).toBe(true);
  });
});
