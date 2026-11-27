/**
 * 真实模型冒烟（docs/13 §4）：用真实 Key 跑 8 条需求 + 2 条修改，打印每条的意图、模板、耗时、静态检查结果与 token 汇总。
 * 用法：DEEPSEEK_API_KEY=sk-... npm run smoke:llm [-- --only=1,8] [-- --debug-body]
 * 数据写入 ./data/smoke.db（不影响正式库）。
 */
const args = process.argv.slice(2);
process.env.DATABASE_PATH ||= "./data/smoke.db";
if (args.includes("--debug-body")) process.env.LLM_DEBUG_BODY = "1";

const CASES = [
  { prompt: "做一个每日喝水打卡应用，目标每天 8 杯", expect: "todo" },
  { prompt: "帮我做一个记账本，记录日常开销，按类别看饼图", expect: "ledger" },
  { prompt: "做一个公司年会报名表，收集姓名、部门、手机号、是否参加晚宴、饮食禁忌", expect: "form" },
  { prompt: "做一个内容排期看板，列为选题、写作中、待审核、已发布", expect: "kanban" },
  { prompt: "给我的咖啡店做一个介绍页，有菜单、营业时间和联系方式", expect: "landing" },
  { prompt: "做一个跑步数据仪表盘，展示本月跑量、配速趋势和每周对比", expect: "dashboard" },
  { prompt: "做一个中国历史知识问答小游戏，10 道题", expect: "game" },
  { prompt: "做一个番茄钟，25 分钟专注 5 分钟休息，有提示音", expect: "null" },
];
const FOLLOWUPS = [
  { prompt: "把主色改成橙色，标题改成『喝水小助手』", expect: "config_edit" },
  { prompt: "加一个按钮，可以把打卡记录导出成 CSV", expect: "code_patch" },
];

async function main() {
  const { getEnv } = await import("@/lib/env");
  if (getEnv().mock) console.log("注意：LLM_MOCK=1，本次不会调用真实模型");
  const q = await import("@/lib/db/queries");
  const { runTurn, guardTurn } = await import("@/lib/agent/pipeline");
  const { createMessenger } = await import("@/lib/agent/messages");
  const { staticCheck } = await import("@/lib/agent/qa-static");
  type SseEvent = import("@/types/sse").SseEvent;

  const only = args
    .find((a) => a.startsWith("--only="))
    ?.slice(7)
    .split(",")
    .map(Number);
  const visitorId = "smoke_test_visitor_00";
  q.upsertVisitor(visitorId);

  async function turn(projectId: string, prompt: string) {
    const project = q.getProjectById(projectId);
    if (!project) throw new Error("project missing");
    const current = project.currentVersionId ? q.getVersion(project.currentVersionId) : null;
    const turnId = q.newId();
    const events: SseEvent[] = [];
    const emit = (e: SseEvent) => void events.push(e);
    const msg = createMessenger(projectId, turnId, emit);
    q.insertMessage({ projectId, turnId, role: "user", kind: "text", status: "done", content: prompt });
    const t0 = Date.now();
    const signal = new AbortController().signal;
    await guardTurn({ turnId, signal, emit, msg, systemErrorMessage: true, logCtx: { smoke: true } }, () =>
      runTurn({ project, current, prompt, turnId, signal, isFirstTurn: !current }, emit, msg),
    );
    const done = events.find((e) => e.type === "done");
    const err = events.find((e) => e.type === "error");
    const ver = events.find((e) => e.type === "version");
    const pm = q.listMessages(projectId).find((m) => m.turnId === turnId && m.role === "pm")?.meta as { intent?: string; templateId?: string | null } | undefined;
    return {
      intent: pm?.intent,
      template: pm?.templateId ?? "null",
      source: ver?.type === "version" ? ver.version.source : null,
      ok: done?.type === "done" && !!done.versionId,
      static: ver?.type === "version" ? staticCheck(ver.version.html).length === 0 : false,
      fix: done?.type === "done" ? done.fixRoundsUsed : null,
      error: err?.type === "error" ? err.code : null,
      sec: ((Date.now() - t0) / 1000).toFixed(1),
    };
  }

  const rows: Record<string, unknown>[] = [];
  let firstProject: string | null = null;
  for (const [i, c] of CASES.entries()) {
    if (only && !only.includes(i + 1)) continue;
    const p = q.createProject({ visitorId, prompt: c.prompt });
    if (i === 0) firstProject = p.id;
    rows.push({ "#": i + 1, expect: c.expect, ...(await turn(p.id, c.prompt)) });
    console.log(JSON.stringify(rows.at(-1)));
  }
  if (firstProject) {
    for (const f of FOLLOWUPS) {
      rows.push({ "#": "追问", expect: f.expect, ...(await turn(firstProject, f.prompt)) });
      console.log(JSON.stringify(rows.at(-1)));
    }
  }
  console.table(rows);
  console.table(q.usageSummary());
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
