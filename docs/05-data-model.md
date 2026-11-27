# 05 · 数据模型（SQLite + Drizzle）

## 1. 约定

- 数据库文件：环境变量 `DATABASE_PATH`（默认 `./data/app.db`，容器内 `/app/data/app.db`）。
- 打开数据库后立即执行：`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;`
- 主键：`text`，用 `nanoid(12)` 生成（访客 ID 用 `nanoid(21)`）。
- 时间：`integer`，Unix 毫秒（`Date.now()`）。
- 布尔：`integer` 0/1（Drizzle `integer({ mode: "boolean" })`）。
- JSON：`text` 存 JSON 字符串，读写时在 `queries.ts` 里统一 `JSON.parse` / `JSON.stringify` 并用 zod 校验关键字段。
- 迁移：`drizzle-kit generate` 生成 SQL 到 `drizzle/`，提交到仓库。应用启动时（`src/lib/db/index.ts` 首次被 import 时）调用 `migrate(db, { migrationsFolder })` 自动执行。`migrationsFolder` 取 `path.join(process.cwd(), "drizzle")`，Dockerfile 必须把 `drizzle/` 复制进运行镜像。

## 2. 表结构

### 2.1 `visitors`

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | text | PK | 访客 ID，即 cookie `atoms_vid` 的值，也是恢复码 |
| `created_at` | integer | not null | |
| `last_seen_at` | integer | not null | 每次 API 调用最多每 10 分钟更新一次 |

访客记录在任何 `/api/*` 请求中通过 `getVisitor(req)` 惰性 upsert。

### 2.2 `projects`

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | text | PK | |
| `visitor_id` | text | not null, FK → visitors.id, index | 所有者 |
| `title` | text | not null | 初始为"新应用"，PM 第一步完成后改为 PM 给出的 `appName`（用户手动改过则不再覆盖） |
| `title_locked` | integer(bool) | not null default 0 | 用户手动重命名后置 1 |
| `initial_prompt` | text | not null | 首页提交的需求 |
| `current_version_id` | text | nullable | FK → versions.id（不加数据库外键约束，避免循环依赖；应用层保证） |
| `template_id` | text | nullable | 当前版本使用的模板，冗余存储用于首页卡片 |
| `is_public` | integer(bool) | not null default 0 | |
| `created_at` | integer | not null | |
| `updated_at` | integer | not null, index | 任何消息、版本变化都更新 |

### 2.3 `versions`

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | text | PK | |
| `project_id` | text | not null, FK → projects.id ON DELETE CASCADE | |
| `seq` | integer | not null | 项目内从 1 递增；唯一索引 `(project_id, seq)` |
| `turn_id` | text | not null | 产生该版本的 turn |
| `label` | text | not null | 版本名 ≤16 字，来自 PM 的 `versionLabel`；修复版为"修复：<原 label>"截断到 16 字 |
| `source` | text | not null | `template` \| `config_edit` \| `free` \| `patch` \| `fix` \| `manual` |
| `template_id` | text | nullable | 模板版本才有 |
| `config_json` | text | nullable | 模板配置。**一旦某版本经过 `patch`/`fix` 修改了 HTML，其后续版本 `config_json = null`，表示已"脱离模板"** |
| `html` | text | not null | 完整 HTML（存储形式：CDN 地址，不含 runtime 脚本） |
| `plan_json` | text | nullable | PM 输出（PmOutput） |
| `status` | text | not null default `pending` | `pending` \| `ok` \| `error` |
| `errors_json` | text | nullable | 运行时/静态检查报错列表 `RuntimeError[]` |
| `parent_version_id` | text | nullable | 基于哪个版本修改而来 |
| `created_at` | integer | not null | |

说明：
- 恢复（rollback）**不复制版本**，只把 `projects.current_version_id` 指向旧版本，并插入一条 system 消息。
- `status` 由客户端 QA 结果更新（`POST /api/versions/:id/status`）。服务端静态检查失败且无修复预算的版本直接写 `error`。

### 2.4 `messages`

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | text | PK | |
| `project_id` | text | not null, FK ON DELETE CASCADE, index `(project_id, created_at)` | |
| `turn_id` | text | not null | 同一轮的消息共享 |
| `role` | text | not null | `user` \| `pm` \| `engineer` \| `qa` \| `system` |
| `kind` | text | not null | 见下表 |
| `status` | text | not null | `running` \| `done` \| `error` \| `stopped` |
| `content` | text | not null default '' | 主要显示文本 |
| `meta_json` | text | nullable | 结构化数据，按 kind 不同（见下表） |
| `version_id` | text | nullable | 关联的版本（版本卡片、工程师卡片） |
| `started_at` | integer | not null | |
| `finished_at` | integer | nullable | 用于显示耗时 |
| `created_at` | integer | not null | 排序依据 |

`kind` 与 `meta_json`：

| role | kind | content | meta_json |
|---|---|---|---|
| user | `text` | 用户输入原文 | null |
| pm | `pm_plan` | PM 的 `reply` | `PmOutput`（见 07 §3） |
| engineer | `engineer_config` | "已生成应用配置" | `{ templateId, config }` |
| engineer | `engineer_code` | "已完成代码编写（N 字符）" | `{ chars }` |
| engineer | `engineer_patch` | "修改了 N 处" | `{ patches: { search: string; replace: string }[], fallback?: "rewrite" }`（search/replace 各截断到 300 字符存储） |
| qa | `qa_report` | "检查通过" / "发现 N 个问题" / "已修复" / "修复失败，已回退到 vX" | `{ phase: "static" \| "runtime", errors: RuntimeError[], round: 0..2, outcome: "pass" \| "fixing" \| "fixed" \| "rolled_back" \| "failed" }` |
| system | `version` | 版本名 | `{ seq, source }`（`version_id` 指向版本） |
| system | `notice` | "已恢复到 v2" / "已停止" | null |
| system | `error` | 中文错误文案 | `{ code, retryable: boolean }` |

