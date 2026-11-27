import type { VersionSource } from "@/types/api";

/** 智能体角色（docs/02 §2.1）。头像是 src/components/ui/avatar.tsx 里的插画，颜色同 globals.css 的 --pm / --engineer / --qa。 */
export const AGENTS = {
  pm: { name: "Mia · 产品经理", short: "Mia", title: "产品经理", color: "#D4932A", tint: "#FBEFD9", initial: "M", duty: "理解需求，选模板，列功能", busy: "Mia 正在梳理需求" },
  engineer: { name: "Leo · 工程师", short: "Leo", title: "工程师", color: "#2F6DB5", tint: "#E2ECF8", initial: "L", duty: "写配置或代码，打补丁", busy: "Leo 正在写代码" },
  qa: { name: "Iris · 测试员", short: "Iris", title: "测试员", color: "#2F8A57", tint: "#E0F1E6", initial: "I", duty: "运行检查，发现问题让工程师修", busy: "Iris 正在逐项检查" },
} as const;

export type AgentRole = keyof typeof AGENTS;

export const SOURCE_LABELS: Record<VersionSource, string> = {
  template: "模板",
  config_edit: "配置",
  free: "自由生成",
  patch: "补丁",
  fix: "修复",
  manual: "手动",
};
