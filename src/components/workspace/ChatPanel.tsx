"use client";

import { ArrowDown, RotateCcw } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SOURCE_LABELS } from "@/lib/agents";
import { clockTime, cn } from "@/lib/utils";
import type { MessageDTO, VersionSummary } from "@/types/api";
import { useMounted } from "@/hooks/useMounted";
import { AgentCard } from "./AgentCard";

function VersionCard({ m, version, isCurrent, isViewing, onSelect }: { m: MessageDTO; version: VersionSummary | undefined; isCurrent: boolean; isViewing: boolean; onSelect: () => void }) {
  const mounted = useMounted();
  const meta = (m.meta ?? {}) as { seq?: number; source?: keyof typeof SOURCE_LABELS };
  const source = version?.source ?? meta.source;
  return (
    <button
      type="button"
      data-testid="version-card"
      onClick={onSelect}
      className={cn("flex w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm transition-colors hover:border-[var(--brand)]", isViewing ? "border-[var(--warning)]" : "border-[var(--border)]")}
    >
      <span className="rounded-md bg-zinc-900 px-1.5 py-0.5 text-xs font-semibold text-white">v{version?.seq ?? meta.seq}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{version?.label ?? m.content}</span>
      {source && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">{SOURCE_LABELS[source]}</span>}
      {version?.status === "error" && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-[var(--danger)]">有问题</span>}
      <span className="text-xs text-[var(--muted)]">{mounted ? clockTime(m.createdAt) : ""}</span>
      {isCurrent && <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-xs font-medium text-indigo-700">当前</span>}
    </button>
  );
}

export function ChatPanel(props: {
  messages: MessageDTO[];
  versions: VersionSummary[];
  currentVersionId: string | null;
  viewingId: string | null;
  busy: boolean;
  onSelectVersion: (id: string) => void;
  onRetry: () => void;
}) {
  const { messages } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState(true);
  const [hasNew, setHasNew] = useState(false);
  const lastErrorId = [...messages].reverse().find((m) => m.role === "system" && m.kind === "error")?.id;
  const lastIsError = messages.at(-1)?.id === lastErrorId;

  const signature = messages.map((m) => `${m.id}:${m.status}:${m.content.length}`).join("|");
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (stick) el.scrollTop = el.scrollHeight;
    else setHasNew(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setStick(atBottom);
    if (atBottom) setHasNew(false);
  };

  const byId = new Map(props.versions.map((v) => [v.id, v]));

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} onScroll={onScroll} className="h-full space-y-3 overflow-y-auto px-4 py-4" data-testid="chat-scroll">
        {messages.map((m) => {
          if (m.role === "user")
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-xl rounded-br-sm bg-[var(--brand)] px-3 py-2 text-sm text-white" data-testid="user-message">
                  {m.content}
                </div>
              </div>
            );
          if (m.role === "system" && m.kind === "version")
            return (
              <VersionCard
                key={m.id}
                m={m}
                version={m.versionId ? byId.get(m.versionId) : undefined}
                isCurrent={!!m.versionId && m.versionId === props.currentVersionId}
                isViewing={!!m.versionId && m.versionId === props.viewingId}
                onSelect={() => m.versionId && props.onSelectVersion(m.versionId)}
              />
            );
          if (m.role === "system" && m.kind === "error")
            return (
              <div key={m.id} className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-[var(--danger)]" data-testid="error-message">
                <p>{m.content}</p>
                {m.id === lastErrorId && lastIsError && !props.busy && (
                  <Button size="sm" className="mt-2" onClick={props.onRetry}>
                    <RotateCcw size={14} /> 重试
                  </Button>
                )}
              </div>
            );
          if (m.role === "system")
            return (
              <p key={m.id} className="text-center text-xs text-[var(--muted)]" data-testid="system-notice">
                {m.content}
              </p>
            );
          return <AgentCard key={m.id} m={m} />;
        })}
      </div>
      {hasNew && !stick && (
        <button
          type="button"
          onClick={() => {
            const el = scrollRef.current;
            if (el) el.scrollTop = el.scrollHeight;
            setStick(true);
            setHasNew(false);
          }}
          className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-zinc-900 px-3 py-1.5 text-xs text-white shadow-lg"
        >
          <ArrowDown size={12} /> 新消息
        </button>
      )}
    </div>
  );
}
