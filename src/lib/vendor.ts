/**
 * 生成的应用允许引用的外部脚本白名单（见 docs/03-tech-stack.md §2.3）。
 * 存储 / 下载的 HTML 中写 CDN 地址；预览与分享页渲染时替换为本站 /vendor/* 地址。
 */
export const TAILWIND_CDN = "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.3.5";
export const CHARTJS_CDN = "https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js";

export const VENDOR_SCRIPTS = [
  { name: "tailwind", cdn: TAILWIND_CDN, local: "/vendor/tailwindcss-browser.js" },
  { name: "chartjs", cdn: CHARTJS_CDN, local: "/vendor/chart.umd.min.js" },
] as const;

export const ALLOWED_SCRIPT_SRCS: readonly string[] = VENDOR_SCRIPTS.map((v) => v.cdn);

/** 把 HTML 中的 CDN 地址替换为 `<origin>/vendor/*`；只做字符串替换，不改变行数。 */
export function toLocalVendor(html: string, origin: string): string {
  let out = html;
  for (const v of VENDOR_SCRIPTS) out = out.split(v.cdn).join(origin + v.local);
  return out;
}
