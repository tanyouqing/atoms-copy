import "server-only";
import vm from "node:vm";
import { ALLOWED_SCRIPT_SRCS, ALLOWED_STYLE_HREFS } from "@/lib/vendor";
import type { RuntimeError } from "@/types/runtime";

export const MAX_HTML_LENGTH = 80_000;

const lineAt = (html: string, index: number) => html.slice(0, index).split("\n").length;

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
}

/** 服务端静态检查（docs/07 §9）。返回空数组表示通过。 */
export function staticCheck(html: string): RuntimeError[] {
  const errors: RuntimeError[] = [];
  const add = (message: string, line?: number) => errors.push({ type: "static", message, ...(line ? { line } : {}) });

  if (!/<html/i.test(html)) add("缺少 <html> 标签");
  if (!/<body/i.test(html)) add("缺少 <body> 标签");
  if (!/<\/html>/i.test(html)) add("缺少 </html> 结束标签，代码可能被截断");
  if (html.length > MAX_HTML_LENGTH) add(`HTML 长度 ${html.length} 超过上限 ${MAX_HTML_LENGTH} 字符`);

  const linkRe = /<link\b[^>]*>/gi;
  for (let m; (m = linkRe.exec(html)); ) {
    const rel = attr(m[0], "rel")?.toLowerCase();
    const href = attr(m[0], "href") ?? "";
    if (rel === "stylesheet" && /^(https?:)?\/\//i.test(href) && !ALLOWED_STYLE_HREFS.includes(href)) add(`不允许引用外部样式表：${href}`, lineAt(html, m.index));
  }

  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  for (let m; (m = scriptRe.exec(html)); ) {
    const openTag = `<script${m[1] ?? ""}>`;
    const body = m[2] ?? "";
    const startLine = lineAt(html, m.index);
    const src = attr(openTag, "src");
    const type = (attr(openTag, "type") ?? "").trim().toLowerCase();

    if (type === "module") {
      add("不允许使用 type=\"module\" 的脚本", startLine);
      continue;
    }
    if (src !== undefined) {
      if (!ALLOWED_SCRIPT_SRCS.includes(src)) add(`不允许引用外部脚本：${src}`, startLine);
      continue;
    }
    if (type === "text/tailwindcss") continue;
    if (type === "application/json") {
      try {
        JSON.parse(body);
      } catch (e) {
        add(`JSON 脚本内容无法解析：${(e as Error).message}`, startLine);
      }
      continue;
    }
    if (type !== "" && type !== "text/javascript") continue;

    try {
      new vm.Script(body, { filename: "inline.js" });
    } catch (e) {
      if (e instanceof SyntaxError) {
        // 脚本内容从 <script> 开始标签所在行开始，报错行号相对脚本内容
        const rel = Number(/inline\.js:(\d+)/.exec(String(e.stack))?.[1] ?? "1");
        add(`脚本语法错误：${e.message}`, startLine + rel - 1);
      } else {
        add(`脚本检查失败：${String(e)}`, startLine);
      }
    }
  }
  return errors;
}
