# 08 · 应用模板与生成物设计规范

> 模板是"低成本模型下保质量"的第一层兜底。8 个模板由编码智能体在开发时手写，命中模板时模型只输出 `APP_CONFIG` JSON。本文件定义：生成物的设计规范（§2）、模板选择规则（§3）、每个模板的配置契约和功能要求（§4）、模板文件的工程规范（§5）。

## 1. 生成物通用约束（模板和自由生成都适用）

- 单个 HTML 文件，`<!DOCTYPE html>` 开头，`lang` 属性按配置语言（`zh-CN` / `en`）。
- 只引用两个外部脚本：Tailwind Browser 和（需要时）Chart.js，地址严格等于 `src/lib/vendor.ts` 中的 CDN 地址。
- 原生 JavaScript，单个 `<script>` 放在 `<body>` 末尾；不使用 module、import、框架。
- 数据存 localStorage，键名前缀 `app:`；所有读写 try/catch。
- 响应式：375px 宽可用；内容最大宽度 `max-w-3xl`（工具类）或 `max-w-6xl`（看板、仪表盘、落地页）。
- 无网络请求、无外部图片（用 emoji / 内联 SVG / CSS 渐变）。

## 2. 设计规范与组件片段（自由生成提示词的 `{{DESIGN_SPEC}}` / `{{SNIPPETS}}`）

以下两段文字原样保存在 `src/lib/agent/design-spec.ts` 中（导出为字符串常量 `DESIGN_SPEC`、`SNIPPETS`）。模板也遵守同样的规范，保证两条路径的产物风格一致。

### 2.1 `DESIGN_SPEC`

```text
- 整体风格：简洁现代，浅色背景 bg-slate-50，内容放在白色卡片 bg-white 中，卡片 rounded-2xl border border-slate-200 shadow-sm p-5 或 p-6。
- 主色：用指定主色色系。主按钮 bg-{c}-600 hover:bg-{c}-700 text-white；选中态和标签 bg-{c}-50 text-{c}-700；强调文字 text-{c}-600。其余用 slate 灰阶。
- 字体：默认系统字体，不引入网络字体。标题 text-2xl font-bold text-slate-900；小标题 text-lg font-semibold；正文 text-sm text-slate-600；辅助文字 text-xs text-slate-400。
- 间距：页面 px-4 py-8（手机）/ md:px-8；区块之间 space-y-6；表单项之间 space-y-4。
- 圆角：卡片 rounded-2xl，按钮和输入框 rounded-xl，标签 rounded-full。
- 输入框：w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-{c}-500。
- 页面顶部有一个标题区：emoji 图标 + 应用名 + 一行副标题。
- 列表为空时显示空状态：居中 emoji + 一句引导文案 + 主按钮。
- 交互反馈：操作成功后在页面底部中间显示 2 秒的提示条（toast），删除操作需要确认（用页面内弹窗，不用 confirm）。
- 动效：只用 transition 和 hover 效果，不做复杂动画。
- 数字统计用醒目的大号数字 text-3xl font-bold。
```

### 2.2 `SNIPPETS`

```html
<!-- 主按钮 -->
<button class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition">➕ 添加</button>
<!-- 次按钮 -->
<button class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">取消</button>
<!-- 卡片 -->
<section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"> … </section>
<!-- 表单项 -->
<label class="block space-y-1"><span class="text-sm font-medium text-slate-700">标题</span>
  <input class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></label>
<!-- 统计卡 -->
<div class="rounded-2xl border border-slate-200 bg-white p-5"><div class="text-xs text-slate-400">本月支出</div><div class="mt-1 text-3xl font-bold text-slate-900">¥1,280</div></div>
<!-- 标签 -->
<span class="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">进行中</span>
<!-- 表格 -->
<div class="overflow-x-auto"><table class="w-full text-sm"><thead class="text-left text-xs text-slate-400"><tr><th class="py-2">名称</th></tr></thead>
<tbody class="divide-y divide-slate-100"><tr><td class="py-2">…</td></tr></tbody></table></div>
<!-- 弹窗 -->
<div id="modal" class="fixed inset-0 z-50 hidden items-center justify-center bg-black/40 p-4">
  <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"> … </div></div>
<!-- 空状态 -->
<div class="py-12 text-center"><div class="text-4xl">📭</div><p class="mt-2 text-sm text-slate-500">还没有内容，点击上方按钮添加</p></div>
<!-- toast -->
<div id="toast" class="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white opacity-0 transition"></div>
<script>
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.style.opacity='1';clearTimeout(t._h);t._h=setTimeout(()=>t.style.opacity='0',2000);}
function load(key,fallback){try{const v=localStorage.getItem(key);return v?JSON.parse(v):fallback;}catch(e){return fallback;}}
function save(key,val){try{localStorage.setItem(key,JSON.stringify(val));}catch(e){}}
</script>
```

