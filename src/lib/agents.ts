import type { VersionSource } from "@/types/api";

/** 智能体角色（docs/02 §2.1）。 */
export const AGENTS = {
  pm: { name: "Mia · 产品经理", color: "#8B5CF6", initial: "M", duty: "理解需求，选模板，列功能" },
  engineer: { name: "Leo · 工程师", color: "#0EA5E9", initial: "L", duty: "写配置或代码，打补丁" },
  qa: { name: "Iris · 测试员", color: "#F59E0B", initial: "I", duty: "运行检查，发现问题让工程师修" },
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
