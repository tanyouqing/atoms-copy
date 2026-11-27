import { toLocalVendor } from "@/lib/vendor";
import { RUNTIME_SOURCE } from "./runtime";

/** JSON 放进内联 <script>：转义 `<`（防止 `</script>` 提前闭合）与 U+2028/2029。 */
function inlineJson(v: unknown): string {
  return JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

/**
 * 组装预览 iframe 的 srcdoc（docs/09 §3）：替换 vendor 地址 → 在 <head> 同一行注入 runtime。
 * 不新增任何换行，iframe 报错的行号等于存储 HTML 的行号。
 */
export function buildSrcdoc(opts: { html: string; channel: string; storage: Record<string, string>; origin?: string }): string {
  // srcdoc 文档的相对地址解析不可靠，vendor 用绝对地址
  const origin = opts.origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  const html = toLocalVendor(opts.html, origin);
  const boot = `window.__ATOMS__={channel:${inlineJson(opts.channel)},storage:${inlineJson(opts.storage)}};`;
  const tag = `<script>${boot}${RUNTIME_SOURCE}</script>`;

  const head = /<head[^>]*>/i.exec(html);
  const anchor = head ?? /<html[^>]*>/i.exec(html);
  if (!anchor) return tag + html;
  const at = anchor.index + anchor[0].length;
  return html.slice(0, at) + tag + html.slice(at);
}