## 3. 模板清单与选择规则

`src/lib/templates/registry.ts` 导出：

```ts
export const TEMPLATES = [
  { id: "todo", name: "待办清单", suits: "任务清单、习惯打卡、购物清单、阅读清单、目标追踪", notSuits: "需要多列流转的流程（用 kanban）" },
  ...
] as const;
```

| id | 名称 | 适合（suits） | 不适合（notSuits） | 依赖 Chart.js |
|---|---|---|---|---|
| `todo` | 待办清单 | 任务清单、习惯打卡、购物清单、阅读清单、目标追踪、喝水记录 | 多阶段流程（用 kanban）、金额统计（用 ledger） | 否 |
| `ledger` | 记账本 | 收支记账、预算管理、账单记录、零花钱、报销记录 | 非金额的数据记录（用 crud） | 是 |
| `form` | 表单收集 | 报名表、问卷、反馈、预约登记、投票 | 需要长期管理记录的（用 crud） | 否 |
| `kanban` | 看板 | 项目管理、招聘流程、销售线索、内容排期等"卡片在多个阶段间移动"的场景 | 单列清单（用 todo） | 否 |
| `landing` | 落地页 | 产品介绍、个人主页、活动宣传、作品集、餐厅/店铺介绍 | 有数据增删改的工具类应用 | 否 |
| `dashboard` | 数据仪表盘 | 指标看板、数据报表、运营监控、成绩分析、健身数据可视化 | 需要逐条录入数据（用 ledger 或 crud） | 是 |
| `game` | 小游戏 | 只能做这四种：猜数字、记忆翻牌、贪吃蛇、知识问答/测验 | 其他任何游戏，例如 2048、俄罗斯方块、扫雷、五子棋、打砖块（templateId 填 null） | 否 |
| `crud` | 通用记录管理 | 通讯录、书单、库存、客户管理、菜谱、学生名单等"一类实体的增删改查" | 有特殊交互的应用 | 否 |

每个模板还有"能做（can）/ 做不到（cannot）"两项，同样拼进 PM 提示词，PM 按用户要求逐条核对；原文见 `src/lib/templates/registry.ts`：

