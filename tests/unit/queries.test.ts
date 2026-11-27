import { beforeEach, describe, expect, it } from "vitest";
import { setDbForTests } from "@/lib/db";
import {
  countUsage,
  createProject,
  createVersion,
  deleteProject,
  getProjectDetail,
  getProjectForVisitor,
  insertMessage,
  insertUsage,
  lastOkVersion,
  listMessages,
  listProjects,
  setCurrentVersion,
  updateMessage,
  updateVersionStatus,
  upsertVisitor,
} from "@/lib/db/queries";

const V = "visitor_aaaaaaaaaaaaaa";

function version(projectId: string, extra: Partial<Parameters<typeof createVersion>[0]> = {}) {
  return createVersion({
    projectId,
    turnId: "t1",
    label: "初版",
    source: "template",
    templateId: "todo",
    config: { a: 1 },
    html: "<html></html>",
    plan: null,
    status: "pending",
    errors: null,
    parentVersionId: null,
    ...extra,
  });
}

describe("queries", () => {
  beforeEach(() => {
    setDbForTests(":memory:");
    upsertVisitor(V);
  });

  it("createProject → createVersion（seq 递增）→ setCurrentVersion → lastOkVersion", () => {
    const p = createProject({ visitorId: V, prompt: "做一个待办" });
    const v1 = version(p.id);
    const v2 = version(p.id, { label: "第二版" });
    expect([v1.seq, v2.seq]).toEqual([1, 2]);
    expect(getProjectForVisitor(p.id, V)?.currentVersionId).toBe(v2.id);

    setCurrentVersion(p.id, v1.id);
    expect(getProjectForVisitor(p.id, V)?.currentVersionId).toBe(v1.id);

    expect(lastOkVersion(p.id)).toBeNull();
    updateVersionStatus(v1.id, "ok");
    updateVersionStatus(v2.id, "ok");
    expect(lastOkVersion(p.id)?.id).toBe(v2.id);
    expect(lastOkVersion(p.id, v2.id)?.id).toBe(v1.id);
  });

  it("归属校验：其他访客读不到", () => {
    const p = createProject({ visitorId: V, prompt: "x" });
    upsertVisitor("visitor_bbbbbbbbbbbbbb");
    expect(getProjectForVisitor(p.id, "visitor_bbbbbbbbbbbbbb")).toBeNull();
    expect(getProjectDetail(p.id, "visitor_bbbbbbbbbbbbbb", false)).toBeNull();
  });

  it("项目详情包含消息（按时间升序）、版本（seq 倒序）与当前版本", () => {
    const p = createProject({ visitorId: V, prompt: "x" });
    const m1 = insertMessage({ projectId: p.id, turnId: "t1", role: "user", kind: "text", status: "done", content: "hi" });
    const m2 = insertMessage({ projectId: p.id, turnId: "t1", role: "pm", kind: "pm_plan", status: "running" });
    updateMessage(m2.id, { status: "done", content: "ok", meta: { a: 1 } });
    version(p.id);
    version(p.id);
    const d = getProjectDetail(p.id, V, false);
    expect(d?.messages.map((m) => m.id)).toEqual([m1.id, m2.id]);
    expect(d?.messages[1]?.meta).toEqual({ a: 1 });
    expect(d?.messages[1]?.finishedAt).not.toBeNull();
    expect(d?.versions.map((v) => v.seq)).toEqual([2, 1]);
    expect(d?.currentVersion?.seq).toBe(2);
    expect(d?.currentVersion?.config).toEqual({ a: 1 });
    expect(listProjects(V)[0]?.currentSeq).toBe(2);
  });

  it("删除项目级联删除版本和消息", () => {
    const p = createProject({ visitorId: V, prompt: "x" });
    insertMessage({ projectId: p.id, turnId: "t1", role: "user", kind: "text", status: "done" });
    version(p.id);
    deleteProject(p.id);
    expect(listMessages(p.id)).toEqual([]);
    expect(lastOkVersion(p.id)).toBeNull();
    expect(listProjects(V)).toEqual([]);
  });

  it("countUsage 按窗口统计访客、IP、全站", () => {
    insertUsage({ visitorId: V, ip: "1.1.1.1", kind: "generate", now: 1000 });
    insertUsage({ visitorId: V, ip: "1.1.1.1", kind: "fix", now: 5000 });
    insertUsage({ visitorId: "other", ip: "2.2.2.2", kind: "generate", now: 6000 });
    expect(countUsage({ visitorId: V, ip: "1.1.1.1", sinceMs: 0 })).toEqual({ visitor: 2, ip: 2, global: 3 });
    expect(countUsage({ visitorId: V, ip: "1.1.1.1", sinceMs: 2000 })).toEqual({ visitor: 1, ip: 1, global: 2 });
  });
});
