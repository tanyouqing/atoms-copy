import { CustomThemeSchema, DEFAULT_STYLE, STYLE_META, isThemeStyle, type CustomTheme, type ThemeStyle } from "@/lib/templates/themes";
import type { PmOutput } from "./schemas";

/** 一次生成最终采用的风格：内置风格，或在某个内置风格的形状上换一套颜色。 */
export interface StylePick {
  style: ThemeStyle;
  custom?: CustomTheme;
}

/** 从已有版本读出当前风格：优先模板配置里的 theme，其次 PM 计划里记下的风格。 */
export function styleOfVersion(config: unknown, plan: Pick<PmOutput, "style" | "customTheme"> | null): StylePick | null {
  const theme = (config as { theme?: { style?: unknown; custom?: unknown } } | null)?.theme;
  const custom = CustomThemeSchema.safeParse(theme?.custom);
  if (custom.success) return { style: custom.data.base, custom: custom.data };
  if (isThemeStyle(theme?.style)) return { style: theme.style };
  if (plan?.style === "custom" && plan.customTheme) return { style: plan.customTheme.base, custom: plan.customTheme };
  if (isThemeStyle(plan?.style)) return { style: plan.style };
  return null;
}

/**
 * 决定这一轮的风格（docs/07 §2.1）：
 * - 用户在文字里描述了别的风格（PM 输出 custom + 合法的颜色）→ 自定义；
 * - 新建：用户在风格卡片上选的 > PM 选的内置风格 > 默认；
 * - 修改：PM 明确给了和当前不同的内置风格才换，否则保持当前。
 */
export function decideStyle(a: { pm: Pick<PmOutput, "style" | "customTheme">; picked: ThemeStyle | null; current: StylePick | null; isNew: boolean }): StylePick {
  if (a.pm.style === "custom" && a.pm.customTheme) return { style: a.pm.customTheme.base, custom: a.pm.customTheme };
  const pmBuiltin = isThemeStyle(a.pm.style) ? a.pm.style : null;
  if (a.isNew) return { style: a.picked ?? pmBuiltin ?? DEFAULT_STYLE };
  if (pmBuiltin && (a.current?.custom || pmBuiltin !== a.current?.style)) return { style: pmBuiltin };
  return a.current ?? { style: a.picked ?? DEFAULT_STYLE };
}

/** 把风格写进模板配置的 theme（服务端决定，不依赖模型是否照抄）。 */
export function applyStyle<T>(config: T, pick: StylePick): T {
  if (!config || typeof config !== "object") return config;
  const c = config as { theme?: Record<string, unknown> };
  const theme: Record<string, unknown> = { ...(c.theme ?? {}), style: pick.style };
  if (pick.custom) theme.custom = pick.custom;
  else delete theme.custom;
  return { ...c, theme } as T;
}

export function styleName(pick: StylePick): string {
  return pick.custom ? pick.custom.name : STYLE_META[pick.style].name;
}

export function sameStyle(a: StylePick | null, b: StylePick): boolean {
  if (!a) return false;
  return a.style === b.style && JSON.stringify(a.custom ?? null) === JSON.stringify(b.custom ?? null);
}
