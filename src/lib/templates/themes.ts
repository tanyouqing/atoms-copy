import { z } from "zod";
import { PIXEL_FONT_CSS } from "@/lib/vendor";

/**
 * 模板风格主题（docs/08 §2.3）。一套模板 × 多套主题：模板里的颜色、字体、圆角、阴影都引用 CSS 变量，
 * 每种风格就是一组变量值 + 少量结构样式（像素风的硬边框、明亮风的渐变按钮）。
 * 渲染时生成一行 <style id="app-theme">（不引入换行，模板行号保持稳定），放进模板 head 的 __APP_THEME__ 占位处。
 * 本文件不依赖服务端模块，首页的风格卡片和服务端渲染共用。
 */

export const THEME_STYLES = ["paper", "pixel", "bright"] as const;
export type ThemeStyle = (typeof THEME_STYLES)[number];
export const DEFAULT_STYLE: ThemeStyle = "paper";

/** 风格卡片与提示词用的元数据。swatch：卡片小预览的背景 / 卡片 / 文字 / 强调色。 */
export const STYLE_META: Record<ThemeStyle, { name: string; short: string; desc: string; swatch: { bg: string; surface: string; ink: string; accent: string } }> = {
  paper: { name: "暖纸墨色", short: "纸墨", desc: "暖白纸张、衬线标题、柔和阴影，安静耐看", swatch: { bg: "#f6f3ec", surface: "#fffdf9", ink: "#1f1c17", accent: "#c2410c" } },
  pixel: { name: "像素风", short: "像素", desc: "像素字体、粗描边、硬投影，复古游戏感", swatch: { bg: "#eef1f6", surface: "#ffffff", ink: "#181c28", accent: "#7c3aed" } },
  bright: { name: "明亮卡片", short: "明亮", desc: "通透白卡片、大圆角、渐变按钮，轻快活泼", swatch: { bg: "#f5f7fb", surface: "#ffffff", ink: "#0f172a", accent: "#2563eb" } },
};

export function isThemeStyle(v: unknown): v is ThemeStyle {
  return typeof v === "string" && (THEME_STYLES as readonly string[]).includes(v);
}

// ---------- 颜色工具 ----------

