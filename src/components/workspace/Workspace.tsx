"use client";

import { AlertTriangle, Wrench } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAutoFix } from "@/hooks/useAutoFix";
import { useGeneration, type RunResult } from "@/hooks/useGeneration";
import type { AgentRole } from "@/lib/agents";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { ProjectDetail, QaMeta, VersionFull } from "@/types/api";
import type { RuntimeError } from "@/types/runtime";
import { ChatPanel } from "./ChatPanel";
import { Composer } from "./Composer";
import { PreviewPane, type PreviewTab } from "./PreviewPane";
import { ShareDialog } from "./ShareDialog";
import { initState, shownVersion, workspaceReducer } from "./state";
import { TopBar } from "./TopBar";

function useIsDesktop() {
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desktop;
}

export function Workspace({ initial }: { initial: ProjectDetail }) {
  const router = useRouter();
  const search = useSearchParams();
  const [s, dispatch] = useReducer(workspaceReducer, initial, initState);
  const gen = useGeneration(dispatch);
  const projectId = s.project.id;
  const desktop = useIsDesktop();
  const [mobileTab, setMobileTab] = useState<"chat" | "preview">("chat");
  const [previewDot, setPreviewDot] = useState(false);
  const [tab, setTab] = useState<PreviewTab>("preview");
  const [shareOpen, setShareOpen] = useState(false);
  const [runtimeErrors, setRuntimeErrors] = useState<RuntimeError[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const versionCache = useRef(new Map<string, VersionFull>());

  const sync = useCallback(async () => {
    try {
      const detail = await api.getProject(projectId);
      dispatch({ type: "sync", detail });
      return detail;
    } catch {
      return null;
    }
  }, [projectId]);

  // ---------- 测试员：客户端 QA 与自动修复 ----------
  const autofix = useAutoFix({
    onPass: async (job) => {
      try {
        const r = await api.reportStatus(job.versionId, { status: "ok", qa: { turnId: job.turnId, outcome: "pass", round: job.roundsUsed } });
        dispatch({ type: "qa/result", message: r.message, currentVersion: null, versionStatus: { id: job.versionId, status: "ok" } });
      } catch {
        void sync();
      }
    },
    onFix: async (job, errors, round) => {
      const r = await gen.start("/api/fix", { projectId, versionId: job.versionId, turnId: job.turnId, errors, round }, { kind: "fix" });
      if (r.kind === "done" && r.event.versionId) return { next: { turnId: job.turnId, versionId: r.event.versionId, roundsUsed: r.event.fixRoundsUsed }, failed: false, stopped: false };
      if (r.kind === "aborted" || r.kind === "interrupted" || r.kind === "done") {
        setTimeout(() => void sync(), 800);
        return { next: null, failed: false, stopped: true };
      }
      return { next: null, failed: true, stopped: false };
    },
    onGiveUp: async (job, errors) => {
      try {
        const r = await api.reportStatus(job.versionId, { status: "error", errors, qa: { turnId: job.turnId, outcome: "give_up", round: Math.min(job.roundsUsed, 2) } });
        dispatch({ type: "qa/result", message: r.message, currentVersion: r.currentVersion, versionStatus: { id: job.versionId, status: "error" } });
        if (r.currentVersion) toast(`已回退到 v${r.currentVersion.seq}`);
      } catch {
        void sync();
      }
    },
  });
  const busy = !!s.running || autofix.phase !== "idle";

  const handleTurn = useCallback(
    (r: RunResult) => {
      if (r.kind === "done") {
        if (r.event.versionId) autofix.begin({ turnId: r.event.turnId, versionId: r.event.versionId, roundsUsed: r.event.fixRoundsUsed });
        else void sync();
      } else if (r.kind === "aborted") setTimeout(() => void sync(), 800);
    },
    [autofix, sync],
  );

  const send = useCallback(
    async (prompt: string, isInitial = false) => {
      setRuntimeErrors([]);
      if (!desktop) setMobileTab("chat");
      const r = await gen.start("/api/generate", { projectId, prompt, isInitial }, { kind: "generate", prompt });
      handleTurn(r);
    },
    [gen, projectId, handleTurn, desktop],
  );

  const stop = () => {
    gen.stop();
    autofix.cancel();
  };

  // ---------- 首次进入：自动开始 / 恢复 QA / 等待进行中的任务 ----------
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    if (search.get("start") === "1") {
      router.replace(`/p/${projectId}`, { scroll: false });
      if (!initial.busy && initial.messages.length === 0 && !initial.currentVersion) {
        void send(initial.project.initialPrompt, true);
        return;
      }
    }
    const cv = initial.currentVersion;
    if (cv && cv.status === "pending" && !initial.busy) {
      const qa = [...initial.messages].reverse().find((m) => m.role === "qa" && m.versionId === cv.id && m.status === "running");
      if (qa) autofix.begin({ turnId: qa.turnId, versionId: cv.id, roundsUsed: (qa.meta as QaMeta | null)?.round ?? 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!s.notice?.startsWith("团队正在处理上一个需求，完成后")) return;
    const t = setInterval(async () => {
      const d = await sync();
      if (d && !d.busy) dispatch({ type: "notice", text: null });
    }, 3000);
    return () => clearInterval(t);
  }, [s.notice, sync]);

  // ---------- 预览 ----------
  const shown = shownVersion(s);
  const runningAgent = [...s.messages].reverse().find((m) => m.status === "running" && (m.role === "pm" || m.role === "engineer" || m.role === "qa"));
  const activeRole = runningAgent ? (runningAgent.role as AgentRole) : null;
  const lastEngineer = [...s.messages].reverse().find((m) => m.role === "engineer");
  const freeStreaming = !!s.running && s.stream.active && lastEngineer?.kind === "engineer_code" && lastEngineer.status === "running";
  useEffect(() => {
    if (freeStreaming) setTab("code");
  }, [freeStreaming]);
  useEffect(() => {
    if (s.versionTick === 0) return;
    setTab("preview");
    setRuntimeErrors([]);
    if (!desktop) setPreviewDot(true);
  }, [s.versionTick, desktop]);
  useEffect(() => setRuntimeErrors([]), [shown?.id]);

  const onPreviewError = useCallback(
    (versionId: string, e: RuntimeError) => {
      if (autofix.onPreviewError(versionId, e)) return;
      if (versionId !== shown?.id) return;
      if (e.message.includes("ResizeObserver loop")) return;
      setRuntimeErrors((prev) => (prev.some((x) => x.message === e.message) ? prev : [...prev, e].slice(0, 10)));
    },
    [autofix, shown?.id],
  );
  const onPreviewReady = useCallback((versionId: string, r: { errors: RuntimeError[]; blank: boolean }) => autofix.onPreviewReady(versionId, r), [autofix]);

  const manualFix = async () => {
    const v = s.currentVersion;
    if (!v || !runtimeErrors.length) return;
    const errors = runtimeErrors;
    setRuntimeErrors([]);
    setShowErrors(false);
    const r = await gen.start("/api/fix", { projectId, versionId: v.id, turnId: null, errors, round: 1, manual: true }, { kind: "fix" });
    handleTurn(r);
  };

  // ---------- 版本 ----------
  const selectVersion = async (id: string) => {
    if (id === s.currentVersion?.id) {
      dispatch({ type: "view/back_to_current" });
      return;
    }
    try {
      const v = versionCache.current.get(id) ?? (await api.getVersion(id)).version;
      versionCache.current.set(id, v);
      dispatch({ type: "view/select_version", version: v });
      setTab("preview");
      if (!desktop) setMobileTab("preview");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "加载版本失败");
    }
  };

  const restore = async () => {
    if (!s.viewing) return;
    try {
      const r = await api.restoreVersion(projectId, s.viewing.id);
      dispatch({ type: "restore/success", currentVersion: r.currentVersion, message: r.message });
      toast.success(`已恢复到 v${r.currentVersion.seq}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "恢复失败");
    }
  };

  const rename = async (title: string) => {
    try {
      const { project } = await api.updateProject(projectId, { title });
      dispatch({ type: "project", project });
      toast.success("已重命名");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "重命名失败");
    }
  };

  const remove = async () => {
    try {
      await api.deleteProject(projectId);
      toast.success("已删除");
      router.push("/");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "删除失败");
    }
  };

  useEffect(() => {
    document.title = `${s.project.title} · Atoms Demo`;
  }, [s.project.title]);

  const lastUserPrompt = [...s.messages].reverse().find((m) => m.role === "user")?.content ?? s.project.initialPrompt;
  const retry = () => void send(s.lastPrompt ?? lastUserPrompt);

  const banner = s.viewing ? (
    <div className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="viewing-banner">
      <span className="min-w-0 flex-1 truncate">
        正在查看 v{s.viewing.seq} · {s.viewing.label}（只读）
      </span>
      <Button size="sm" variant="primary" onClick={() => void restore()} disabled={busy}>
        恢复此版本
      </Button>
      <Button size="sm" onClick={() => dispatch({ type: "view/back_to_current" })}>
        返回当前
      </Button>
    </div>
  ) : null;

  const errorBar =
    runtimeErrors.length > 0 && autofix.phase === "idle" && !s.running ? (
      <div className="absolute inset-x-3 bottom-3 z-10 rounded-xl border border-red-200 bg-white p-3 shadow-lg" data-testid="error-bar">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <AlertTriangle size={16} className="text-[var(--danger)]" />
          <span className="flex-1 text-[var(--danger)]">应用出现了 {runtimeErrors.length} 个错误</span>
          <Button size="sm" variant="ghost" onClick={() => setShowErrors((v) => !v)}>
            {showErrors ? "收起" : "查看"}
          </Button>
          {!s.viewing && (
            <Button size="sm" variant="primary" onClick={() => void manualFix()}>
              <Wrench size={14} /> 让测试员修复
            </Button>
          )}
        </div>
        {showErrors && (
          <ul className="mt-2 max-h-32 space-y-1 overflow-auto font-mono text-xs text-zinc-600">
            {runtimeErrors.map((e, i) => (
              <li key={i}>
                {e.line ? `L${e.line}: ` : ""}
                {e.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    ) : null;

  const noVersionYet = !s.currentVersion;
  const lastIsError = s.messages.at(-1)?.role === "system" && s.messages.at(-1)?.kind === "error";

  const chat = (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg)]">
      <ChatPanel messages={s.messages} versions={s.versions} currentVersionId={s.currentVersion?.id ?? null} viewingId={s.viewing?.id ?? null} busy={busy} onSelectVersion={(id) => void selectVersion(id)} onRetry={retry} />
      <Composer busy={busy} notice={s.notice} onSend={(t) => void send(t)} onStop={stop} showRegenerate={noVersionYet && !lastIsError && s.messages.length > 0} onRegenerate={retry} />
    </div>
  );

  const preview = (
    <PreviewPane
      projectId={projectId}
      version={shown}
      viewing={!!s.viewing}
      working={busy}
      tab={desktop ? tab : "preview"}
      onTab={setTab}
      stream={s.stream}
      showStream={freeStreaming}
      isPublic={s.project.isPublic}
      onOpenShare={() => setShareOpen(true)}
      onError={onPreviewError}
      onReady={onPreviewReady}
      banner={banner}
      errorBar={errorBar}
      hideCodeTab={!desktop}
      onRemount={() => setRuntimeErrors([])}
      downloadName={s.project.title}
      activeRole={activeRole}
    />
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar
        title={s.project.title}
        versions={s.versions}
        currentId={s.currentVersion?.id ?? null}
        viewingId={s.viewing?.id ?? null}
        downloadId={shown?.id ?? null}
        downloadSeq={shown?.seq}
        onRename={(t) => void rename(t)}
        onSelectVersion={(id) => void selectVersion(id)}
        onShare={() => setShareOpen(true)}
        onDelete={() => void remove()}
      />
      {desktop ? (
        <PanelGroup direction="horizontal" autoSaveId="atoms:ui:panel" className="min-h-0 flex-1">
          <Panel defaultSize={32} minSize={24} maxSize={50} className="border-r border-[var(--border)]">
            {chat}
          </Panel>
          <PanelResizeHandle className="w-1 bg-transparent transition-colors hover:bg-[var(--brand-soft)] data-[resize-handle-state=drag]:bg-[#f3c2ad]" />
          <Panel minSize={40}>{preview}</Panel>
        </PanelGroup>
      ) : (
        <>
          <div className="flex shrink-0 gap-1 border-b border-[var(--border)] bg-[var(--panel)] p-1.5" role="tablist">
            {(["chat", "preview"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={mobileTab === t}
                onClick={() => {
                  setMobileTab(t);
                  if (t === "preview") setPreviewDot(false);
                }}
                className={cn("relative flex-1 rounded-lg py-1.5 text-sm transition-colors", mobileTab === t ? "bg-zinc-900 font-medium text-white" : "text-zinc-600")}
              >
                {t === "chat" ? "对话" : "预览"}
                {t === "preview" && previewDot && mobileTab === "chat" && <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-[var(--danger)]" data-testid="preview-dot" />}
              </button>
            ))}
          </div>
          <div className="relative min-h-0 flex-1">
            <div className={cn("absolute inset-0", mobileTab !== "chat" && "invisible")}>{chat}</div>
            <div className={cn("absolute inset-0", mobileTab !== "preview" && "invisible")}>{preview}</div>
          </div>
        </>
      )}
      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} projectId={projectId} isPublic={s.project.isPublic} onChange={(v) => dispatch({ type: "project", project: { isPublic: v } })} />
    </div>
  );
}

