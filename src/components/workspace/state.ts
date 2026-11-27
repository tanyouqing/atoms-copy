import type { MessageDTO, ProjectDetail, ProjectSummary, VersionFull, VersionSummary } from "@/types/api";
import type { SseEvent } from "@/types/sse";

/** 工作台状态（docs/11 §5）。SSE 事件直接映射为 action，纯函数，有单元测试。 */
export interface WorkspaceState {
  project: ProjectDetail["project"];
  messages: MessageDTO[];
  versions: VersionSummary[];
  currentVersion: VersionFull | null;
  /** 查看模式：正在查看的旧版本 */
  viewing: VersionFull | null;
  /** 正在进行的 SSE 请求 */
  running: null | { kind: "generate" | "fix"; turnId: string | null };
  /** 自由生成 / 补丁的流式代码 */
  stream: { text: string; active: boolean };
  /** 输入框上方的提示条 */
  notice: string | null;
  /** 最近一次失败的需求（用于"重试"） */
  lastPrompt: string | null;
  /** 新版本到达计数（手机端"预览"小红点） */
  versionTick: number;
}

export type WorkspaceAction =
  | { type: "sse"; event: SseEvent }
  | { type: "run/start"; kind: "generate" | "fix"; prompt?: string }
  | { type: "run/end" }
  | { type: "run/stopped" }
  | { type: "notice"; text: string | null }
  | { type: "sync"; detail: ProjectDetail }
  | { type: "project"; project: Partial<ProjectSummary> }
  | { type: "view/select_version"; version: VersionFull }
  | { type: "view/back_to_current" }
  | { type: "restore/success"; currentVersion: VersionFull; message: MessageDTO | null }
  | { type: "qa/result"; message: MessageDTO | null; currentVersion: VersionFull | null; versionStatus?: { id: string; status: VersionSummary["status"] } };

export function initState(detail: ProjectDetail): WorkspaceState {
  return {
    project: detail.project,
    messages: detail.messages,
    versions: detail.versions,
    currentVersion: detail.currentVersion,
    viewing: null,
    running: null,
    stream: { text: "", active: false },
    notice: detail.busy ? "团队正在处理上一个需求，完成后会自动刷新" : null,
    lastPrompt: null,
    versionTick: 0,
  };
}

function upsertMessage(list: MessageDTO[], m: MessageDTO): MessageDTO[] {
  const i = list.findIndex((x) => x.id === m.id);
  if (i < 0) return [...list, m];
  const next = list.slice();
  next[i] = m;
  return next;
}

function setVersionStatus(list: VersionSummary[], id: string, status: VersionSummary["status"]): VersionSummary[] {
  return list.map((v) => (v.id === id ? { ...v, status } : v));
}

function toSummary(v: VersionFull): VersionSummary {
  return { id: v.id, seq: v.seq, label: v.label, source: v.source, templateId: v.templateId, status: v.status, createdAt: v.createdAt };
}

function applySse(s: WorkspaceState, e: SseEvent): WorkspaceState {
  switch (e.type) {
    case "turn":
      return {
        ...s,
        running: s.running ? { ...s.running, turnId: e.turnId } : { kind: "generate", turnId: e.turnId },
        messages: e.userMessage ? upsertMessage(s.messages, e.userMessage) : s.messages,
        stream: { text: "", active: false },
        notice: null,
      };
    case "message":
      return { ...s, messages: upsertMessage(s.messages, e.message) };
    case "message_update": {
      const i = s.messages.findIndex((m) => m.id === e.id);
      if (i < 0) return s;
      const next = s.messages.slice();
      next[i] = { ...(next[i] as MessageDTO), ...e.patch };
      return { ...s, messages: next };
    }
    case "code_delta":
      return { ...s, stream: { text: s.stream.text + e.text, active: true } };
    case "version": {
      const versions = [toSummary(e.version), ...s.versions.filter((v) => v.id !== e.version.id)].sort((a, b) => b.seq - a.seq);
      return {
        ...s,
        versions,
        currentVersion: e.version,
        viewing: null,
        messages: upsertMessage(s.messages, e.message),
        project: { ...s.project, currentVersionId: e.version.id, currentSeq: e.version.seq, templateId: e.version.templateId },
        stream: { ...s.stream, active: false },
        versionTick: s.versionTick + 1,
      };
    }
    case "project":
      return { ...s, project: { ...s.project, ...e.project } };
    case "done":
      return { ...s, running: null, stream: { ...s.stream, active: false } };
    case "error":
      return { ...s, running: null, stream: { ...s.stream, active: false } };
  }
}

export function workspaceReducer(s: WorkspaceState, a: WorkspaceAction): WorkspaceState {
  switch (a.type) {
    case "sse":
      return applySse(s, a.event);
    case "run/start":
      return { ...s, running: { kind: a.kind, turnId: null }, notice: null, lastPrompt: a.prompt ?? s.lastPrompt, stream: { text: "", active: false } };
    case "run/end":
      return { ...s, running: null, stream: { ...s.stream, active: false } };
    case "run/stopped":
      return {
        ...s,
        running: null,
        stream: { ...s.stream, active: false },
        messages: s.messages.map((m) => (m.status === "running" ? { ...m, status: "stopped", finishedAt: Date.now() } : m)),
      };
    case "notice":
      return { ...s, notice: a.text };
    case "sync":
      return {
        ...s,
        project: a.detail.project,
        messages: a.detail.messages,
        versions: a.detail.versions,
        currentVersion: a.detail.currentVersion,
        viewing: s.viewing && a.detail.versions.some((v) => v.id === s.viewing?.id) && s.viewing.id !== a.detail.currentVersion?.id ? s.viewing : null,
      };
    case "project":
      return { ...s, project: { ...s.project, ...a.project } };
    case "view/select_version":
      return { ...s, viewing: a.version.id === s.currentVersion?.id ? null : a.version };
    case "view/back_to_current":
      return { ...s, viewing: null };
    case "restore/success":
      return {
        ...s,
        currentVersion: a.currentVersion,
        viewing: null,
        project: { ...s.project, currentVersionId: a.currentVersion.id, currentSeq: a.currentVersion.seq, templateId: a.currentVersion.templateId },
        messages: a.message ? upsertMessage(s.messages, a.message) : s.messages,
      };
    case "qa/result": {
      let next = s;
      if (a.versionStatus) {
        const { id, status } = a.versionStatus;
        next = { ...next, versions: setVersionStatus(next.versions, id, status), currentVersion: next.currentVersion?.id === id ? { ...next.currentVersion, status } : next.currentVersion };
      }
      if (a.message) next = { ...next, messages: upsertMessage(next.messages, a.message) };
      if (a.currentVersion) {
        const cv = a.currentVersion;
        next = { ...next, currentVersion: cv, viewing: null, project: { ...next.project, currentVersionId: cv.id, currentSeq: cv.seq, templateId: cv.templateId } };
      }
      return next;
    }
  }
}

/** 当前预览显示的版本 */
export const shownVersion = (s: WorkspaceState) => s.viewing ?? s.currentVersion;