| id | 能做 | 做不到 |
|---|---|---|
| `todo` | 清单的增删改、勾选完成、搜索、分类和状态筛选、多种排序、截止日期和优先级（逾期提醒）、备注、完成进度和统计数字、删除可撤销；习惯模式下每行显示最近 7 天的打卡格子和连续天数，详情里可看最近 5 周打卡热力图、最长连续和累计次数、补打卡 | 月历/日历视图、计时或提醒、统计图表、数值累计汇总（如每次游了多少米、总时长）、超过 5 周的打卡历史、子任务 |
| `ledger` | 收支记账、收支分类、月预算进度和日均可花、按月查看流水、编辑和删除记录（可撤销）、流水搜索和收支筛选、较上月变化、支出排行、分类饼图和每日支出柱状图、导出本月 CSV | 多账户和转账、多币种换算、按年或自定义区间统计、非金额的数据记录 |
| `form` | 各类字段的表单填写和校验、填写进度、草稿自动保存、一题一页模式、提交成功页（可回看答案）、已收集列表（搜索、详情、删除可撤销）、选项分布和评分均值等统计汇总、CSV 导出 | 按答案显示或隐藏字段、按答案跳题、自动计分或测评结果、上传文件 |
| `kanban` | 多列看板、拖拽卡片换列、卡片自定义字段、每列数量上限、搜索和按选项字段筛选、完成进度、日期字段的逾期提醒、长时间未移动提醒、删除可撤销 | 甘特图/时间线、日历视图、子任务清单、统计图表 |
| `landing` | 单页介绍：导航（滚动高亮）、首屏和若干内容区块（功能、数据、步骤、评价、价格、FAQ、图集大图浏览、联系方式），区块滚动淡入、数字滚动，可留邮箱（带所选价格方案），站长可查看和导出收集到的邮箱 | 多页面、文章列表、购物车、真实图片、留邮箱以外的任何数据录入和管理 |
| `dashboard` | 2-6 个指标卡、1-4 个图表（折线/柱状切换、放大、下载图片）、自动生成的本期看点、可排序可搜索带合计行的数据表格并导出 CSV、用表格方式手动编辑数据 | 逐条录入数据并自动统计、实时数据、筛选联动 |
| `game` | 只有四种玩法：猜数字、记忆翻牌、贪吃蛇、知识问答，可调参数和文案；简单/标准/困难三档难度、最好成绩、战绩统计（胜率、平均成绩、最近 12 局） | 这四种以外的任何游戏（2048、俄罗斯方块、扫雷、五子棋、打砖块等）、多人对战 |
| `crud` | 一类记录的增删改查、详情查看和复制、搜索、按选项分组计数和筛选、排序和点表头排序、表格/卡片视图、批量选择删除和导出、删除可撤销、数字字段合计和评分均值、CSV 导入导出 | 多种记录之间的关联、统计图表、日历视图、计时功能、按条件计算的复杂汇总 |

自由生成（`templateId = null`）的典型场景：计算器、番茄钟、计时器、单位换算、抽签/随机选择器、画板、白噪音、除 §4.7 以外的游戏等。

## 4. 配置契约

每个模板的契约是一段 TypeScript 类型定义（带注释和限制），**原样**保存在 `templates/<id>/contract.ts.txt` 中放进提示词；同时在 `src/lib/templates/schemas.ts` 中写出等价的 zod schema（限制必须一致，单元测试会用 `example.json` 校验）。

### 4.0 共享类型（拼接在每个契约前面）

```ts
// 所有模板共享
type ThemeColor = "indigo" | "blue" | "sky" | "teal" | "emerald" | "amber" | "orange" | "rose" | "violet" | "slate";

interface BaseConfig {
  title: string;          // 应用名，1-20 字
  subtitle?: string;      // 副标题，≤60 字
  emoji: string;          // 标题前的 1 个 emoji
  locale: "zh-CN" | "en";
  theme: { primary: ThemeColor; mode: "light" | "dark" };   // mode 默认 light
}

// 字段定义（todo/form/kanban/crud 使用）
interface Field {
  key: string;            // camelCase 英文，/^[a-z][a-zA-Z0-9]{0,29}$/，同一列表内唯一
  label: string;          // 显示名，≤20 字
  type: "text" | "textarea" | "number" | "date" | "select" | "checkbox" | "email" | "tel" | "url" | "rating";
  required?: boolean;     // 默认 false
  options?: string[];     // 仅 type=select 必填，2-12 项，每项 ≤20 字
  placeholder?: string;   // ≤40 字
  min?: number;           // number/rating 用；rating 固定 1-5
  max?: number;
}
```

### 4.1 `todo` 待办清单