`RuntimeError` 结构：`{ type: "error" | "unhandledrejection" | "console" | "static", message: string, line?: number, col?: number, stack?: string }`，`message` 截断到 500 字符，`stack` 截断到 1000 字符。

### 2.5 `usage_events`（限流）

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | integer | PK autoincrement |
| `visitor_id` | text | index `(visitor_id, created_at)` |
| `ip` | text | index `(ip, created_at)` |
| `kind` | text | `generate` \| `fix` |
| `created_at` | integer | index |

### 2.6 `llm_calls`（可观测与成本）

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | integer | PK autoincrement |
| `project_id` | text | nullable |
| `turn_id` | text | nullable |
| `step` | text | `pm` \| `config` \| `free` \| `patch` \| `fix` |
| `model` | text | |
| `input_tokens` | integer | |
| `output_tokens` | integer | |
| `cached_input_tokens` | integer | nullable（响应里有才记） |
| `duration_ms` | integer | |
| `ok` | integer(bool) | |
| `error_code` | text | nullable |
| `attempt` | integer | 第几次尝试（从 1 开始） |
| `created_at` | integer | |

## 3. Drizzle schema（`src/lib/db/schema.ts` 参考实现）

```ts
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const visitors = sqliteTable("visitors", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at").notNull(),
  lastSeenAt: integer("last_seen_at").notNull(),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  visitorId: text("visitor_id").notNull().references(() => visitors.id),
  title: text("title").notNull(),
  titleLocked: integer("title_locked", { mode: "boolean" }).notNull().default(false),
  initialPrompt: text("initial_prompt").notNull(),
  currentVersionId: text("current_version_id"),
  templateId: text("template_id"),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [
  index("projects_visitor_idx").on(t.visitorId, t.updatedAt),
]);

export const versions = sqliteTable("versions", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  seq: integer("seq").notNull(),
  turnId: text("turn_id").notNull(),
  label: text("label").notNull(),
  source: text("source", { enum: ["template", "config_edit", "free", "patch", "fix", "manual"] }).notNull(),
  templateId: text("template_id"),
  configJson: text("config_json"),
  html: text("html").notNull(),
  planJson: text("plan_json"),
  status: text("status", { enum: ["pending", "ok", "error"] }).notNull().default("pending"),
  errorsJson: text("errors_json"),
  parentVersionId: text("parent_version_id"),
  createdAt: integer("created_at").notNull(),
}, (t) => [
  uniqueIndex("versions_project_seq_uq").on(t.projectId, t.seq),
]);

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  turnId: text("turn_id").notNull(),
  role: text("role", { enum: ["user", "pm", "engineer", "qa", "system"] }).notNull(),
  kind: text("kind").notNull(),
  status: text("status", { enum: ["running", "done", "error", "stopped"] }).notNull(),
  content: text("content").notNull().default(""),
  metaJson: text("meta_json"),
  versionId: text("version_id"),
  startedAt: integer("started_at").notNull(),
  finishedAt: integer("finished_at"),
  createdAt: integer("created_at").notNull(),
}, (t) => [
  index("messages_project_idx").on(t.projectId, t.createdAt),
]);

export const usageEvents = sqliteTable("usage_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  visitorId: text("visitor_id").notNull(),
  ip: text("ip").notNull(),
  kind: text("kind", { enum: ["generate", "fix"] }).notNull(),
  createdAt: integer("created_at").notNull(),
}, (t) => [
  index("usage_visitor_idx").on(t.visitorId, t.createdAt),
  index("usage_ip_idx").on(t.ip, t.createdAt),
  index("usage_created_idx").on(t.createdAt),
]);

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
```

## 4. 关键查询（`src/lib/db/queries.ts` 必须提供）

| 函数 | 说明 |
|---|---|
| `upsertVisitor(id)` | 插入或更新 last_seen_at |
| `listProjects(visitorId)` | 按 updated_at 倒序，附带当前版本 seq |
| `getProjectForVisitor(id, visitorId)` | 不属于则返回 null |
| `getProjectDetail(id, visitorId)` | 项目 + 全部消息（按 created_at 升序）+ 版本列表（不含 html）+ 当前版本完整内容 |
| `createProject({ visitorId, prompt })` | |
| `createVersion({...})` | 在事务中计算 `seq = max(seq)+1`，插入版本，更新 `projects.current_version_id / template_id / updated_at` |
| `setCurrentVersion(projectId, versionId)` | 恢复用 |
| `lastOkVersion(projectId, excludeId?)` | 最近一个 `status='ok'` 的版本（按 seq 倒序） |
| `insertMessage / updateMessage` | 更新时自动写 `finished_at`（状态非 running 时） |
| `countUsage({ visitorId, ip, sinceMs })` | 返回三个数：该访客、该 IP、全站 |
| `recordLlmCall({...})` | |

所有写多张表的操作用 `db.transaction(() => {...})`（better-sqlite3 同步事务）。

## 5. 数据保留

演示期不做清理。备份见 [10-deployment.md](10-deployment.md) §7。
