import { z } from "zod";
import type { TemplateId } from "./registry";

/**
 * 每个模板 APP_CONFIG 的 zod schema，与 templates/<id>/contract.ts.txt（docs/08 §4）的限制一一对应。
 * 改契约时两边同步修改；tests/unit/templates.test.ts 会用 example.json 校验。
 */

// ---------- §4.0 共享类型 ----------

export const THEME_COLORS = ["indigo", "blue", "sky", "teal", "emerald", "amber", "orange", "rose", "violet", "slate"] as const;
export const ThemeColor = z.enum(THEME_COLORS);

// 契约没有写长度限制的字符串，只做宽松上限防止异常输出
const LOOSE = 100;
const LONG = 400;

const str = (max: number) => z.string().trim().min(1).max(max);
const optStr = (max: number) => z.string().trim().max(max).optional();
const camelKey = z.string().regex(/^[a-z][a-zA-Z0-9]{0,29}$/, "key 必须是小写字母开头的 camelCase");
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式为 YYYY-MM-DD");
const emoji = z.string().trim().min(1).max(16);
const scalar = z.union([z.string(), z.number(), z.boolean()]);

const baseShape = {
  title: str(20),
  subtitle: optStr(60),
  emoji,
  locale: z.enum(["zh-CN", "en"]),
  theme: z.object({ primary: ThemeColor, mode: z.enum(["light", "dark"]).default("light") }),
};

export const FIELD_TYPES = ["text", "textarea", "number", "date", "select", "checkbox", "email", "tel", "url", "rating"] as const;

export const FieldSchema = z
  .object({
    key: camelKey,
    label: str(20),
    type: z.enum(FIELD_TYPES),
    required: z.boolean().optional(),
    options: z.array(str(20)).min(2).max(12).optional(),
    placeholder: optStr(40),
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .refine((f) => f.type !== "select" || (f.options?.length ?? 0) >= 2, { message: "select 字段必须提供 2-12 个 options", path: ["options"] })
  .refine((f) => f.min === undefined || f.max === undefined || f.min <= f.max, { message: "min 不能大于 max", path: ["min"] });
export type Field = z.infer<typeof FieldSchema>;

const fieldList = (min: number, max: number) =>
  z
    .array(FieldSchema)
    .min(min)
    .max(max)
    .refine((fs) => new Set(fs.map((f) => f.key)).size === fs.length, { message: "同一列表内字段 key 不能重复" });

const uniqueIds = <T extends { id: string }>(arr: T[]) => new Set(arr.map((x) => x.id)).size === arr.length;

// ---------- §4.1 todo ----------

export const TodoConfigSchema = z
  .object({
    ...baseShape,
    mode: z.enum(["task", "habit", "checklist"]),
    itemNoun: str(6),
    categories: z.array(z.object({ id: camelKey, label: str(LOOSE), color: ThemeColor })).max(8).refine(uniqueIds, "分类 id 不能重复"),
    extraFields: fieldList(0, 4),
    features: z.object({ dueDate: z.boolean(), priority: z.boolean(), progressBar: z.boolean() }),
    emptyText: str(40),
    seedItems: z
      .array(
        z.object({
          title: str(40),
          category: z.string().optional(),
          done: z.boolean().optional(),
          dueDate: ymd.optional(),
          priority: z.enum(["high", "medium", "low"]).optional(),
          extra: z.record(z.string(), scalar).optional(),
          checkins: z.number().int().min(0).max(7).optional(),
        }),
      )
      .min(0)
      .max(8),
  })
  .refine((c) => c.seedItems.every((s) => !s.category || c.categories.some((k) => k.id === s.category)), {
    message: "seedItems.category 必须是 categories 中的 id",
    path: ["seedItems"],
  });

// ---------- §4.2 ledger ----------

const ledgerCat = z.object({ id: camelKey, label: str(LOOSE), emoji });

export const LedgerConfigSchema = z
  .object({
    ...baseShape,
    currency: z.enum(["¥", "$", "€", "£", "HK$", "NT$"]),
    categories: z.object({
      expense: z.array(ledgerCat).min(3).max(12),
      income: z.array(ledgerCat).min(1).max(6),
    }),
    monthlyBudget: z.number().positive().nullable(),
    charts: z.array(z.enum(["expenseByCategory", "dailyTrend"])).max(2),
    noteLabel: str(6),
    seedEntries: z
      .array(
        z.object({
          type: z.enum(["expense", "income"]),
          amount: z.number().positive().refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "最多两位小数"),
          category: z.string(),
          date: ymd,
          note: optStr(30),
        }),
      )
      .min(0)
      .max(15),
  })
  .refine((c) => uniqueIds([...c.categories.expense, ...c.categories.income]), { message: "分类 id 不能重复", path: ["categories"] })
  .refine((c) => c.seedEntries.every((e) => c.categories[e.type].some((k) => k.id === e.category)), {
    message: "seedEntries.category 必须是对应类型分类中的 id",
    path: ["seedEntries"],
  });

// ---------- §4.3 form ----------

export const FormConfigSchema = z.object({
  ...baseShape,
  intro: z.string().trim().max(200),
  fields: fieldList(1, 15),
  submitText: str(10),
  successTitle: str(20),
  successText: z.string().trim().max(100),
  allowMultiple: z.boolean(),
  stepByStep: z.boolean().optional(),
  adminView: z.object({ enabled: z.boolean(), title: str(20), exportCsv: z.boolean() }),
  seedResponses: z.array(z.record(z.string(), scalar)).max(5),
});

// ---------- §4.4 kanban ----------

export const KanbanConfigSchema = z
  .object({
    ...baseShape,
    columns: z
      .array(z.object({ id: camelKey, label: str(LOOSE), color: ThemeColor, wipLimit: z.number().int().positive().optional() }))
      .min(2)
      .max(6)
      .refine(uniqueIds, "列 id 不能重复"),
    cardNoun: str(6),
    cardFields: fieldList(0, 5),
    showOnCard: z.array(z.string()).max(3),
    seedCards: z
      .array(z.object({ column: z.string(), title: str(40), fields: z.record(z.string(), scalar).optional() }))
      .min(0)
      .max(12),
  })
  .refine((c) => c.seedCards.every((s) => c.columns.some((col) => col.id === s.column)), { message: "seedCards.column 必须是列 id", path: ["seedCards"] })
  .refine((c) => c.showOnCard.every((k) => c.cardFields.some((f) => f.key === k)), { message: "showOnCard 必须是 cardFields 中的 key", path: ["showOnCard"] });

// ---------- §4.5 landing ----------

const SectionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("features"), title: str(LOOSE), items: z.array(z.object({ emoji, title: str(LOOSE), desc: str(LOOSE) })).min(3).max(6) }),
  z.object({ type: z.literal("stats"), items: z.array(z.object({ value: str(LOOSE), label: str(LOOSE) })).min(2).max(4) }),
  z.object({ type: z.literal("steps"), title: str(LOOSE), items: z.array(z.object({ title: str(LOOSE), desc: str(LOOSE) })).min(3).max(5) }),
  z.object({ type: z.literal("testimonials"), title: str(LOOSE), items: z.array(z.object({ quote: str(LOOSE), name: str(LOOSE), role: str(LOOSE) })).min(2).max(4) }),
  z.object({
    type: z.literal("pricing"),
    title: str(LOOSE),
    plans: z
      .array(z.object({ name: str(LOOSE), price: str(LOOSE), period: z.string().trim().max(LOOSE), features: z.array(str(LOOSE)).min(1).max(10), highlight: z.boolean(), cta: str(LOOSE) }))
      .min(2)
      .max(3),
  }),
  z.object({ type: z.literal("faq"), title: str(LOOSE), items: z.array(z.object({ q: str(LOOSE), a: str(LONG) })).min(3).max(6) }),
  z.object({ type: z.literal("gallery"), title: str(LOOSE), items: z.array(z.object({ emoji, title: str(LOOSE), caption: str(LOOSE) })).min(3).max(9) }),
  z.object({ type: z.literal("contact"), title: str(LOOSE), text: str(LONG), buttonText: str(LOOSE), collectEmail: z.boolean() }),
]);