```ts
interface TodoConfig extends BaseConfig {
  mode: "task" | "habit" | "checklist";
  // task：普通任务，支持截止日期/优先级/分类筛选
  // habit：习惯打卡，每个条目显示最近 7 天的打卡格子和连续天数，今日一键打卡
  // checklist：简单勾选清单（购物清单），勾选后划线并沉底
  itemNoun: string;                 // 条目叫什么，如"任务""习惯""商品"，≤6 字
  categories: { id: string; label: string; color: ThemeColor }[];  // 0-8 个，id 为 camelCase
  extraFields: Field[];             // 0-4 个，task 模式下在新增表单中额外显示的字段
  features: {
    dueDate: boolean;               // 仅 task 模式有效
    priority: boolean;              // 仅 task 模式有效，高/中/低
    progressBar: boolean;           // 顶部显示完成进度
  };
  emptyText: string;                // 空状态文案，≤40 字
  seedItems: {                      // 新建应用时为空数组 []（用户自己添加）；修改时保持原样
    title: string;                  // ≤40 字
    category?: string;              // categories 中的 id
    done?: boolean;
    dueDate?: string;               // YYYY-MM-DD
    priority?: "high" | "medium" | "low";
    extra?: Record<string, string | number | boolean>;  // key 对应 extraFields
    checkins?: number;              // habit 模式：最近 7 天中已打卡的天数（0-7，从今天往前连续）
  }[];
}
```

功能要求：新增（顶部输入框回车即添加，task 模式可展开更多字段）、勾选完成、编辑（点击标题行内编辑；✎ 打开详情弹窗，可改全部字段并加备注）、删除（不弹确认，5 秒内可撤销）、搜索、按分类筛选（有分类时）、"全部 / 未完成 / 已完成"切换（task、checklist）、task 模式排序（智能 / 截止日期 / 优先级 / 最新 / 名称）、统计卡（全部、未完成、已完成、逾期，可点击筛选）、清除已完成（确认 + 可撤销）。habit 模式：每行显示 7 个日期格子（今天在最右），点击切换打卡，显示"连续 N 天"；统计卡显示最长连续和近 30 天完成率；▦ 打开最近 5 周热力图，可补打卡（未来日期不可点）。快捷键 N 新建、/ 搜索、1/2/3 切换状态。

### 4.2 `ledger` 记账本

```ts
interface LedgerConfig extends BaseConfig {
  currency: "¥" | "$" | "€" | "£" | "HK$" | "NT$";
  categories: {
    expense: { id: string; label: string; emoji: string }[];   // 3-12 个
    income: { id: string; label: string; emoji: string }[];    // 1-6 个
  };
  monthlyBudget: number | null;     // 月预算，null 表示不显示预算进度
  charts: ("expenseByCategory" | "dailyTrend")[];   // 0-2 个，饼图 / 本月每日支出柱状图
  noteLabel: string;                // 备注字段名称，如"备注""用途"，≤6 字
  seedEntries: {                    // 新建应用时为空数组 []；最多 15 条
    type: "expense" | "income";
    amount: number;                 // > 0，最多两位小数
    category: string;               // 对应分类 id
    date: string;                   // YYYY-MM-DD，相对今天的日期；渲染时若早于 60 天前则平移到最近 30 天
    note?: string;                  // ≤30 字
  }[];
}
```

功能要求：顶部三张统计卡（本月支出带较上月变化或日均、本月收入、结余带结余率）；有预算时显示预算进度条（超过 80% 变橙、超过 100% 变红）和"日均可花"；记一笔表单（类型切换、金额、分类按钮组、日期默认今天、备注）；按月份切换查看（← → 快捷键）；流水列表按日期分组，可搜索、按收支筛选，点击记录打开编辑弹窗，删除可撤销；支出排行（CSS 条形，点击按分类筛选流水）；导出本月 CSV；图表用 Chart.js，颜色取主色系的不同深浅。

### 4.3 `form` 表单收集

```ts
interface FormConfig extends BaseConfig {
  intro: string;                    // 表单说明，≤200 字
  fields: Field[];                  // 1-15 个
  submitText: string;               // ≤10 字
  successTitle: string;             // ≤20 字
  successText: string;              // ≤100 字
  allowMultiple: boolean;           // 提交成功后是否显示"再填一份"
  stepByStep?: boolean;             // 可选，默认 false；true 时一题一页（问卷 / 测评类），带进度条和上一题 / 下一题
  adminView: {
    enabled: boolean;               // 是否提供"查看已收集"页
    title: string;                  // ≤20 字
    exportCsv: boolean;
  };
  seedResponses: Record<string, string | number | boolean>[];   // 新建应用时为空数组 []；key 对应 fields
}
```

