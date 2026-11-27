/** 模板元数据（docs/08 §3）。suits / notSuits 会拼进 PM 提示词的"可用模板"一节。 */
export const TEMPLATES = [
  { id: "todo", name: "待办清单", suits: "任务清单、习惯打卡、购物清单、阅读清单、目标追踪、喝水记录", notSuits: "多阶段流程（用 kanban）、金额统计（用 ledger）", usesChart: false },
  { id: "ledger", name: "记账本", suits: "收支记账、预算管理、账单记录、零花钱、报销记录", notSuits: "非金额的数据记录（用 crud）", usesChart: true },
  { id: "form", name: "表单收集", suits: "报名表、问卷、反馈、预约登记、投票", notSuits: "需要长期管理记录的（用 crud）", usesChart: false },
  { id: "kanban", name: "看板", suits: "项目管理、招聘流程、销售线索、内容排期等\"卡片在多个阶段间移动\"的场景", notSuits: "单列清单（用 todo）", usesChart: false },
  { id: "landing", name: "落地页", suits: "产品介绍、个人主页、活动宣传、作品集、餐厅/店铺介绍", notSuits: "有数据增删改的工具类应用", usesChart: false },
  { id: "dashboard", name: "数据仪表盘", suits: "指标看板、数据报表、运营监控、成绩分析、健身数据可视化", notSuits: "需要逐条录入数据（用 ledger 或 crud）", usesChart: true },
  { id: "game", name: "小游戏", suits: "只能做这四种：猜数字、记忆翻牌、贪吃蛇、知识问答/测验", notSuits: "其他任何游戏，例如 2048、俄罗斯方块、扫雷、五子棋、打砖块（templateId 填 null）", usesChart: false },
  { id: "crud", name: "通用记录管理", suits: "通讯录、书单、库存、客户管理、菜谱、学生名单等\"一类实体的增删改查\"", notSuits: "有特殊交互的应用", usesChart: false },
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
