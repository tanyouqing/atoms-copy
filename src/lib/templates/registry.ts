/** 模板元数据（docs/08 §3）。suits / notSuits / can / cannot 会拼进 PM 提示词的"可用模板"一节。 */
export const TEMPLATES = [
  { id: "todo", name: "待办清单", suits: "任务清单、习惯打卡、购物清单、阅读清单、目标追踪、喝水记录", notSuits: "多阶段流程（用 kanban）、金额统计（用 ledger）", can: "清单的增删改、勾选完成、分类筛选、截止日期和优先级、完成进度条；习惯模式下每行显示最近 7 天的打卡格子和连续天数", cannot: "月历/日历视图、计时或提醒、统计图表、数值累计汇总（如每次游了多少米、总时长）、超过 7 天的打卡历史", usesChart: false },
  { id: "ledger", name: "记账本", suits: "收支记账、预算管理、账单记录、零花钱、报销记录", notSuits: "非金额的数据记录（用 crud）", can: "收支记账、收支分类、月预算进度、按月查看流水、分类饼图和每日支出柱状图", cannot: "多账户和转账、多币种换算、按年或自定义区间统计、非金额的数据记录", usesChart: true },
  { id: "form", name: "表单收集", suits: "报名表、问卷、反馈、预约登记、投票", notSuits: "需要长期管理记录的（用 crud）", can: "各类字段的表单填写和校验、提交成功页、已收集列表和 CSV 导出", cannot: "多步骤/分页表单、按答案显示或隐藏字段、自动计分、投票结果图表", usesChart: false },
  { id: "kanban", name: "看板", suits: "项目管理、招聘流程、销售线索、内容排期等\"卡片在多个阶段间移动\"的场景", notSuits: "单列清单（用 todo）", can: "多列看板、拖拽卡片换列、卡片自定义字段、每列数量上限", cannot: "甘特图/时间线、日历视图、子任务清单、统计图表", usesChart: false },
  { id: "landing", name: "落地页", suits: "产品介绍、个人主页、活动宣传、作品集、餐厅/店铺介绍", notSuits: "有数据增删改的工具类应用", can: "单页介绍：导航、首屏和若干内容区块（功能、数据、步骤、评价、价格、FAQ、图集、联系方式），可留邮箱", cannot: "多页面、文章列表、购物车、真实图片、留邮箱以外的任何数据录入和管理", usesChart: false },
  { id: "dashboard", name: "数据仪表盘", suits: "指标看板、数据报表、运营监控、成绩分析、健身数据可视化", notSuits: "需要逐条录入数据（用 ledger 或 crud）", can: "2-6 个指标卡、1-4 个图表、可排序的数据表格、手动编辑数据", cannot: "逐条录入数据并自动统计、实时数据、筛选联动", usesChart: true },
  { id: "game", name: "小游戏", suits: "只能做这四种：猜数字、记忆翻牌、贪吃蛇、知识问答/测验", notSuits: "其他任何游戏，例如 2048、俄罗斯方块、扫雷、五子棋、打砖块（templateId 填 null）", can: "只有四种玩法：猜数字、记忆翻牌、贪吃蛇、知识问答，可调参数和文案", cannot: "这四种以外的任何游戏（2048、俄罗斯方块、扫雷、五子棋、打砖块等）、多人对战", usesChart: false },
  { id: "crud", name: "通用记录管理", suits: "通讯录、书单、库存、客户管理、菜谱、学生名单等\"一类实体的增删改查\"", notSuits: "有特殊交互的应用", can: "一类记录的增删改查、搜索、筛选、排序、表格/卡片视图、CSV 导入导出", cannot: "多种记录之间的关联、统计图表、日历视图、计时功能、跨记录的计算汇总", usesChart: false },
] as const;

export type TemplateId = (typeof TEMPLATES)[number]["id"];
export type TemplateMeta = (typeof TEMPLATES)[number];

export const TEMPLATE_IDS = TEMPLATES.map((t) => t.id) as readonly TemplateId[];

export function isTemplateId(v: unknown): v is TemplateId {
  return typeof v === "string" && (TEMPLATE_IDS as readonly string[]).includes(v);
}

export function getTemplateMeta(id: TemplateId): TemplateMeta {
  const meta = TEMPLATES.find((t) => t.id === id);
  if (!meta) throw new Error(`未知模板：${id}`);
  return meta;
}