功能要求：逐字段渲染对应控件（rating 为 5 颗星点选）；必填校验和类型校验（email、tel 为 11 位数字或带 + 号的国际号码、url、number 的 min/max），错误提示显示在字段下方；填写内容实时存为草稿（刷新不丢，提交后清除），字段超过 3 个时顶部显示填写进度；`stepByStep` 为 true 时一题一页（进度条、上一题 / 下一题，回车进入下一题，最后一题提交）；提交后显示成功页，可展开回看刚提交的答案；`adminView.enabled` 时页面顶部有"填写 / 已收集（N）"切换，已收集页分"列表 / 统计"：列表可搜索，点击行查看详情，删除可撤销，可导出 CSV（Blob + a[download]）；统计页显示最近 7 天提交数，以及每个字段的汇总（select 选项分布、checkbox 是/否占比、rating 均值和星级分布、number 平均/最小/最大、文本类最近 3 条回答）。

### 4.4 `kanban` 看板

```ts
interface KanbanConfig extends BaseConfig {
  columns: { id: string; label: string; color: ThemeColor; wipLimit?: number }[];  // 2-6 列
  cardNoun: string;                 // 卡片叫什么，如"候选人""任务"，≤6 字
  cardFields: Field[];              // 0-5 个，卡片的额外字段（title 固定存在）
  showOnCard: string[];             // 在卡片上直接展示的字段 key，0-3 个
  seedCards: {                      // 新建应用时为空数组 []；最多 12 张
    column: string;                 // 列 id
    title: string;                  // ≤40 字
    fields?: Record<string, string | number | boolean>;
  }[];
}
```

功能要求：横向滚动的列布局（手机上也横向滚动）；每列显示数量，超出 `wipLimit` 时数量变红；HTML5 拖拽卡片换列和排序（同时提供卡片菜单"移到 → 某列"，保证手机可用）；每列底部"+ 添加"；点击卡片打开详情弹窗编辑所有字段、删除（可撤销）；顶部搜索框和按第一个 select 字段的标签筛选（选项按顺序配色）；完成进度（最后一列视为完成）；date 类型字段在未完成列中逾期标红、今天/明天到期标黄；卡片在同一列停留 3 天以上显示"停留 N 天"。快捷键 N 在第一列快速添加、/ 搜索。

### 4.5 `landing` 落地页

```ts
type Section =
  | { type: "features"; title: string; items: { emoji: string; title: string; desc: string }[] }       // items 3-6
  | { type: "stats"; items: { value: string; label: string }[] }                                        // items 2-4
  | { type: "steps"; title: string; items: { title: string; desc: string }[] }                          // items 3-5
  | { type: "testimonials"; title: string; items: { quote: string; name: string; role: string }[] }     // items 2-4
  | { type: "pricing"; title: string; plans: { name: string; price: string; period: string; features: string[]; highlight: boolean; cta: string }[] } // plans 2-3
  | { type: "faq"; title: string; items: { q: string; a: string }[] }                                   // items 3-6
  | { type: "gallery"; title: string; items: { emoji: string; title: string; caption: string }[] }      // items 3-9，用渐变色块 + emoji 代替图片
  | { type: "contact"; title: string; text: string; buttonText: string; collectEmail: boolean };        // collectEmail 时显示邮箱输入并存入 localStorage

interface LandingConfig extends BaseConfig {
  brand: string;                    // 导航栏品牌名，≤16 字
  nav: string[];                    // 0-5 个导航项，点击滚动到对应 section（按顺序对应 sections 中有 title 的项）
  hero: {
    eyebrow?: string;               // 标题上方小字，≤20 字
    headline: string;               // ≤30 字
    subheadline: string;            // ≤100 字
    primaryCta: string;             // ≤10 字，点击滚动到 contact（若有）或 pricing
    secondaryCta?: string;          // ≤10 字
    visual: "gradient" | "emojiGrid" | "mockup";   // 右侧/下方视觉：渐变光斑、emoji 网格、手机外框模拟
    visualEmojis?: string[];        // visual=emojiGrid 时 4-9 个
  };
  sections: Section[];              // 2-7 个，按顺序渲染
  footer: { text: string; links: string[] };   // links 0-5 个纯文字
}
```

