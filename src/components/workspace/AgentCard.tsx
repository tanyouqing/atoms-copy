"use client";

import { Check, ChevronRight, Loader2, Square, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { AgentAvatar } from "@/components/ui/avatar";
import { useMounted } from "@/hooks/useMounted";
import { AGENTS, type AgentRole } from "@/lib/agents";
import { TEMPLATES } from "@/lib/templates/registry";
import { cn, fmtDuration } from "@/lib/utils";
import type { MessageDTO, QaMeta } from "@/types/api";

const STATUS_TEXT = { running: "进行中", done: "完成", error: "失败", stopped: "已停止" } as const;

function StatusIcon({ status }: { status: MessageDTO["status"] }) {
  if (status === "running") return <Loader2 size={14} className="animate-spin text-[var(--brand)]" aria-label="进行中" />;
  if (status === "done") return <Check size={14} className="text-[var(--success)]" aria-label="完成" />;
  if (status === "error") return <X size={14} className="text-[var(--danger)]" aria-label="失败" />;
  return <Square size={12} className="fill-zinc-400 text-zinc-400" aria-label="已停止" />;
}

function Elapsed({ m }: { m: MessageDTO }) {
  const mounted = useMounted();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (m.status !== "running") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [m.status]);
  const end = m.finishedAt ?? (m.status === "running" ? now : m.startedAt);
  // 运行中的耗时依赖当前时间，服务端与浏览器不一致，挂载后再显示
  const text = m.status === "running" && !mounted ? "" : fmtDuration(Math.max(0, end - m.startedAt));
  return <span className="text-xs tabular-nums text-[var(--muted)]">{text}</span>;
}

function Collapsible({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand)]">
        <ChevronRight size={14} className={cn("transition-transform", open && "rotate-90")} />
        {label}
      </button>
      {open && <div className="mt-1.5 max-h-60 overflow-auto rounded-lg bg-zinc-50 p-2 font-mono text-[11px] leading-relaxed text-zinc-700">{children}</div>}
    </div>
  );
}

interface PmMeta {
  templateId?: string | null;
  features?: string[];
  appName?: string;
  intent?: string;
}

const INTENT_TEXT: Record<string, string> = { new_app: "新建应用", config_edit: "修改配置", code_patch: "代码补丁", regenerate: "重新生成" };

function PmBody({ m }: { m: MessageDTO }) {
  const meta = (m.meta ?? {}) as PmMeta;
  if (m.status !== "done") return <p>{m.content}</p>;
  const tpl = meta.templateId ? (TEMPLATES.find((t) => t.id === meta.templateId)?.name ?? meta.templateId) : "自由生成";
  return (
    <>
      <p className="text-zinc-800">{m.content}</p>
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
        <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 font-medium text-indigo-700">模板：{tpl}</span>
        {meta.intent && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">{INTENT_TEXT[meta.intent] ?? meta.intent}</span>}
      </div>
      {meta.features && meta.features.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-zinc-600">
          {meta.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
    </>
  );
}

function EngineerBody({ m }: { m: MessageDTO }) {
  const meta = (m.meta ?? {}) as { config?: unknown; patches?: { search: string; replace: string }[]; fallback?: string };
  return (
    <>
      <p className={cn(m.status === "error" ? "text-[var(--danger)]" : "text-zinc-800")}>{m.content}</p>
      {m.kind === "engineer_config" && meta.config !== undefined && m.status === "done" && (
        <Collapsible label="查看配置">
          <pre className="whitespace-pre-wrap break-all">{JSON.stringify(meta.config, null, 2)}</pre>
        </Collapsible>
      )}
      {m.kind === "engineer_patch" && meta.patches && meta.patches.length > 0 && (
        <Collapsible label={`查看 ${meta.patches.length} 处修改`}>
          {meta.patches.map((p, i) => (
            <div key={i} className="mb-2 last:mb-0">
              <div className="whitespace-pre-wrap break-all text-red-700">{p.search.split("\n").map((l) => `- ${l}`).join("\n")}</div>
              <div className="whitespace-pre-wrap break-all text-green-700">{p.replace ? p.replace.split("\n").map((l) => `+ ${l}`).join("\n") : "+ （删除）"}</div>
            </div>
          ))}
        </Collapsible>
      )}
    </>
  );
}

function QaBody({ m }: { m: MessageDTO }) {
  const meta = (m.meta ?? {}) as Partial<QaMeta>;
  const errors = meta.errors ?? [];
  const pass = meta.outcome === "pass" || meta.outcome === "fixed";
  return (
    <>
      <p className={cn(pass ? "text-[var(--success)]" : m.status === "error" ? "text-[var(--danger)]" : "text-zinc-800")}>
        {m.content}
        {pass && " ✓"}
      </p>
      {!pass && errors.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {errors.slice(0, 3).map((e, i) => (
            <li key={i} className="truncate font-mono text-[11px] text-zinc-500" title={e.message}>
              {e.line ? `L${e.line} ` : ""}
              {e.message}
            </li>
          ))}
          {errors.length > 3 && <li className="text-[11px] text-zinc-400">还有 {errors.length - 3} 条…</li>}
        </ul>
      )}
      {(meta.round ?? 0) > 0 && <p className="mt-1 text-xs text-[var(--muted)]">已修复 {meta.round}/2 轮</p>}
    </>
  );
}

export function AgentCard({ m }: { m: MessageDTO }) {
  const role = m.role as AgentRole;
  const agent = AGENTS[role];
  return (
    <div data-testid={`agent-card-${role}`} data-status={m.status} className={cn("rounded-xl border bg-white p-3", m.status === "error" ? "border-red-200" : "border-[var(--border)]")}>
      <div className="flex items-center gap-2.5">
        <AgentAvatar role={role} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            {agent.name}
            <StatusIcon status={m.status} />
            <span className="sr-only">{STATUS_TEXT[m.status]}</span>
          </div>
        </div>
        <Elapsed m={m} />
      </div>
      <div className="mt-2 pl-[42px] text-sm leading-relaxed">
        {role === "pm" ? <PmBody m={m} /> : role === "engineer" ? <EngineerBody m={m} /> : <QaBody m={m} />}
        {m.status === "stopped" && <p className="mt-1 text-xs text-[var(--muted)]">已停止</p>}
      </div>
    </div>
  );
}
