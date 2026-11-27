"use client";

import { Download, ExternalLink, Eraser, Monitor, RotateCw, Smartphone } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import { AgentAvatar } from "@/components/ui/avatar";
import { AGENTS, type AgentRole } from "@/lib/agents";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useMounted } from "@/hooks/useMounted";
import { readStorageSnapshot, usePreviewBridge } from "@/hooks/usePreviewBridge";
import { buildSrcdoc } from "@/lib/preview/build-srcdoc";
import { cn } from "@/lib/utils";
import type { VersionFull } from "@/types/api";
import type { RuntimeError } from "@/types/runtime";
import { PreviewFrame } from "./PreviewFrame";

const CodeView = dynamic(() => import("./CodeView"), { ssr: false, loading: () => <div className="p-4 text-sm text-[var(--muted)]">加载代码查看器…</div> });

export type PreviewTab = "preview" | "code";

const ORDER = ["pm", "engineer", "qa"] as const;

function EmptyPreview({ working, activeRole }: { working: boolean; activeRole?: AgentRole | null }) {
  if (!working)
    return (
      <div className="paper-dots flex h-full flex-col items-center justify-center gap-2 text-sm text-[var(--muted)]">
        <div className="flex -space-x-2 opacity-60 grayscale">
          {ORDER.map((r) => (
            <AgentAvatar key={r} role={r} className="h-9 w-9 ring-2 ring-white" />
          ))}
        </div>
        <p>还没有可预览的版本</p>
      </div>
    );
  const active = activeRole ?? "pm";
  const idx = ORDER.indexOf(active);
  return (
    <div className="paper-dots flex h-full flex-col items-center justify-center gap-5 text-sm text-[var(--muted)]">
      <div className="flex items-center gap-3">
        {ORDER.map((r, i) => (
          <div key={r} className="flex items-center gap-3">
            <span className={cn("transition-all duration-300", r === active ? "atoms-bounce" : i < idx ? "opacity-80" : "opacity-40 grayscale")}>
              <AgentAvatar role={r} className={cn("transition-all duration-300", r === active ? "h-14 w-14" : "h-10 w-10")} active={r === active} />
            </span>
            {i < ORDER.length - 1 && <span className={cn("h-px w-6 transition-colors duration-300", i < idx ? "bg-zinc-500" : "bg-zinc-300")} />}
          </div>
        ))}
      </div>
      <p className="text-zinc-600" aria-live="polite">
        {AGENTS[active].busy}…
      </p>
    </div>
  );
}