功能要求：吸顶导航（滚动后加背景和阴影）、手机端汉堡菜单、平滑滚动、FAQ 折叠、pricing 高亮套餐（点击方案按钮会把所选方案带到留邮箱表单，随邮箱一起保存）、`contact.collectEmail` 提交邮箱后显示感谢卡片并存储（同一邮箱去重），页脚"已收集 N 个邮箱"打开列表并可导出 CSV；导航按滚动位置高亮当前区块、回到顶部按钮、区块首次进入视口时淡入、stats 数字滚动计数（减弱动效时关闭）、gallery 点击大图浏览；`theme.mode = "dark"` 时整体深色（bg-slate-950）。

### 4.6 `dashboard` 数据仪表盘

```ts
interface DashboardConfig extends BaseConfig {
  periodLabel: string;              // 如"2026 年 11 月""本周"，≤20 字
  metrics: {                        // 2-6 个
    label: string;                  // ≤12 字
    value: number;
    unit?: string;                  // ≤6 字，如"元""次""%"
    delta?: number;                 // 环比变化百分比，如 12.5 或 -3
    goodWhen?: "up" | "down";       // delta 正负的好坏，默认 up
  }[];
  charts: {                         // 1-4 个
    type: "line" | "bar" | "pie" | "doughnut";
    title: string;                  // ≤20 字
    labels: string[];               // 2-31 个
    datasets: { label: string; data: number[] }[];   // 1-3 组，data 长度等于 labels；pie/doughnut 只取第 1 组
    span: 1 | 2;                    // 桌面端占 1 列或 2 列（2 列网格）
  }[];
  table?: {
    title: string;
    columns: { key: string; label: string; format?: "text" | "number" | "percent" | "currency" }[];  // 2-6 列
    rows: Record<string, string | number>[];         // 3-20 行
  };
  editable: boolean;                // 是否提供"编辑数据"弹窗（JSON 文本框编辑 metrics/charts 数据并保存到 localStorage）
}
```

功能要求：顶部标题区 + 周期标签；指标卡网格（delta 带 ▲▼ 和颜色，按 `goodWhen` 决定绿红）；图表网格（Chart.js，颜色取主色系与 slate 的组合，`responsive: true, maintainAspectRatio: false`，容器固定高度 260px）；自动"本期看点"（按 `goodWhen` 找出变化最好和最需要关注的指标）；每个图表可在折线 / 柱状间切换（饼图除外，选择存在 meta）、放大查看、下载 PNG；表格可点击列头排序、搜索、导出 CSV，有数值列时显示合计行（percent 列取平均）；`editable` 时"编辑数据"按钮 → 表格式编辑器（指标改数值和环比，图表按"行=标签、列=系列"改数、加行删行，非法数值报错），右上角可切到 JSON 模式（校验 JSON）→ 保存后重绘并显示更新时间；"恢复默认"。

### 4.7 `game` 小游戏

```ts
type GameSpec =
  | { kind: "guessNumber"; min: number; max: number; maxAttempts: number }         // 1 ≤ min < max ≤ 10000，maxAttempts 3-20
  | { kind: "memory"; pairs: number; symbols: string[]; timeLimitSec: number | null } // pairs 4-12，symbols 为 emoji，长度 ≥ pairs
  | { kind: "snake"; gridSize: number; speedMs: number; wrapWalls: boolean; foodEmoji: string } // gridSize 10-30，speedMs 60-300
  | { kind: "quiz"; questions: { q: string; options: string[]; answer: number; explain?: string }[]; shuffle: boolean; timePerQuestionSec: number | null }; // questions 3-15，options 2-4，answer 为下标

interface GameConfig extends BaseConfig {
  game: GameSpec;
  rulesText: string;                // 规则说明，≤150 字
  winText: string;                  // 胜利/完成文案，≤40 字
  loseText: string;                 // 失败文案，≤40 字
}
```

