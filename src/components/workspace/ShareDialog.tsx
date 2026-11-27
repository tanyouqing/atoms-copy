"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/api-client";
import { copyText } from "@/lib/clipboard";

/** 分享弹窗（E3，docs/02 §5.9）。 */
export function ShareDialog({ open, onClose, projectId, isPublic, onChange }: { open: boolean; onClose: () => void; projectId: string; isPublic: boolean; onChange: (v: boolean) => void }) {
  const [saving, setSaving] = useState(false);
  const [origin, setOrigin] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const link = `${origin}/share/${projectId}`;

  const toggle = async (v: boolean) => {
    setSaving(true);
    try {
      await api.updateProject(projectId, { isPublic: v });
      onChange(v);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "设置失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    if (await copyText(link)) toast.success("已复制链接");
    else {
      inputRef.current?.select();
      toast("请手动复制");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="分享应用">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium text-zinc-900">公开访问</div>
          <p className="mt-0.5 text-xs">开启后，任何拿到链接的人都可以使用这个应用（只读，不能看到对话）。</p>
        </div>
        <Switch checked={isPublic} disabled={saving} onChange={(v) => void toggle(v)} label="公开访问" />
      </div>
      {isPublic && (
        <div className="flex gap-2 pt-1">
          <input ref={inputRef} readOnly value={link} aria-label="分享链接" data-testid="share-link" onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-zinc-50 px-2 py-1.5 text-xs text-zinc-800" />
          <Button size="sm" onClick={() => void copy()}>
            复制链接
          </Button>
          <Button size="sm" variant="primary" onClick={() => window.open(link, "_blank", "noopener")}>
            打开
          </Button>
        </div>
      )}
    </Dialog>
  );
}
