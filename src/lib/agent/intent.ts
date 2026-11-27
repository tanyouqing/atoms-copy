import type { Intent, PmOutput } from "./schemas";

/** 意图强制修正（docs/07 §2）：模型判断不可信时以规则为准。 */
export function normalizeIntent(pm: Pick<PmOutput, "intent">, current: { configJson: string | null } | null): Intent {
  if (!current) return "new_app";
  if (pm.intent === "config_edit" && current.configJson === null) return "code_patch";
  if (pm.intent === "new_app") return "regenerate";
  return pm.intent;
}