功能要求（所有游戏）：开始界面（规则 + 难度 + 开始按钮，Enter 开始）、进行中状态（得分/步数/用时/剩余次数）、结束界面（结果 + 再来一局 + 换个难度，获胜时彩带动画）、最好成绩存 localStorage 并显示（每档难度单独记录）、"我的战绩"卡片（局数、胜率、平均成绩、最近 12 局柱状图，可清空并撤销）。难度只调参数：猜数字次数 +3 / −2，贪吃蛇速度 ×1.35 / ×0.7，记忆翻牌对数 −2 / +2 且时限 ×1.5 / ×0.7；quiz 没有难度。
- guessNumber：输入框 + 提示"大了/小了"+ 历史记录。
- memory：网格卡片翻转（CSS transform），两张不同则 800ms 后翻回，记录步数和用时。
- snake：canvas 绘制，方向键 + WASD + 屏幕方向按钮（手机），空格暂停，`wrapWalls=false` 撞墙结束。
- quiz：逐题显示，选择后立即标出对错和解析，结束显示得分和错题回顾。

### 4.8 `crud` 通用记录管理

```ts
interface CrudConfig extends BaseConfig {
  entity: { singular: string; plural: string };     // 如 { singular: "联系人", plural: "通讯录" }，各 ≤8 字
  fields: Field[];                  // 1-10 个
  titleField: string;               // 用作记录标题的字段 key（必须是 text 类型且 required）
  subtitleField?: string;           // 副标题字段 key
  searchFields: string[];           // 参与搜索的字段 key，1-4 个
  filterField?: string;             // 用于筛选的 select 字段 key
  sortOptions: { key: string; label: string; dir: "asc" | "desc" }[];  // 1-4 个
  defaultView: "table" | "cards";
  seedRecords: Record<string, string | number | boolean>[];  // 新建应用时为空数组 []；最多 10 条
}
```

功能要求：顶部搜索框、筛选标签（有 filterField 时，带计数）、排序下拉、视图切换（表格 / 卡片）；"新增"弹窗表单（按 fields 渲染，校验规则同 form）；点击记录打开详情弹窗（只读，含编辑 / 复制一份 / 删除）；删除可撤销；概览（总数、第一个 number 字段合计、第一个 rating 字段均值）和 filterField 选项计数标签（可点击筛选）；表格视图可点表头排序、勾选多条批量删除（确认 + 可撤销）或导出；超过 30 条时"再显示更多"；记录总数显示；导出 CSV、从 CSV 导入（第一行为表头，按 label 或 key 匹配）。快捷键 N 新增、/ 搜索、V 切换视图。

## 5. 模板工程规范

### 5.1 目录与文件

```
templates/<id>/
  template.html      # 模板页面，含占位符
  contract.ts.txt    # §4 中该模板的类型定义原文（不含 §4.0，渲染提示词时自动拼接 §4.0）
  example.json       # 一份完整、高质量的示例配置（也是 LLM_MOCK 的输出、dev 画廊的输入）
```

`templates/_shared/contract-base.ts.txt` 存放 §4.0 的共享类型。

