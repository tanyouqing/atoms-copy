"use client";

import { ArrowLeft, ChevronDown, Download, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Menu, MenuItem } from "@/components/ui/menu";
import { SOURCE_LABELS } from "@/lib/agents";
import { clockTime, cn } from "@/lib/utils";
import type { VersionSummary } from "@/types/api";

function TitleEditor({ title, onSave }: { title: string; onSave: (t: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  if (!editing)
    return (
      <button
        type="button"
        onClick={() => {
          setValue(title);
          setEditing(true);
        }}
        className="group flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-zinc-100"
        aria-label="重命名项目"
        data-testid="project-title"
      >
        <span className="truncate font-semibold">{title}</span>
        <Pencil size={14} className="shrink-0 text-zinc-400 group-hover:text-zinc-600" />
      </button>
    );
  const commit = () => {
    const t = value.trim();
    setEditing(false);
    if (t && t !== title) onSave(t.slice(0, 40));
  };
  return (
    <input
      autoFocus
      value={value}
      maxLength={40}
      aria-label="项目标题"
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
      className="w-48 min-w-0 rounded-lg border border-[var(--brand)] px-2 py-1 text-sm font-semibold outline-none sm:w-64"
    />
  );
}

export function VersionMenu({ versions, currentId, viewingId, onSelect }: { versions: VersionSummary[]; currentId: string | null; viewingId: string | null; onSelect: (id: string) => void }) {
  const shown = versions.find((v) => v.id === (viewingId ?? currentId));
  if (!versions.length) return null;
  return (
    <Menu
      align="left"
      className="max-h-80 w-72 overflow-y-auto"
      trigger={(_, toggle) => (
        <Button size="sm" onClick={toggle} aria-label="版本列表" data-testid="version-menu">
          v{shown?.seq ?? "?"} <ChevronDown size={14} />
        </Button>
      )}
    >
      {(close) =>
        versions.map((v) => (
          <MenuItem
            key={v.id}
            onClick={() => {
              close();
              onSelect(v.id);
            }}
          >
            <span className="font-semibold">v{v.seq}</span>
            <span className="min-w-0 flex-1 truncate">{v.label}</span>
            <span className="text-xs text-[var(--muted)]">
              {SOURCE_LABELS[v.source]} · {clockTime(v.createdAt)}
            </span>
            {v.status === "error" && <span className="h-2 w-2 rounded-full bg-[var(--danger)]" title="有问题" aria-label="有问题" />}
            {v.id === currentId && <span className="rounded-full bg-[var(--brand-soft)] px-1.5 text-xs text-indigo-700">当前</span>}
          </MenuItem>
        ))
      }
    </Menu>
  );
}

export function TopBar(props: {
  title: string;
  versions: VersionSummary[];
  currentId: string | null;
  viewingId: string | null;
  downloadId: string | null;
  downloadSeq?: number;
  onRename: (t: string) => void;
  onSelectVersion: (id: string) => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <header className="flex h-14 shrink-0 items-center gap-1.5 border-b border-[var(--border)] bg-white px-2 sm:px-3">
      <Link href="/" aria-label="返回首页" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100">
        <ArrowLeft size={16} />
      </Link>
      <span className="hidden text-[var(--brand)] sm:inline">◆</span>
      <div className="min-w-0 flex-shrink">
        <TitleEditor title={props.title} onSave={props.onRename} />
      </div>
      <VersionMenu versions={props.versions} currentId={props.currentId} viewingId={props.viewingId} onSelect={props.onSelectVersion} />
      <div className="ml-auto flex items-center gap-1">
        <Button size="sm" onClick={props.onShare} disabled={!props.currentId} aria-label="分享">
          <Share2 size={14} /> <span className="hidden sm:inline">分享</span>
        </Button>
        <a
          href={props.downloadId ? `/api/versions/${props.downloadId}/download` : undefined}
          aria-label="下载"
          download={props.downloadId ? `${props.title}-v${props.downloadSeq ?? ""}.html` : undefined}
          className={cn("hidden h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 text-sm font-medium hover:bg-zinc-50 sm:inline-flex", !props.downloadId && "pointer-events-none opacity-40")}
        >
          <Download size={14} /> 下载
        </a>
        <Menu
          trigger={(_, toggle) => (
            <Button variant="ghost" size="icon" aria-label="更多" onClick={toggle}>
              <MoreHorizontal size={16} />
            </Button>
          )}
        >
          {(close) => (
            <MenuItem
              danger
              onClick={() => {
                close();
                setConfirm(true);
              }}
            >
              <Trash2 size={14} /> 删除项目
            </MenuItem>
          )}
        </Menu>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="删除项目" description={`删除后无法恢复，确定删除「${props.title}」吗？`} confirmText="删除" danger onConfirm={props.onDelete} />
    </header>
  );
}
