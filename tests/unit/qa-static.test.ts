import { describe, expect, it } from "vitest";
import { staticCheck } from "@/lib/agent/qa-static";
import { CHARTJS_CDN, TAILWIND_CDN } from "@/lib/vendor";

const page = (body: string, head = "") => `<!DOCTYPE html>\n<html>\n<head>\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>`;

describe("staticCheck", () => {
  it("合法 HTML 通过", () => {
    const html = page(`<script>\nconst a = 1;\n</script>`, `<script src="${TAILWIND_CDN}"></script>\n<script src="${CHARTJS_CDN}"></script>`);
    expect(staticCheck(html)).toEqual([]);
  });
  it("缺少 </html>", () => {
    expect(staticCheck("<html><body>hi</body>").map((e) => e.message).join()).toContain("</html>");
  });
  it("非白名单 script src", () => {
    const errs = staticCheck(page("", `<script src="https://unpkg.com/react"></script>`));
    expect(errs[0]?.message).toBe("不允许引用外部脚本：https://unpkg.com/react");
  });
  it("module 脚本", () => {
    expect(staticCheck(page(`<script type="module">import x from "y";</script>`))[0]?.message).toContain("module");
  });
  it("外链样式表", () => {
    expect(staticCheck(page("", `<link rel="stylesheet" href="https://cdn.example.com/a.css">`))).toHaveLength(1);
  });
  it("内联脚本语法错误且行号正确", () => {
    // 第 7 行是 <script>，脚本第 3 行出错 → 文档第 9 行
    const html = page(`<script>\nconst a = 1;\nconst b = ;\n</script>`);
    const errs = staticCheck(html);
    expect(errs).toHaveLength(1);
    expect(errs[0]?.message).toMatch(/^脚本语法错误/);
    expect(html.split("\n")[(errs[0]?.line ?? 0) - 1]).toBe("const b = ;");
  });
  it("application/json 脚本内容非法", () => {
    expect(staticCheck(page(`<script type="application/json">{bad}</script>`))[0]?.message).toContain("JSON");
  });
  it("text/tailwindcss 跳过", () => {
    expect(staticCheck(page("", `<style type="text/tailwindcss">@apply x;</style><script type="text/tailwindcss">not js {</script>`))).toEqual([]);
  });
});