const HEX = /^#[0-9a-fA-F]{6}$/;
const hex = z
  .string()
  .trim()
  .transform((s) => (/^#[0-9a-fA-F]{3}$/.test(s) ? `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}` : s).toLowerCase())
  .pipe(z.string().regex(HEX, "颜色必须是 #RRGGBB"));

type RGB = [number, number, number];
const toRgb = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const toHex = (c: RGB) => `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
/** a→b 线性混合，t=0 为 a，t=1 为 b。 */
export function mix(a: string, b: string, t: number): string {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex([0, 1, 2].map((i) => x[i]! + (y[i]! - x[i]!) * t) as RGB);
}
export function luminance(h: string): number {
  const lin = toRgb(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}
export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

// ---------- 自定义风格 ----------

export const CUSTOM_FONTS = ["sans", "serif", "mono", "pixel"] as const;

/** 用户描述了内置三种以外的风格（如"赛博朋克"）时，模型输出的一组颜色变量。 */
export const CustomThemeSchema = z.object({
  name: z.string().trim().min(1).max(12),
  base: z.enum(THEME_STYLES),
  bg: hex,
  surface: hex,
  text: hex,
  accent: hex.optional(),
  font: z.enum(CUSTOM_FONTS).optional(),
});
export type CustomTheme = z.infer<typeof CustomThemeSchema>;

/**
 * 修正自定义颜色，保证可读：文字与背景、卡片对比度都 ≥ 4.5，不够时换成更清楚的深色 / 浅色；
 * 卡片和背景明暗相反导致文字顾此失彼时，卡片改为背景的轻微变体；强调色上的白字对比度 ≥ 4。
 */
export function safeCustom(c: CustomTheme): CustomTheme & { dark: boolean } {
  const dark = luminance(c.bg) < 0.2;
  let { text, surface, accent } = c;
  const ok = (t: string, s: string) => contrast(t, c.bg) >= 4.5 && contrast(t, s) >= 4.5;
  if (!ok(text, surface)) {
    const ink = dark ? "#f8fafc" : "#111827";
    text = ok(ink, surface) ? ink : text;
  }
  if (!ok(text, surface)) {
    text = dark ? "#f8fafc" : "#111827";
    surface = mix(c.bg, text, 0.05);
  }
  if (accent) {
    for (let i = 0; i < 12 && contrast("#ffffff", accent) < 4; i++) accent = mix(accent, "#000000", 0.1);
  }
  return { ...c, text, surface, accent, dark };
}

// ---------- 每种风格的变量 ----------

const SHADE_KEYS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
type Scale = Record<(typeof SHADE_KEYS)[number], string>;
const scale = (xs: string[]): Scale => Object.fromEntries(SHADE_KEYS.map((k, i) => [k, xs[i]!])) as Scale;

const SCALES: Record<ThemeStyle, Scale> = {
  paper: scale(["#f6f3ec", "#efeae0", "#e4ded2", "#d0c8b8", "#a59c8a", "#7b7364", "#5f584c", "#474137", "#2f2b24", "#1f1c17", "#15130f"]),
  pixel: scale(["#eef1f6", "#e3e7ef", "#cfd5e1", "#b3bccc", "#8790a5", "#646d82", "#4b5367", "#363d50", "#252b3b", "#181c28", "#0e1119"]),
  bright: scale(["#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b", "#475569", "#334155", "#1e293b", "#0f172a", "#020617"]),
};

const SURFACE: Record<ThemeStyle, { light: string; dark: string }> = {
  paper: { light: "#fffdf9", dark: "#1f1c17" },
  pixel: { light: "#ffffff", dark: "#1b2030" },
  bright: { light: "#ffffff", dark: "#0f172a" },
};

const FONT_STACK: Record<(typeof CUSTOM_FONTS)[number], string> = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
  serif: 'Georgia, "Times New Roman", "Songti SC", "STSong", serif',
  mono: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, "PingFang SC", monospace',
  pixel: '"Fusion Pixel 12px Proportional Simplified Chinese", ui-monospace, monospace',
};
const STYLE_FONT: Record<ThemeStyle, { sans: (typeof CUSTOM_FONTS)[number]; display: (typeof CUSTOM_FONTS)[number] }> = {
  paper: { sans: "sans", display: "serif" },
  pixel: { sans: "pixel", display: "pixel" },
  bright: { sans: "sans", display: "sans" },
};

/** 自定义颜色生成整套灰阶：浅色模式 50=背景、900=文字；深色模式 950=背景、50=文字。 */
function customScale(bg: string, text: string, dark: boolean): Scale {
  if (!dark) {
    const ts = [0, 0.05, 0.11, 0.2, 0.36, 0.5, 0.62, 0.74, 0.86, 1];
    return scale([...ts.map((t) => mix(bg, text, t)), mix(text, "#000000", 0.35)]);
  }
  const ts = [1, 0.93, 0.85, 0.74, 0.6, 0.48, 0.36, 0.24, 0.13, 0.06, 0];
  return scale(ts.map((t) => mix(bg, text, t)));
}

function accentShades(accent: string): string[] {
  return [mix("#ffffff", accent, 0.08), mix("#ffffff", accent, 0.16), mix("#ffffff", accent, 0.32), mix(accent, "#ffffff", 0.15), accent, mix(accent, "#000000", 0.2)];
}

const decls = (o: Record<string, string>) =>
  Object.entries(o)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");

/** 只放结构差异（描边、投影、圆角、字号），颜色全部来自变量。 */
const STRUCTURE: Record<ThemeStyle, string> = {
  paper: "",
  pixel: [
    ":root{-webkit-font-smoothing:none;-moz-osx-font-smoothing:grayscale;font-synthesis:none;--radius-xs:0;--radius-sm:0;--radius-md:0;--radius-lg:0;--radius-xl:0;--radius-2xl:0;--radius-3xl:0;--radius-4xl:0;--text-xs:12px;--text-sm:12px;--text-base:18px;--text-lg:18px;--text-xl:18px;--text-2xl:24px;--text-3xl:30px;--text-4xl:36px;--text-5xl:48px;--text-6xl:60px}",
    "body{background-image:linear-gradient(var(--px-grid) 1px,transparent 1px),linear-gradient(90deg,var(--px-grid) 1px,transparent 1px);background-size:24px 24px}",
    "*,::before,::after{border-radius:0!important}",
    "h1.font-display{font-size:24px;line-height:1.25;letter-spacing:0}",
    ".card{border-width:2px;border-color:var(--px-line);box-shadow:4px 4px 0 var(--px-shadow)}",
    "#modal-body{border:2px solid var(--px-line);box-shadow:6px 6px 0 var(--px-shadow)}",
    "#toast{border:2px solid var(--px-line);box-shadow:3px 3px 0 var(--px-shadow)}",
    ".btn{border:2px solid var(--px-line);box-shadow:3px 3px 0 var(--px-shadow);transition:transform .08s steps(2),box-shadow .08s steps(2)}",
    ".btn:not(:disabled):hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 var(--px-shadow)}",
    ".btn:not(:disabled):active{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--px-shadow)}",
    ".btn-ghost,.btn-ghost:not(:disabled):hover,.btn-ghost:not(:disabled):active{border-color:transparent;box-shadow:none;transform:none}",
    ".input{border-width:2px;border-color:var(--px-line)}",
    ".seg{border:2px solid var(--px-line);padding:2px}",
    ".seg-on{box-shadow:2px 2px 0 var(--px-shadow)}",
    ".shadow-sm,.shadow,.shadow-md,.shadow-lg,.shadow-xl,.shadow-2xl{--tw-shadow:3px 3px 0 var(--px-shadow)}",
    ".kbd{border-width:2px}",
    "canvas{image-rendering:pixelated}",
    "@media (prefers-reduced-motion:reduce){.btn,.btn:not(:disabled):hover,.btn:not(:disabled):active{transition:none;transform:none}}",
  ].join(""),
  bright: [
    ":root{--radius-md:.5rem;--radius-lg:.75rem;--radius-xl:1rem;--radius-2xl:1.5rem;--radius-3xl:2rem}",
    "body{background-image:radial-gradient(900px 480px at 0% -8%,color-mix(in srgb,var(--p-200) 60%,transparent),transparent 65%),radial-gradient(720px 420px at 100% 0%,color-mix(in srgb,var(--p-100) 80%,transparent),transparent 60%);background-attachment:fixed}",
    ":root.dark body{background-image:radial-gradient(900px 480px at 0% -8%,color-mix(in srgb,var(--p-700) 30%,transparent),transparent 65%),radial-gradient(720px 420px at 100% 0%,color-mix(in srgb,var(--p-600) 18%,transparent),transparent 60%)}",
    ".font-display{font-weight:700;letter-spacing:-.02em}",
    ".card{border-color:transparent}",
    ":root.dark .card{border-color:var(--color-slate-800)}",
    ".btn{border-radius:9999px}",
    ".btn-primary{background-image:linear-gradient(135deg,var(--p-500),var(--p-700));box-shadow:0 8px 18px -8px var(--p-500)}",
    ".btn-primary:not(:disabled):hover{box-shadow:0 10px 22px -8px var(--p-600);filter:brightness(1.05)}",
    ".seg,.seg-btn,.seg-on{border-radius:9999px}",
    ".input{background-color:var(--surface)}",
    "#modal-body{border-radius:1.75rem}",
    "#toast{border-radius:9999px}",
  ].join(""),
};

export interface ThemeInput {
  style?: string;
  mode?: "light" | "dark";
  custom?: CustomTheme;
}

export interface ResolvedTheme {
  style: ThemeStyle;
  custom: (CustomTheme & { dark: boolean }) | null;
  /** 自定义颜色决定明暗时以它为准，否则按配置。 */
  mode: "light" | "dark";
}

export function resolveTheme(t: ThemeInput | undefined): ResolvedTheme {
  const parsed = t?.custom ? CustomThemeSchema.safeParse(t.custom) : null;
  if (parsed?.success) {
    const custom = safeCustom(parsed.data);
    return { style: custom.base, custom, mode: custom.dark ? "dark" : "light" };
  }
  return { style: isThemeStyle(t?.style) ? t.style : DEFAULT_STYLE, custom: null, mode: t?.mode === "dark" ? "dark" : "light" };
}

/** 生成主题样式。结果不含换行。 */
export function buildThemeCss(t: ThemeInput | undefined): string {
  const r = resolveTheme(t);
  const s = r.style;
  const fonts = STYLE_FONT[s];
  const fontSans = FONT_STACK[r.custom?.font ?? fonts.sans];
  const fontDisplay = FONT_STACK[r.custom?.font ?? fonts.display];

  const root: Record<string, string> = { "--font-sans": fontSans, "--font-display": fontDisplay, "--font-mono": r.custom?.font === "pixel" || s === "pixel" ? FONT_STACK.pixel : FONT_STACK.mono };
  const dark: Record<string, string> = {};

  if (r.custom) {
    const c = r.custom;
    const sc = customScale(c.bg, c.text, c.dark);
    for (const k of SHADE_KEYS) root[`--color-slate-${k}`] = sc[k];
    root["--surface"] = c.surface;
    dark["--surface"] = c.surface;
    if (c.accent) accentShades(c.accent).forEach((v, i) => (root[`--accent-${[50, 100, 200, 500, 600, 700][i]}`] = v));
    root["--card-shadow"] = c.dark ? "0 1px 0 rgb(0 0 0/.2),0 12px 32px -18px rgb(0 0 0/.6)" : `0 1px 0 rgb(0 0 0/.03),0 10px 30px -20px ${mix(c.text, c.bg, 0.3)}`;
    root["--px-line"] = c.dark ? mix(c.bg, c.text, 0.45) : c.text;
    root["--px-shadow"] = c.dark ? "#000000" : c.text;
    root["--px-grid"] = mix(c.bg, c.text, 0.06);
  } else {
    const sc = SCALES[s];
    for (const k of SHADE_KEYS) root[`--color-slate-${k}`] = sc[k];
    root["--surface"] = SURFACE[s].light;
    dark["--surface"] = SURFACE[s].dark;
    if (s === "paper") {
      root["--card-shadow"] = "0 1px 0 rgb(31 28 23/.03),0 10px 30px -20px rgb(31 28 23/.35)";
      dark["--card-shadow"] = "0 1px 0 rgb(0 0 0/.2),0 10px 30px -20px rgb(0 0 0/.6)";
    } else if (s === "bright") {
      root["--card-shadow"] = "0 1px 2px rgb(15 23 42/.04),0 10px 30px -12px rgb(15 23 42/.16)";
      dark["--card-shadow"] = "0 1px 2px rgb(0 0 0/.3),0 16px 40px -16px rgb(0 0 0/.7)";
    } else {
      root["--px-line"] = sc[900];
      root["--px-shadow"] = sc[900];
      root["--px-grid"] = "rgb(24 28 40/.05)";
      dark["--px-line"] = sc[600];
      dark["--px-shadow"] = "#05070c";
      dark["--px-grid"] = "rgb(255 255 255/.03)";
    }
  }
  const darkCss = Object.keys(dark).length ? `:root.dark{${decls(dark)}}` : "";
  return `:root{${decls(root)}}${darkCss}${STRUCTURE[s]}`;
}

/** 模板 head 里 __APP_THEME__ 的替换内容（一行）：像素字体样式表（如需）+ 主题样式。 */
export function buildThemeHead(t: ThemeInput | undefined): string {
  const r = resolveTheme(t);
  const pixel = r.custom?.font === "pixel" || (r.style === "pixel" && !r.custom?.font);
  const link = pixel ? `<link rel="stylesheet" href="${PIXEL_FONT_CSS}">` : "";
  return `${link}<style id="app-theme">${buildThemeCss(t)}</style>`;
}
