import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { staticCheck } from "@/lib/agent/qa-static";
import { PmOutputSchema } from "@/lib/agent/schemas";
import { applyStyle, decideStyle, styleOfVersion } from "@/lib/agent/style";
import { buildSrcdoc } from "@/lib/preview/build-srcdoc";
import { TEMPLATE_IDS } from "@/lib/templates/registry";
import { loadExample, renderTemplate } from "@/lib/templates/render";
import { TEMPLATE_SCHEMAS } from "@/lib/templates/schemas";
import { THEME_STYLES, buildThemeCss, buildThemeHead, contrast, resolveTheme, safeCustom, type CustomTheme } from "@/lib/templates/themes";
import { PIXEL_FONT_CSS, VENDOR_STYLES, toLocalVendor } from "@/lib/vendor";

const CYBER: CustomTheme = { name: "赛博朋克", base: "bright", bg: "#0b0b1a", surface: "#15152e", text: "#e6f1ff", accent: "#ff2bd6", font: "mono" };
const withTheme = (cfg: unknown, theme: Record<string, unknown>) => {
  const c = cfg as { theme: Record<string, unknown> };
  return { ...c, theme: { ...c.theme, ...theme } };
};
const tplLines = (id: string) => fs.readFileSync(path.join(process.cwd(), "templates", id, "template.html"), "utf8").split("\n").length;

