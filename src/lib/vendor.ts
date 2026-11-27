/**
 * 生成的应用允许引用的外部脚本与样式表白名单（见 docs/03-tech-stack.md §2.3）。
 * 存储 / 下载的 HTML 中写 CDN 地址；预览与分享页渲染时替换为本站 /vendor/* 地址。
 */
export const TAILWIND_CDN = "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.3.5";
export const CHARTJS_CDN = "https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js";

export const VENDOR_SCRIPTS = [
  { name: "tailwind", cdn: TAILWIND_CDN, local: "/vendor/tailwindcss-browser.js" },
  { name: "chartjs", cdn: CHARTJS_CDN, local: "/vendor/chart.umd.min.js" },
] as const;

export const ALLOWED_SCRIPT_SRCS: readonly string[] = VENDOR_SCRIPTS.map((v) => v.cdn);

/**
 * 像素风主题用的 Fusion Pixel 字体（OFL-1.1，按 unicode-range 拆成约 30KB 的小块，只加载页面用到的字）。
 * 和脚本一样：存储 / 下载的 HTML 写 CDN 地址，预览与分享时换成本站 /vendor/fusion-pixel/。
 */
export const PIXEL_FONT_CSS = "https://cdn.jsdelivr.net/npm/@vp-tw/cjk-web-fonts-fusion-pixel-font@0.0.1/dist/12px/proportional/zh_hans/Fusion-Pixel-12px-Proportional-Simplified-Chinese.css";
export const VENDOR_STYLES = [{ name: "fusion-pixel", cdn: PIXEL_FONT_CSS, local: "/vendor/fusion-pixel/Fusion-Pixel-12px-Proportional-Simplified-Chinese.css" }] as const;
export const ALLOWED_STYLE_HREFS: readonly string[] = VENDOR_STYLES.map((v) => v.cdn);

/** 把 HTML 中的 CDN 地址替换为 `<origin>/vendor/*`；只做字符串替换，不改变行数。 */
export function toLocalVendor(html: string, origin: string): string {
  let out = html;
  for (const v of [...VENDOR_SCRIPTS, ...VENDOR_STYLES]) out = out.split(v.cdn).join(origin + v.local);
  return out;
}