### 5.2 `template.html` 结构要求

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>__APP_TITLE__</title>
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.x.y"></script>
<!-- 需要图表的模板：<script src="https://cdn.jsdelivr.net/npm/chart.js@4.x.y/dist/chart.umd.min.js"></script> -->
<style type="text/tailwindcss"> /* 主题变量与少量自定义样式 */ </style>
</head>
<body class="min-h-screen bg-slate-50 text-slate-900">
<div id="app"></div>
<div id="toast" …></div>
<script id="app-config" type="application/json">__APP_CONFIG__</script>
<script>
(function () {
  const CONFIG = JSON.parse(document.getElementById("app-config").textContent);
  // …模板逻辑…
})();
</script>
</body>
</html>
```

规则：
1. 占位符只有两个：`__APP_TITLE__`（HTML 转义后的 title）和 `__APP_CONFIG__`（`JSON.stringify(config)` 后把 `<` 替换为 `<`、` `/` ` 转义）。`render.ts` 用 `split/join` 替换，不用正则。
2. 主题色：模板内置 10 种 ThemeColor 的色值表（Tailwind 默认调色板的 50/100/200/500/600/700 六档十六进制值），启动时写入 `document.documentElement.style` 的 CSS 变量 `--p-50 … --p-700`，样式中用 `bg-[var(--p-600)]` 这类写法。dark 模式时 body 改为 `bg-slate-950 text-slate-100`，卡片改为 `bg-slate-900 border-slate-800`。
3. 文案国际化：模板内置 `I18N = { "zh-CN": {...}, en: {...} }`，所有非配置文案（按钮"添加""删除""取消"、空状态等）从这里取，按 `CONFIG.locale` 选择。
4. 数据存储：键名 `app:<templateId>:data`（例如 `app:todo:data`），值为 `{ version: 1, items: [...] }`。**首次加载（键不存在）时用 seed 数据初始化并写入**；之后只读存储。另提供 `app:<templateId>:meta` 存最好成绩、视图偏好等。例外：`dashboard` 没有逐条数据，值为 `{ version: 1, base, edited, metrics, charts }`，`base` 是配置中 metrics/charts 的哈希；配置被修改（新版本）后 `base` 不一致，以新配置为准重新初始化。`landing` 的 items 是收集到的邮箱，`game` 的 items 是最近 50 局战绩。
5. 日期统一用本地时区 `YYYY-MM-DD`，工具函数 `today()`、`addDays(date, n)` 写在模板内。
6. 防 XSS：所有用户输入和配置文案插入 DOM 时用 `textContent` 或转义函数 `esc()`，不直接拼接 `innerHTML`。
7. 代码风格：模板内 JS 使用 `const/let`、箭头函数、模板字符串；渲染采用"状态对象 + `render()` 整体重绘"的简单模式。每个模板 JS 控制在 700 行以内（打磨后 todo 最长，约 660 行）。
9. 视觉基调与网站一致（暖白纸面 + 墨色文字）：`<style type="text/tailwindcss">` 里用 `@theme` 把 slate 灰阶整体换成偏暖的石色（`--color-slate-50 … 950`），卡片和弹窗底色 `#fffdf9`；`font-display`（Georgia / 宋体回退，不加载网络字体）用于应用标题和大数字（工具类 `num` = `font-display tabular-nums`）；`rise` 为列表项和卡片的入场动效，`prefers-reduced-motion` 时关闭。
10. 共享交互件（8 个模板相同的前置代码）：`toast(msg, onUndo)` 传 `onUndo` 时显示"撤销"按钮 5 秒；单条删除一律"直接删除 + 可撤销"，批量 / 清空类操作"确认弹窗 + 可撤销"；`shortcut(key, label, fn)` 注册单键快捷键（焦点在输入框或弹窗打开时不触发），按 `?` 弹出快捷键说明，页面底部 `keysHint()` 显示入口。
8. 每个模板必须在 `theme.mode` 两种模式、`locale` 两种语言下都正常显示。

### 5.3 `render.ts`

```ts
export function renderTemplate(id: TemplateId, config: unknown): string;
```
- 首次调用时 `fs.readFileSync(path.join(process.cwd(), "templates", id, "template.html"), "utf8")` 并缓存。
- 调用前调用方已用 schema 校验；`render.ts` 内部再做一次 `schemas[id].parse(config)`（防御）。
- 对 ledger 的 `seedEntries.date` 做日期平移（§4.2），这是唯一允许在渲染时改写配置的逻辑。

### 5.4 质量门槛（每个模板交付前自检）

- `example.json` 能通过 schema；`/dev/templates?id=<id>` 中渲染正常，控制台无报错。
- 手动走一遍 §4 的"功能要求"每一条。
- 刷新后数据仍在；清空 localStorage 后回到 seed 数据。
- 375px 宽度无横向溢出（kanban 列区域除外）。
- 单元测试：`tests/unit/templates.test.ts` 遍历 8 个模板，校验 example、渲染、`staticCheck(html)` 返回空数组。
