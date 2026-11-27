import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

/** 表结构见 docs/05 §2、§3。改动后执行 npm run db:generate 并提交 drizzle/ 中的迁移。 */

export const VERSION_SOURCES = ["template", "config_edit", "free", "patch", "fix", "manual"] as const;
export const VERSION_STATUSES = ["pending", "ok", "error"] as const;
export const MESSAGE_ROLES = ["user", "pm", "engineer", "qa", "system"] as const;
export const MESSAGE_STATUSES = ["running", "done", "error", "stopped"] as const;

export const visitors = sqliteTable("visitors", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at").notNull(),
  lastSeenAt: integer("last_seen_at").notNull(),
});

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    visitorId: text("visitor_id")
      .notNull()
      .references(() => visitors.id),
    title: text("title").notNull(),
    titleLocked: integer("title_locked", { mode: "boolean" }).notNull().default(false),
    initialPrompt: text("initial_prompt").notNull(),
    currentVersionId: text("current_version_id"),
    templateId: text("template_id"),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("projects_visitor_idx").on(t.visitorId, t.updatedAt)],
);

export const versions = sqliteTable(
  "versions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    turnId: text("turn_id").notNull(),
    label: text("label").notNull(),
    source: text("source", { enum: VERSION_SOURCES }).notNull(),
    templateId: text("template_id"),
    configJson: text("config_json"),
    html: text("html").notNull(),
    planJson: text("plan_json"),
    status: text("status", { enum: VERSION_STATUSES }).notNull().default("pending"),
    errorsJson: text("errors_json"),
    parentVersionId: text("parent_version_id"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("versions_project_seq_uq").on(t.projectId, t.seq)],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    turnId: text("turn_id").notNull(),
    role: text("role", { enum: MESSAGE_ROLES }).notNull(),
    kind: text("kind").notNull(),
    status: text("status", { enum: MESSAGE_STATUSES }).notNull(),
    content: text("content").notNull().default(""),
    metaJson: text("meta_json"),
    versionId: text("version_id"),
    startedAt: integer("started_at").notNull(),
    finishedAt: integer("finished_at"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("messages_project_idx").on(t.projectId, t.createdAt)],
);

export const usageEvents = sqliteTable(
  "usage_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    visitorId: text("visitor_id").notNull(),
    ip: text("ip").notNull(),
    kind: text("kind", { enum: ["generate", "fix"] }).notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("usage_visitor_idx").on(t.visitorId, t.createdAt),
    index("usage_ip_idx").on(t.ip, t.createdAt),
    index("usage_created_idx").on(t.createdAt),
  ],
);

export const llmCalls = sqliteTable("llm_calls", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: text("project_id"),
  turnId: text("turn_id"),
  step: text("step").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  cachedInputTokens: integer("cached_input_tokens"),
  durationMs: integer("duration_ms").notNull(),
  ok: integer("ok", { mode: "boolean" }).notNull(),
  errorCode: text("error_code"),
  attempt: integer("attempt").notNull().default(1),
  createdAt: integer("created_at").notNull(),
});
