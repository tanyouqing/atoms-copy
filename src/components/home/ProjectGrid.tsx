"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Menu, MenuItem } from "@/components/ui/menu";
import { api, ApiError } from "@/lib/api-client";
import { TEMPLATES } from "@/lib/templates/registry";
import { useMounted } from "@/hooks/useMounted";
import { relativeTime } from "@/lib/utils";
import type { ProjectSummary } from "@/types/api";

const templateName = (id: string | null) => (id ? (TEMPLATES.find((t) => t.id === id)?.name ?? id) : "自由生成");

export function ProjectGrid({ projects }: { projects: ProjectSummary[] }) {
  const mounted = useMounted();
  const router = useRouter();
  const [, setTick] = useState(0);
  const [renaming, setRenaming] = useState<ProjectSummary | null>(null);
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null);
  const [title, setTitle] = useState("");

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const rename = async () => {
    if (!renaming) return;
    try {
      await api.updateProject(renaming.id, { title: title.trim() });
      toast.success("已重命名");
      setRenaming(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "重命名失败");
    }
  };
  const remove = async (p: ProjectSummary) => {
    try {
      await api.deleteProject(p.id);
      toast.success("已删除");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "删除失败");
    }
  };

  return (
    <section className="mt-14">
      <h2 className="mb-3 text-lg font-semibold">我的项目</h2>
      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 py-10 text-center text-sm text-[var(--muted)]">还没有项目，从上面的示例开始吧</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <div key={p.id} className="group relative rounded-xl border border-[var(--border)] bg-white transition-colors hover:border-zinc-400" data-testid="project-card">
              <Link href={`/p/${p.id}`} className="block p-4">
                <div className="truncate pr-8 text-sm font-semibold">{p.title}</div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted)]">
                  {p.currentSeq ? <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 font-medium text-indigo-700">v{p.currentSeq}</span> : <span className="rounded-full bg-zinc-100 px-2 py-0.5">未生成</span>}
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5">{templateName(p.templateId)}</span>
                  <span className="ml-auto">{mounted ? relativeTime(p.updatedAt) : ""}</span>
                </div>
              </Link>
              <div className="absolute right-2 top-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                <Menu
                  trigger={(_, toggle) => (
                    <Button variant="ghost" size="icon" aria-label="更多操作" onClick={toggle}>
                      <MoreHorizontal size={16} />
                    </Button>
                  )}
                >
                  {(close) => (
                    <>
                      <MenuItem
                        onClick={() => {
                          close();
                          setTitle(p.title);
                          setRenaming(p);
                        }}
                      >
                        <Pencil size={14} /> 重命名
                      </MenuItem>
                      <MenuItem
                        danger
                        onClick={() => {
                          close();
                          setDeleting(p);
                        }}
                      >
                        <Trash2 size={14} /> 删除
                      </MenuItem>
                    </>
                  )}
                </Menu>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog
        open={!!renaming}
        onClose={() => setRenaming(null)}
        title="重命名"
        footer={
          <>
            <Button onClick={() => setRenaming(null)}>取消</Button>
            <Button variant="primary" disabled={!title.trim() || title.trim().length > 40} onClick={() => void rename()}>
              保存
            </Button>
          </>
        }
      >
        <input
          autoFocus
          value={title}
          maxLength={40}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void rename()}
          className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[var(--brand)]"
        />
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="删除项目"
        description={`删除后无法恢复，确定删除「${deleting?.title ?? ""}」吗？`}
        confirmText="删除"
        danger
        onConfirm={() => deleting && void remove(deleting)}
      />
    </section>
  );
}
