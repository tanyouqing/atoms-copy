import { z } from "zod";
import { TEMPLATE_IDS } from "@/lib/templates/registry";
import { THEME_COLORS } from "@/lib/templates/schemas";
import { CustomThemeSchema, THEME_STYLES } from "@/lib/templates/themes";

export const PM_STYLES = [...THEME_STYLES, "custom"] as const;

/** 产品经理输出（docs/07 §3.1）。 */
export const INTENTS = ["new_app", "config_edit", "code_patch", "regenerate"] as const;
export type Intent = (typeof INTENTS)[number];

export const PmOutputSchema = z.object({
  intent: z.enum(INTENTS),
  templateId: z.enum(TEMPLATE_IDS as unknown as [string, ...string[]]).nullable(),
  appName: z.string().trim().min(1).max(20),
  versionLabel: z.string().trim().min(1).max(16),
  reply: z.string().trim().min(1).max(120),
  features: z.array(z.string().max(40)).min(1).max(6),
  changes: z.array(z.string().max(80)).max(8),
  // 用户要求里所选模板做不到的功能；不为空时服务端改走自由生成
  unsupported: z.array(z.string().max(60)).max(8).default([]),
  language: z.enum(["zh-CN", "en"]),
  themeColor: z.enum(THEME_COLORS),
  // 风格主题（docs/07 §3.1）。都是可选的：模型漏写或写错时由服务端按"用户选择 → 当前风格 → 默认"补齐
  style: z.enum(PM_STYLES).optional().catch(undefined),
  customTheme: CustomThemeSchema.optional().catch(undefined),
  // 这次修改只换风格（不改内容），模板应用可以直接换主题、不必重新生成配置
  styleOnly: z.boolean().optional().catch(undefined),
});
export type PmOutput = z.infer<typeof PmOutputSchema>;

export const RuntimeErrorSchema = z.object({
  type: z.enum(["static", "error", "unhandledrejection", "console"]),
  message: z.string().max(2000).transform((s) => s.slice(0, 500)),
  line: z.number().int().nonnegative().optional(),
  col: z.number().int().nonnegative().optional(),
  stack: z
    .string()
    .max(5000)
    .transform((s) => s.slice(0, 1000))
    .optional(),
});
