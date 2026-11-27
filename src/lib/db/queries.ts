import "server-only";
import { and, asc, desc, eq, gte, inArray, max, ne, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { PmOutput } from "@/lib/agent/schemas";
import type { MessageDTO, MessageRole, MessageStatus, ProjectDetail, ProjectSummary, VersionFull, VersionSource, VersionStatus, VersionSummary } from "@/types/api";
import type { RuntimeError } from "@/types/runtime";
import { getDb } from "./index";
import { llmCalls, messages, projects, usageEvents, versions, visitors } from "./schema";

/** 所有数据库访问集中在这里（docs/05 §4、docs/11 §7）。 */

export type ProjectRow = typeof projects.$inferSelect;
export type VersionRow = typeof versions.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;

export const newId = () => nanoid(12);

function parseJson<T>(text: string | null): T | null {
  if (text === null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

const json = (v: unknown) => (v === null || v === undefined ? null : JSON.stringify(v));

// ---------- 映射 ----------

export function toProjectSummary(p: ProjectRow, currentSeq: number | null): ProjectSummary {
  return { id: p.id, title: p.title, templateId: p.templateId, currentSeq, isPublic: p.isPublic, updatedAt: p.updatedAt };
}

export function toVersionSummary(v: Omit<VersionRow, "html" | "configJson" | "planJson" | "errorsJson">): VersionSummary {
  return { id: v.id, seq: v.seq, label: v.label, source: v.source, templateId: v.templateId, status: v.status, createdAt: v.createdAt };
}

export function toVersionFull(v: VersionRow): VersionFull {
  return {
    ...toVersionSummary(v),
    html: v.html,
    config: parseJson<unknown>(v.configJson),
    plan: parseJson<PmOutput>(v.planJson),
    errors: parseJson<RuntimeError[]>(v.errorsJson),
  };
}

export function toMessageDTO(m: MessageRow): MessageDTO {
  return {
    id: m.id,
    turnId: m.turnId,
    role: m.role,
    kind: m.kind,
    status: m.status,
    content: m.content,
    meta: parseJson<unknown>(m.metaJson),
    versionId: m.versionId,
    startedAt: m.startedAt,
    finishedAt: m.finishedAt,
    createdAt: m.createdAt,
  };
}

// ---------- 访客 ----------

const SEEN_INTERVAL = 10 * 60 * 1000;

export function upsertVisitor(id: string, now = Date.now()) {
  getDb()
    .insert(visitors)
    .values({ id, createdAt: now, lastSeenAt: now })
    .onConflictDoUpdate({ target: visitors.id, set: { lastSeenAt: now }, setWhere: sql`${visitors.lastSeenAt} < ${now - SEEN_INTERVAL}` })
    .run();
}

export function visitorExists(id: string): boolean {
  return !!getDb().select({ id: visitors.id }).from(visitors).where(eq(visitors.id, id)).get();
}

// ---------- 项目 ----------

function seqOf(versionId: string | null): number | null {
  if (!versionId) return null;
  return getDb().select({ seq: versions.seq }).from(versions).where(eq(versions.id, versionId)).get()?.seq ?? null;
}

export function listProjects(visitorId: string): ProjectSummary[] {
  const rows = getDb()
    .select({ p: projects, seq: versions.seq })
    .from(projects)
    .leftJoin(versions, eq(versions.id, projects.currentVersionId))
    .where(eq(projects.visitorId, visitorId))
    .orderBy(desc(projects.updatedAt))
    .all();
  return rows.map((r) => toProjectSummary(r.p, r.seq ?? null));
}

export function getProjectById(id: string): ProjectRow | null {
  return getDb().select().from(projects).where(eq(projects.id, id)).get() ?? null;
}

export function getProjectForVisitor(id: string, visitorId: string): ProjectRow | null {
  return getDb().select().from(projects).where(and(eq(projects.id, id), eq(projects.visitorId, visitorId))).get() ?? null;
}

export function projectSummary(p: ProjectRow): ProjectSummary {
  return toProjectSummary(p, seqOf(p.currentVersionId));
}

export function listVersionSummaries(projectId: string): VersionSummary[] {
  return getDb()
    .select({
      id: versions.id,
      projectId: versions.projectId,
      seq: versions.seq,
      turnId: versions.turnId,
      label: versions.label,
      source: versions.source,
      templateId: versions.templateId,
      status: versions.status,
      parentVersionId: versions.parentVersionId,
      createdAt: versions.createdAt,
    })
    .from(versions)
    .where(eq(versions.projectId, projectId))
    .orderBy(desc(versions.seq))
    .all()
    .map(toVersionSummary);
}

export function listMessages(projectId: string): MessageDTO[] {
  return getDb().select().from(messages).where(eq(messages.projectId, projectId)).orderBy(asc(messages.createdAt), asc(messages.id)).all().map(toMessageDTO);
}

export function getProjectDetail(id: string, visitorId: string, busy: boolean): ProjectDetail | null {
  const p = getProjectForVisitor(id, visitorId);
  if (!p) return null;
  const current = p.currentVersionId ? getVersion(p.currentVersionId) : null;
  return {
    project: { ...toProjectSummary(p, current?.seq ?? null), initialPrompt: p.initialPrompt, currentVersionId: p.currentVersionId },
    messages: listMessages(id),
    versions: listVersionSummaries(id),
    currentVersion: current ? toVersionFull(current) : null,
    busy,
  };
}

export function createProject(input: { visitorId: string; prompt: string; now?: number }): ProjectRow {
  const now = input.now ?? Date.now();
  const row: ProjectRow = {
    id: newId(),
    visitorId: input.visitorId,
    title: "新应用",
    titleLocked: false,
    initialPrompt: input.prompt,
    currentVersionId: null,
    templateId: null,
    isPublic: false,
    createdAt: now,
    updatedAt: now,
  };
  getDb().insert(projects).values(row).run();
  return row;
}

export function updateProject(id: string, patch: Partial<Pick<ProjectRow, "title" | "titleLocked" | "isPublic">>): ProjectRow | null {
  getDb()
    .update(projects)
    .set({ ...patch, updatedAt: Date.now() })
    .where(eq(projects.id, id))
    .run();
  return getProjectById(id);
}

export function touchProject(id: string, now = Date.now()) {
  getDb().update(projects).set({ updatedAt: now }).where(eq(projects.id, id)).run();
}

export function deleteProject(id: string) {
  getDb().delete(projects).where(eq(projects.id, id)).run();
}

// ---------- 版本 ----------

export interface CreateVersionInput {
  projectId: string;
  turnId: string;
  label: string;
  source: VersionSource;
  templateId: string | null;
  config: unknown | null;
  html: string;
  plan: PmOutput | null;
  status: VersionStatus;
  errors: RuntimeError[] | null;
  parentVersionId: string | null;
  now?: number;
}

/** 事务内计算 seq = max(seq)+1，插入版本并设为当前版本。 */
export function createVersion(input: CreateVersionInput): VersionRow {
  const db = getDb();
  return db.transaction((tx) => {
    const now = input.now ?? Date.now();
    const top = tx.select({ m: max(versions.seq) }).from(versions).where(eq(versions.projectId, input.projectId)).get();
    const row: VersionRow = {
      id: newId(),
      projectId: input.projectId,
      seq: (top?.m ?? 0) + 1,
      turnId: input.turnId,
      label: input.label.slice(0, 16),
      source: input.source,
      templateId: input.templateId,
      configJson: json(input.config),
      html: input.html,
      planJson: json(input.plan),
      status: input.status,
      errorsJson: input.errors && input.errors.length ? JSON.stringify(input.errors) : null,
      parentVersionId: input.parentVersionId,
      createdAt: now,
    };
    tx.insert(versions).values(row).run();
    tx.update(projects).set({ currentVersionId: row.id, templateId: row.templateId, updatedAt: now }).where(eq(projects.id, input.projectId)).run();
    return row;
  });
}

export function getVersion(id: string): VersionRow | null {
  return getDb().select().from(versions).where(eq(versions.id, id)).get() ?? null;
}

export function getVersionBySeq(projectId: string, seq: number): VersionRow | null {
  return getDb().select().from(versions).where(and(eq(versions.projectId, projectId), eq(versions.seq, seq))).get() ?? null;
}

export function setCurrentVersion(projectId: string, versionId: string) {
  const v = getVersion(versionId);
  if (!v || v.projectId !== projectId) throw new Error("版本不属于该项目");
  getDb().update(projects).set({ currentVersionId: versionId, templateId: v.templateId, updatedAt: Date.now() }).where(eq(projects.id, projectId)).run();
}

export function lastOkVersion(projectId: string, excludeId?: string): VersionRow | null {
  const conds = [eq(versions.projectId, projectId), eq(versions.status, "ok" as const)];
  if (excludeId) conds.push(ne(versions.id, excludeId));
  return getDb()
    .select()
    .from(versions)
    .where(and(...conds))
    .orderBy(desc(versions.seq))
    .limit(1)
    .get() ?? null;
}

export function updateVersionStatus(id: string, status: VersionStatus, errors?: RuntimeError[] | null) {
  const set: Partial<VersionRow> = { status };
  if (errors !== undefined) set.errorsJson = errors && errors.length ? JSON.stringify(errors) : null;
  getDb().update(versions).set(set).where(eq(versions.id, id)).run();
}

// ---------- 消息 ----------

export interface InsertMessageInput {
  projectId: string;
  turnId: string;
  role: MessageRole;
  kind: string;
  status: MessageStatus;
  content?: string;
  meta?: unknown;
  versionId?: string | null;
  now?: number;
}

// 同一毫秒插入多条消息时保证 created_at 严格递增，排序稳定
let lastCreatedAt = 0;
function monotonicNow(now: number) {
  lastCreatedAt = Math.max(now, lastCreatedAt + 1);
  return lastCreatedAt;
}

export function insertMessage(input: InsertMessageInput): MessageRow {
  const now = input.now ?? Date.now();
  const created = monotonicNow(now);
  const row: MessageRow = {
    id: newId(),
    projectId: input.projectId,
    turnId: input.turnId,
    role: input.role,
    kind: input.kind,
    status: input.status,
    content: input.content ?? "",
    metaJson: json(input.meta),
    versionId: input.versionId ?? null,
    startedAt: now,
    finishedAt: input.status === "running" ? null : now,
    createdAt: created,
  };
  getDb().insert(messages).values(row).run();
  touchProject(input.projectId, now);
  return row;
}

export interface MessagePatch {
  status?: MessageStatus;
  content?: string;
  meta?: unknown;
  versionId?: string | null;
}

/** 更新消息；状态变为非 running 时自动写 finished_at。返回更新后的行。 */
export function updateMessage(id: string, patch: MessagePatch, now = Date.now()): MessageRow | null {
  const set: Partial<MessageRow> = {};
  if (patch.status !== undefined) {
    set.status = patch.status;
    set.finishedAt = patch.status === "running" ? null : now;
  }
  if (patch.content !== undefined) set.content = patch.content;
  if (patch.meta !== undefined) set.metaJson = json(patch.meta);
  if (patch.versionId !== undefined) set.versionId = patch.versionId;
  if (Object.keys(set).length) getDb().update(messages).set(set).where(eq(messages.id, id)).run();
  return getMessage(id);
}

export function getMessage(id: string): MessageRow | null {
  return getDb().select().from(messages).where(eq(messages.id, id)).get() ?? null;
}

/** 该版本对应的 qa_report 消息（最新一条）。 */
export function findQaMessageForVersion(versionId: string): MessageRow | null {
  return (
    getDb()
      .select()
      .from(messages)
      .where(and(eq(messages.versionId, versionId), eq(messages.role, "qa")))
      .orderBy(desc(messages.createdAt))
      .limit(1)
      .get() ?? null
  );
}

/** 把项目中仍为 running 的消息置为指定状态（停止、异常时使用）。 */
export function finishRunningMessages(projectId: string, turnId: string, status: MessageStatus): MessageRow[] {
  const db = getDb();
  const running = db
    .select()
    .from(messages)
    .where(and(eq(messages.projectId, projectId), eq(messages.turnId, turnId), eq(messages.status, "running")))
    .all();
  if (!running.length) return [];
  db.update(messages)
    .set({ status, finishedAt: Date.now() })
    .where(inArray(messages.id, running.map((m) => m.id)))
    .run();
  return running.map((m) => ({ ...m, status }));
}

/** 最近 n 条 user / pm 消息（PM 提示词的"最近对话"）。 */
export function recentChat(projectId: string, n = 6): { role: "user" | "pm"; content: string }[] {
  return getDb()
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(and(eq(messages.projectId, projectId), inArray(messages.role, ["user", "pm"]), eq(messages.status, "done")))
    .orderBy(desc(messages.createdAt))
    .limit(n)
    .all()
    .reverse() as { role: "user" | "pm"; content: string }[];
}

export function hasUserMessage(projectId: string): boolean {
  return !!getDb().select({ id: messages.id }).from(messages).where(and(eq(messages.projectId, projectId), eq(messages.role, "user"))).limit(1).get();
}

// ---------- 限流 ----------

export function countUsage(input: { visitorId: string; ip: string; sinceMs: number }) {
  const db = getDb();
  const since = gte(usageEvents.createdAt, input.sinceMs);
  const c = (where: ReturnType<typeof and>) => db.select({ n: sql<number>`count(*)` }).from(usageEvents).where(where).get()?.n ?? 0;
  return {
    visitor: c(and(since, eq(usageEvents.visitorId, input.visitorId))),
    ip: c(and(since, eq(usageEvents.ip, input.ip))),
    global: c(and(since)),
  };
}

export function insertUsage(input: { visitorId: string; ip: string; kind: "generate" | "fix"; now?: number }) {
  getDb()
    .insert(usageEvents)
    .values({ visitorId: input.visitorId, ip: input.ip, kind: input.kind, createdAt: input.now ?? Date.now() })
    .run();
}

// ---------- 模型调用记录 ----------

export type LlmCallInput = Omit<typeof llmCalls.$inferInsert, "id" | "createdAt"> & { createdAt?: number };

export function recordLlmCall(input: LlmCallInput) {
  getDb()
    .insert(llmCalls)
    .values({ ...input, createdAt: input.createdAt ?? Date.now() })
    .run();
}

export function usageSummary() {
  return getDb()
    .select({
      step: llmCalls.step,
      calls: sql<number>`count(*)`,
      ok: sql<number>`sum(${llmCalls.ok})`,
      input: sql<number>`coalesce(sum(${llmCalls.inputTokens}), 0)`,
      cached: sql<number>`coalesce(sum(${llmCalls.cachedInputTokens}), 0)`,
      output: sql<number>`coalesce(sum(${llmCalls.outputTokens}), 0)`,
      avgMs: sql<number>`avg(${llmCalls.durationMs})`,
    })
    .from(llmCalls)
    .groupBy(llmCalls.step)
    .all();
}

export function turnCount(): number {
  return getDb().select({ n: sql<number>`count(distinct ${llmCalls.turnId})` }).from(llmCalls).get()?.n ?? 0;
}

// ---------- 其他 ----------

/** 同步事务：fn 中调用的其他查询函数共享同一连接，处于同一事务内。 */
export function inTransaction<T>(fn: () => T): T {
  return getDb().transaction(() => fn());
}

export function pingDb(): boolean {
  return getDb().get<{ ok: number }>(sql`select 1 as ok`)?.ok === 1;
}
