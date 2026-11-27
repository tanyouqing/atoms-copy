import type { TemplateId } from "@/lib/templates/registry";

/** 首页示例提示词（docs/02 §4.1）。 */
export const PROMPT_MAX = 2000;

export const EXAMPLES = [
  { title: "习惯打卡", template: "todo", prompt: "做一个每日习惯打卡应用，可以添加习惯，每天打卡，显示连续打卡天数和最近 7 天的完成情况" },
  { title: "个人记账", template: "ledger", prompt: "做一个个人记账本，记录收入和支出，按分类统计本月花销，并用饼图展示支出构成" },
  { title: "招聘看板", template: "kanban", prompt: "做一个招聘流程看板，列分别是：待筛选、一面、二面、Offer、已入职，卡片记录候选人姓名、岗位和备注" },
  { title: "记忆翻牌", template: "game", prompt: "做一个记忆翻牌小游戏，用水果 emoji，记录步数和用时，保存最好成绩" },
] as const satisfies readonly { title: string; template: TemplateId; prompt: string }[];

/** 首页模板墙：每个模板一句人话介绍 + 一条可以直接填进输入框的需求。 */
export const TEMPLATE_SHOWCASE: Record<TemplateId, { blurb: string; prompt: string }> = {
  todo: { blurb: "清单、打卡、目标，勾一下就算数", prompt: "做一个读书清单，记录想读和读完的书，可以按分类筛选，显示今年读完了几本" },
  ledger: { blurb: "收支流水、月预算、分类饼图", prompt: "做一个家庭记账本，区分收入支出，设置每月预算，超支时提醒，并用饼图展示支出分类" },
  form: { blurb: "报名、问卷、预约，收完导出 CSV", prompt: "做一个周末徒步活动报名表，收集姓名、手机号、人数和是否自带装备，可以导出报名名单" },
  kanban: { blurb: "卡片在几列之间拖来拖去", prompt: "做一个内容排期看板，列分别是：选题、写作中、待审核、已发布，卡片记录标题、作者和截止日期" },
  landing: { blurb: "一页讲清楚一个产品或一个人", prompt: "做一个独立咖啡馆的介绍页，包括招牌饮品、营业时间、店内环境和联系方式" },
  dashboard: { blurb: "指标卡 + 图表 + 可排序表格", prompt: "做一个跑步数据仪表盘，展示本月跑量、平均配速、最长距离，用折线图展示每周跑量" },
  game: { blurb: "猜数字、翻牌、贪吃蛇、答题", prompt: "做一个贪吃蛇小游戏，可以调速度，记录历史最高分" },
  crud: { blurb: "任何一类东西的增删改查", prompt: "做一个家里的药品管理，记录药名、用途、数量和过期日期，可以搜索，快过期的排在前面" },
};