describe("风格主题", () => {
  const variants: [string, Record<string, unknown>][] = [...THEME_STYLES.map((s) => [s, { style: s }] as [string, Record<string, unknown>]), ["custom", { custom: CYBER }]];

  describe.each(TEMPLATE_IDS)("%s", (id) => {
    it.each(variants)("%s 风格渲染通过静态检查，主题只占一行", (_name, theme) => {
      const html = renderTemplate(id, withTheme(loadExample(id), theme));
      expect(staticCheck(html)).toEqual([]);
      expect(html).not.toContain("__APP_THEME__");
      expect(html).toMatch(/<style id="app-theme">[^\n]+<\/style>/);
      // 行号稳定：渲染前后行数一致（修复提示词依赖行号）
      expect(html.split("\n").length).toBe(tplLines(id));
    });
  });

  it("缺省风格是暖纸墨色；非法风格回退默认、非法自定义颜色被丢弃", () => {
    const base = loadExample("todo");
    expect(TEMPLATE_SCHEMAS.todo.parse(base).theme.style).toBe("paper");
    expect(TEMPLATE_SCHEMAS.todo.parse(withTheme(base, { style: "neon" })).theme.style).toBe("paper");
    const bad = TEMPLATE_SCHEMAS.todo.parse(withTheme(base, { style: "pixel", custom: { name: "x", base: "pixel", bg: "red" } }));
    expect(bad.theme.style).toBe("pixel");
    expect(bad.theme.custom).toBeUndefined();
  });

  it("深色自定义背景自动切到深色模式，style 跟随 base", () => {
    const t = TEMPLATE_SCHEMAS.todo.parse(withTheme(loadExample("todo"), { mode: "light", style: "paper", custom: CYBER })).theme;
    expect(t.mode).toBe("dark");
    expect(t.style).toBe("bright");
  });

  it("自定义颜色对比度不够时自动修正", () => {
    const c = safeCustom({ name: "雾", base: "paper", bg: "#f0f0f0", surface: "#ffffff", text: "#d0d0d0", accent: "#fde047" });
    expect(contrast(c.text, c.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.text, c.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", c.accent!)).toBeGreaterThanOrEqual(4);
    // 深色背景配白卡片：文字无法同时满足，卡片改成背景的变体
    const d = safeCustom({ name: "夜", base: "bright", bg: "#000000", surface: "#ffffff", text: "#ffffff" });
    expect(contrast(d.text, d.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("像素风带字体样式表，其他风格不带；主题样式不含换行", () => {
    expect(buildThemeHead({ style: "pixel" })).toContain(`<link rel="stylesheet" href="${PIXEL_FONT_CSS}">`);
    expect(buildThemeHead({ style: "bright" })).not.toContain("<link");
    expect(buildThemeHead({ custom: { ...CYBER, font: "pixel" } })).toContain(PIXEL_FONT_CSS);
    for (const s of THEME_STYLES) expect(buildThemeCss({ style: s })).not.toContain("\n");
    expect(buildThemeCss({ custom: CYBER })).toContain("--accent-600:");
    expect(resolveTheme({ style: "pixel", mode: "dark" })).toMatchObject({ style: "pixel", mode: "dark", custom: null });
  });

  it("像素字体只允许白名单地址，预览时换成本站地址", () => {
    const html = renderTemplate("todo", withTheme(loadExample("todo"), { style: "pixel" }));
    expect(staticCheck(html)).toEqual([]);
    expect(staticCheck(html.replace(PIXEL_FONT_CSS, "https://example.com/x.css")).some((e) => e.message.includes("外部样式表"))).toBe(true);
    const local = toLocalVendor(html, "http://1.2.3.4");
    expect(local).toContain(`http://1.2.3.4${VENDOR_STYLES[0].local}`);
    expect(buildSrcdoc({ html, channel: "c", storage: {}, origin: "http://h" }).split("\n").length).toBe(html.split("\n").length);
    expect(fs.existsSync(path.join(process.cwd(), "public", VENDOR_STYLES[0].local))).toBe(true);
  });
});

describe("风格决策", () => {
  const pm = (o: Record<string, unknown> = {}) => o as { style?: "paper" | "pixel" | "bright" | "custom"; customTheme?: CustomTheme };

  it("新建：卡片选择优先，其次 PM，最后默认；文字描述的自定义风格最优先", () => {
    expect(decideStyle({ pm: pm({ style: "bright" }), picked: "pixel", current: null, isNew: true })).toEqual({ style: "pixel" });
    expect(decideStyle({ pm: pm({ style: "bright" }), picked: null, current: null, isNew: true })).toEqual({ style: "bright" });
    expect(decideStyle({ pm: pm(), picked: null, current: null, isNew: true })).toEqual({ style: "paper" });
    expect(decideStyle({ pm: pm({ style: "custom", customTheme: CYBER }), picked: "pixel", current: null, isNew: true })).toEqual({ style: "bright", custom: CYBER });
  });

  it("修改：PM 没说换风格时保持当前（包括自定义）", () => {
    const cur = { style: "bright" as const, custom: CYBER };
    expect(decideStyle({ pm: pm(), picked: null, current: cur, isNew: false })).toEqual(cur);
    expect(decideStyle({ pm: pm({ style: "pixel" }), picked: null, current: { style: "paper" }, isNew: false })).toEqual({ style: "pixel" });
    expect(decideStyle({ pm: pm({ style: "bright" }), picked: null, current: cur, isNew: false })).toEqual({ style: "bright" });
  });

  it("applyStyle 写入 theme 并清掉旧的自定义颜色；styleOfVersion 读回", () => {
    const cfg = withTheme(loadExample("todo"), { custom: CYBER });
    const next = applyStyle(cfg, { style: "pixel" }) as { theme: Record<string, unknown> };
    expect(next.theme.style).toBe("pixel");
    expect(next.theme.custom).toBeUndefined();
    expect(styleOfVersion(next, null)).toEqual({ style: "pixel" });
    expect(styleOfVersion(cfg, null)).toEqual({ style: "bright", custom: CYBER });
    expect(styleOfVersion(null, { style: "bright" })).toEqual({ style: "bright" });
  });

  it("PM 输出的风格字段写错时不影响整体解析", () => {
    const base = { intent: "new_app", templateId: "todo", appName: "a", versionLabel: "b", reply: "c", features: ["d"], changes: [], language: "zh-CN", themeColor: "indigo" };
    const r = PmOutputSchema.parse({ ...base, style: "vaporwave", customTheme: { name: "x" }, styleOnly: "yes" });
    expect(r.style).toBeUndefined();
    expect(r.customTheme).toBeUndefined();
    expect(r.styleOnly).toBeUndefined();
    expect(PmOutputSchema.parse({ ...base, style: "custom", customTheme: CYBER }).customTheme).toEqual(CYBER);
  });
});
