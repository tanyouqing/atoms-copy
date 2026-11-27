/** 首页示例提示词（docs/02 §4.1）。 */
export const PROMPT_MAX = 2000;

export const EXAMPLES = [
  { title: "习惯打卡", emoji: "✅", prompt: "做一个每日习惯打卡应用，可以添加习惯，每天打卡，显示连续打卡天数和最近 7 天的完成情况" },
  { title: "个人记账", emoji: "💰", prompt: "做一个个人记账本，记录收入和支出，按分类统计本月花销，并用饼图展示支出构成" },
  { title: "招聘看板", emoji: "📋", prompt: "做一个招聘流程看板，列分别是：待筛选、一面、二面、Offer、已入职，卡片记录候选人姓名、岗位和备注" },
  { title: "记忆翻牌", emoji: "🎮", prompt: "做一个记忆翻牌小游戏，用水果 emoji，记录步数和用时，保存最好成绩" },
] as const;
