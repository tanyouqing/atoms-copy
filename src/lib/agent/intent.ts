import type { TemplateId } from "@/lib/templates/registry";
import type { Intent, PmOutput } from "./schemas";

/** 意图强制修正（docs/07 §2）：模型判断不可信时以规则为准。 */
export function normalizeIntent(pm: Pick<PmOutput, "intent">, current: { configJson: string | null } | null): Intent {
  if (!current) return "new_app";
  if (pm.intent === "config_edit" && current.configJson === null) return "code_patch";
  if (pm.intent === "new_app") return "regenerate";
  return pm.intent;
}

/**
 * 模板能否做出用户要的东西。目前只校验 game：模板只有四种玩法，
 * 用户要 2048、俄罗斯方块等其他游戏时模型容易硬套成贪吃蛇，这时改走自由生成。
 */
const GAME_KINDS = /猜数|guess|翻牌|记忆|配对|memory|贪吃蛇|snake|问答|测验|答题|知识竞赛|题库|quiz|trivia/i;

export function templateFitsPrompt(templateId: TemplateId, prompt: string): boolean {
  if (templateId === "game") return GAME_KINDS.test(prompt);
  return true;
}