export const LandingConfigSchema = z.object({
  ...baseShape,
  brand: str(16),
  nav: z.array(str(LOOSE)).max(5),
  hero: z
    .object({
      eyebrow: optStr(20),
      headline: str(30),
      subheadline: str(100),
      primaryCta: str(10),
      secondaryCta: optStr(10),
      visual: z.enum(["gradient", "emojiGrid", "mockup"]),
      visualEmojis: z.array(emoji).min(4).max(9).optional(),
    })
    .refine((h) => h.visual !== "emojiGrid" || (h.visualEmojis?.length ?? 0) >= 4, { message: "visual=emojiGrid 时需要 4-9 个 visualEmojis", path: ["visualEmojis"] }),
  sections: z.array(SectionSchema).min(2).max(7),
  footer: z.object({ text: str(LONG), links: z.array(str(LOOSE)).max(5) }),
});

// ---------- §4.6 dashboard ----------

const ChartSchema = z
  .object({
    type: z.enum(["line", "bar", "pie", "doughnut"]),
    title: str(20),
    labels: z.array(z.string().trim().min(1).max(LOOSE)).min(2).max(31),
    datasets: z.array(z.object({ label: str(LOOSE), data: z.array(z.number()) })).min(1).max(3),
    span: z.union([z.literal(1), z.literal(2)]),
  })
  .refine((c) => c.datasets.every((d) => d.data.length === c.labels.length), { message: "datasets[].data 的长度必须等于 labels", path: ["datasets"] });

