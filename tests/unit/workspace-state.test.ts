import { describe, expect, it } from "vitest";
import { initState, workspaceReducer, type WorkspaceState } from "@/components/workspace/state";
import type { MessageDTO, ProjectDetail, VersionFull } from "@/types/api";

const detail: ProjectDetail = {
  project: { id: "p", title: "新应用", templateId: null, currentSeq: null, isPublic: false, updatedAt: 0, initialPrompt: "x", currentVersionId: null },
  messages: [],
  versions: [],
  currentVersion: null,
  busy: false,
};

const msg = (id: string, extra: Partial<MessageDTO> = {}): MessageDTO => ({ id, turnId: "t", role: "pm", kind: "pm_plan", status: "running", content: "", meta: null, versionId: null, startedAt: 0, finishedAt: null, createdAt: 0, ...extra });
const ver = (id: string, seq: number): VersionFull => ({ id, seq, label: `v${seq}`, source: "template", templateId: "todo", status: "pending", createdAt: seq, html: "<html></html>", config: {}, plan: null, errors: null });

function run(s: WorkspaceState, ...events: Parameters<typeof workspaceReducer>[1][]) {
  return events.reduce(workspaceReducer, s);
}

describe("workspaceReducer", () => {
  it("turn → message → message_update → version → done", () => {
    const s = run(
      initState(detail),
      { type: "run/start", kind: "generate", prompt: "做一个待办" },
      { type: "sse", event: { type: "turn", turnId: "t", userMessage: msg("u", { role: "user", kind: "text", status: "done" }) } },
      { type: "sse", event: { type: "message", message: msg("m1") } },
      { type: "sse", event: { type: "message_update", id: "m1", patch: { status: "done", content: "好的" } } },
      { type: "sse", event: { type: "code_delta", text: "<ht" } },
      { type: "sse", event: { type: "version", version: ver("v1", 1), message: msg("vm", { role: "system", kind: "version", status: "done", versionId: "v1" }) } },
      { type: "sse", event: { type: "done", turnId: "t", versionId: "v1", fixRoundsUsed: 0 } },
    );
    expect(s.running).toBeNull();
    expect(s.messages.map((m) => m.id)).toEqual(["u", "m1", "vm"]);
    expect(s.messages[1]).toMatchObject({ status: "done", content: "好的" });
    expect(s.currentVersion?.id).toBe("v1");
    expect(s.versions.map((v) => v.seq)).toEqual([1]);
    expect(s.project.currentSeq).toBe(1);
    expect(s.stream).toEqual({ text: "<ht", active: false });
    expect(s.versionTick).toBe(1);
  });

  it("error 后运行状态复位", () => {
    const s = run(initState(detail), { type: "run/start", kind: "generate" }, { type: "sse", event: { type: "error", code: "LLM_TIMEOUT", message: "超时", retryable: true } });
    expect(s.running).toBeNull();
  });

  it("select_version / back_to_current", () => {
    let s = run(initState(detail), { type: "sse", event: { type: "version", version: ver("v1", 1), message: msg("a", { role: "system" }) } }, { type: "sse", event: { type: "version", version: ver("v2", 2), message: msg("b", { role: "system" }) } });
    s = workspaceReducer(s, { type: "view/select_version", version: ver("v1", 1) });
    expect(s.viewing?.id).toBe("v1");
    s = workspaceReducer(s, { type: "view/back_to_current" });
    expect(s.viewing).toBeNull();
    s = workspaceReducer(s, { type: "view/select_version", version: ver("v2", 2) });
    expect(s.viewing).toBeNull();
  });

  it("停止后 running 消息变为 stopped", () => {
    const s = run(initState(detail), { type: "run/start", kind: "generate" }, { type: "sse", event: { type: "message", message: msg("m1") } }, { type: "run/stopped" });
    expect(s.messages[0]?.status).toBe("stopped");
    expect(s.running).toBeNull();
  });

  it("qa 回退切换当前版本", () => {
    const s = run(
      initState(detail),
      { type: "sse", event: { type: "version", version: ver("v1", 1), message: msg("a", { role: "system" }) } },
      { type: "sse", event: { type: "version", version: ver("v2", 2), message: msg("b", { role: "system" }) } },
      { type: "qa/result", message: null, currentVersion: { ...ver("v1", 1), status: "ok" }, versionStatus: { id: "v2", status: "error" } },
    );
    expect(s.currentVersion?.id).toBe("v1");
    expect(s.versions.find((v) => v.id === "v2")?.status).toBe("error");
  });
});
