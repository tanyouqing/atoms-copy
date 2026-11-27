import type { TemplateId } from "./registry";

/**
 * 各模板里"用户自己录入的数据"对应的 seed 字段。新建应用时清空，应用从空白状态开始。
 * dashboard / landing / game 的数据是页面内容本身（图表、文案、题目），不属于用户数据，保留。
 */
export const USER_DATA_SEEDS: Partial<Record<TemplateId, string>> = {
  todo: "seedItems",
  ledger: "seedEntries",
  form: "seedResponses",
  kanban: "seedCards",
  crud: "seedRecords",
};

/** 返回去掉示例用户数据的配置副本（非对象或无对应字段时原样返回）。 */
export function stripSeedData<T>(templateId: TemplateId, config: T): T {
  const key = USER_DATA_SEEDS[templateId];
  if (!key || !config || typeof config !== "object" || !(key in config)) return config;
  return { ...config, [key]: [] };
}