export const DashboardConfigSchema = z
  .object({
    ...baseShape,
    periodLabel: str(20),
    metrics: z
      .array(z.object({ label: str(12), value: z.number(), unit: optStr(6), delta: z.number().optional(), goodWhen: z.enum(["up", "down"]).optional() }))
      .min(2)
      .max(6),
    charts: z.array(ChartSchema).min(1).max(4),
    table: z
      .object({
        title: str(LOOSE),
        columns: z.array(z.object({ key: camelKey, label: str(LOOSE), format: z.enum(["text", "number", "percent", "currency"]).optional() })).min(2).max(6),
        rows: z.array(z.record(z.string(), z.union([z.string(), z.number()]))).min(3).max(20),
      })
      .optional(),
    editable: z.boolean(),
  });

// ---------- §4.7 game ----------

const GameSpecSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("guessNumber"), min: z.number().int().min(1), max: z.number().int().max(10000), maxAttempts: z.number().int().min(3).max(20) })
    .refine((g) => g.min < g.max, { message: "min 必须小于 max", path: ["min"] }),
  z
    .object({ kind: z.literal("memory"), pairs: z.number().int().min(4).max(12), symbols: z.array(emoji), timeLimitSec: z.number().int().positive().nullable() })
    .refine((g) => new Set(g.symbols).size >= g.pairs, { message: "symbols 中不同的 emoji 数量必须 ≥ pairs", path: ["symbols"] }),
  z.object({
    kind: z.literal("snake"),
    gridSize: z.number().int().min(10).max(30),
    speedMs: z.number().int().min(60).max(300),
    wrapWalls: z.boolean(),
    foodEmoji: emoji,
  }),
  z.object({
    kind: z.literal("quiz"),
    questions: z
      .array(
        z
          .object({ q: str(LONG), options: z.array(str(LOOSE)).min(2).max(4), answer: z.number().int().min(0), explain: optStr(LONG) })
          .refine((q) => q.answer < q.options.length, { message: "answer 必须是 options 的下标", path: ["answer"] }),
      )
      .min(3)
      .max(15),
    shuffle: z.boolean(),
    timePerQuestionSec: z.number().int().positive().nullable(),
  }),
]);

export const GameConfigSchema = z.object({
  ...baseShape,
  game: GameSpecSchema,
  rulesText: str(150),
  winText: str(40),
  loseText: str(40),
});

// ---------- §4.8 crud ----------

export const CrudConfigSchema = z
  .object({
    ...baseShape,
    entity: z.object({ singular: str(8), plural: str(8) }),
    fields: fieldList(1, 10),
    titleField: z.string(),
    subtitleField: z.string().optional(),
    searchFields: z.array(z.string()).min(1).max(4),
    filterField: z.string().optional(),
    sortOptions: z.array(z.object({ key: z.string(), label: str(LOOSE), dir: z.enum(["asc", "desc"]) })).min(1).max(4),
    defaultView: z.enum(["table", "cards"]),
    seedRecords: z.array(z.record(z.string(), scalar)).max(10),
  })
  .superRefine((c, ctx) => {
    const byKey = new Map(c.fields.map((f) => [f.key, f]));
    const t = byKey.get(c.titleField);
    if (!t || t.type !== "text" || !t.required) ctx.addIssue({ code: "custom", message: "titleField 必须是 required 的 text 字段", path: ["titleField"] });
    if (c.subtitleField && !byKey.has(c.subtitleField)) ctx.addIssue({ code: "custom", message: "subtitleField 不存在", path: ["subtitleField"] });
    if (c.filterField && byKey.get(c.filterField)?.type !== "select") ctx.addIssue({ code: "custom", message: "filterField 必须是 select 字段", path: ["filterField"] });
    if (!c.searchFields.every((k) => byKey.has(k))) ctx.addIssue({ code: "custom", message: "searchFields 中有不存在的字段", path: ["searchFields"] });
    if (!c.sortOptions.every((s) => byKey.has(s.key) || s.key === "createdAt"))
      ctx.addIssue({ code: "custom", message: "sortOptions.key 必须是字段 key 或 createdAt", path: ["sortOptions"] });
  });

// ---------- 汇总 ----------

export const TEMPLATE_SCHEMAS = {
  todo: TodoConfigSchema,
  ledger: LedgerConfigSchema,
  form: FormConfigSchema,
  kanban: KanbanConfigSchema,
  landing: LandingConfigSchema,
  dashboard: DashboardConfigSchema,
  game: GameConfigSchema,
  crud: CrudConfigSchema,
} as const satisfies Record<TemplateId, z.ZodType>;

export type TodoConfig = z.infer<typeof TodoConfigSchema>;
export type LedgerConfig = z.infer<typeof LedgerConfigSchema>;
export type FormConfig = z.infer<typeof FormConfigSchema>;
export type KanbanConfig = z.infer<typeof KanbanConfigSchema>;
export type LandingConfig = z.infer<typeof LandingConfigSchema>;
export type DashboardConfig = z.infer<typeof DashboardConfigSchema>;
export type GameConfig = z.infer<typeof GameConfigSchema>;
export type CrudConfig = z.infer<typeof CrudConfigSchema>;
export type TemplateConfig = { [K in TemplateId]: z.infer<(typeof TEMPLATE_SCHEMAS)[K]> };