export function PreviewPane(props: {
  projectId: string;
  version: VersionFull | null;
  viewing: boolean;
  working: boolean;
  tab: PreviewTab;
  onTab: (t: PreviewTab) => void;
  stream: { text: string; active: boolean };
  showStream: boolean;
  isPublic: boolean;
  onOpenShare: () => void;
  onError: (versionId: string, e: RuntimeError) => void;
  onReady: (versionId: string, r: { errors: RuntimeError[]; blank: boolean }) => void;
  banner?: React.ReactNode;
  errorBar?: React.ReactNode;
  hideCodeTab?: boolean;
  onRemount?: () => void;
  downloadName?: string;
  activeRole?: AgentRole | null;
}) {
  const { version, projectId } = props;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const storageKey = `atoms:data:${projectId}`;
  const [renderKey, setRenderKey] = useState(0);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [confirmReset, setConfirmReset] = useState(false);
  const versionId = version?.id ?? null;
  const channel = useMemo(() => `${versionId}-${renderKey}-${Math.random().toString(36).slice(2)}`, [versionId, renderKey]);
  const mounted = useMounted();
  // srcdoc 必须和 channel（iframe 的 key）在同一次渲染里算出来：
  // 以前用 effect 晚一拍更新，新 iframe 会先加载上一个版本的代码再切换。
  // 上一个版本如果有死循环，会卡住沙箱进程，新版本（包括回退后的版本）就一直空白，直到刷新页面。
  // 只在挂载后计算：依赖 window.location 和父页面 localStorage，服务端没有。
  const srcdoc = useMemo(
    () => (mounted && version ? buildSrcdoc({ html: version.html, channel, storage: readStorageSnapshot(storageKey) }) : ""),
    // 只在版本或渲染次数变化时重建（channel 已包含二者）
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [channel, mounted],
  );

  const { onError: pe, onReady: pr, onRemount } = props;
  const onError = useCallback((e: RuntimeError) => versionId && pe(versionId, e), [versionId, pe]);
  const onReady = useCallback((r: { errors: RuntimeError[]; blank: boolean }) => versionId && pr(versionId, r), [versionId, pr]);
  usePreviewBridge({ iframeRef, channel, storageKey, onError, onReady });

  const remount = (reset: boolean) => {
    if (reset) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // 父页面存储不可用时忽略
      }
    }
    onRemount?.();
    setRenderKey((k) => k + 1);
  };

  const codeText = props.showStream ? props.stream.text : (version?.html ?? "");

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--panel)]">
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-[var(--border)] px-2">
        {!props.hideCodeTab && (
          <div className="flex rounded-lg bg-zinc-100 p-0.5 text-sm" role="tablist">
            {(["preview", "code"] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={props.tab === t} onClick={() => props.onTab(t)} className={cn("rounded-md px-3 py-1", props.tab === t ? "bg-white font-medium text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800")}>
                {t === "preview" ? "预览" : "代码"}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <Button variant="ghost" size="icon" aria-label="刷新预览" title="刷新预览" disabled={!version} onClick={() => remount(false)}>
            <RotateCw size={16} />
          </Button>
          <Button variant="ghost" size="icon" className="hidden lg:inline-flex" aria-label={device === "desktop" ? "切换到手机宽度" : "切换到桌面宽度"} title={device === "desktop" ? "手机宽度" : "桌面宽度"} onClick={() => setDevice((d) => (d === "desktop" ? "mobile" : "desktop"))}>
            {device === "desktop" ? <Smartphone size={16} /> : <Monitor size={16} />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="在新标签打开（分享页）"
            title="在新标签打开（分享页）"
            disabled={!version}
            onClick={() => (props.isPublic ? window.open(`/share/${projectId}${props.viewing && version ? `?v=${version.seq}` : ""}`, "_blank", "noopener") : props.onOpenShare())}
          >
            <ExternalLink size={16} />
          </Button>
          <a
            aria-label="下载 HTML"
            title="下载 HTML"
            href={version ? `/api/versions/${version.id}/download` : undefined}
            className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100", !version && "pointer-events-none opacity-40")}
            download={version ? `${props.downloadName ?? "app"}-v${version.seq}.html` : undefined}
            data-testid="download-link"
          >
            <Download size={16} />
          </a>
          <Button variant="ghost" size="sm" aria-label="重置应用数据" title="重置应用数据" disabled={!version} onClick={() => setConfirmReset(true)}>
            <Eraser size={16} /> <span className="hidden xl:inline">重置数据</span>
          </Button>
        </div>
      </div>
      {props.banner}
      <div className="relative min-h-0 flex-1">
        <div className={cn("absolute inset-0", props.tab !== "preview" && "invisible")}>
          {version && srcdoc ? (
            <div className={cn("h-full w-full", device === "mobile" && "flex items-start justify-center overflow-auto bg-zinc-100 py-4")}>
              <div className={cn("h-full w-full", device === "mobile" && "h-[760px] max-h-full w-[390px] overflow-hidden rounded-[28px] border-8 border-zinc-900 bg-white shadow-lg")}>
                <PreviewFrame key={channel} srcdoc={srcdoc} iframeRef={iframeRef} />
              </div>
            </div>
          ) : (
            <EmptyPreview working={props.working} activeRole={props.activeRole} />
          )}
        </div>
        {props.tab === "code" && (
          <div className="absolute inset-0">
            {codeText ? <CodeView code={codeText} config={props.showStream ? null : (version?.config ?? null)} streaming={props.showStream} /> : <EmptyPreview working={props.working} activeRole={props.activeRole} />}
          </div>
        )}
        {props.tab === "preview" && props.errorBar}
      </div>
      <ConfirmDialog open={confirmReset} onClose={() => setConfirmReset(false)} title="重置应用数据" description="将清空这个应用里保存的所有数据，确定吗？" confirmText="重置" danger onConfirm={() => remount(true)} />
    </div>
  );
}
