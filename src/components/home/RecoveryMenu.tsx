"use client";

import { ChevronDown, KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import { api, ApiError } from "@/lib/api-client";
import { copyText } from "@/lib/clipboard";

/** 恢复码菜单（E6，docs/02 §4.3）。 */
export function RecoveryMenu() {
  const [code, setCode] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (code) return;
    try {
      setCode((await api.me()).recoveryCode);
    } catch {
      setCode("");
    }
  };
  const switchTo = async () => {
    setError(null);
    try {
      await api.restoreVisitor(other.trim());
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "恢复码无效");
    }
  };

  return (
    <Menu
      className="w-80 p-4"
      trigger={(open, toggle) => (
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          onClick={() => {
            void load();
            toggle();
          }}
        >
          <KeyRound size={16} /> 恢复码 <ChevronDown size={14} />
        </Button>
      )}
    >
      {() => (
        <div className="space-y-3 text-sm">
          <p className="text-[var(--muted)]">恢复码可以在其他设备上找回你的项目，请勿泄露给他人。</p>
          <div className="flex gap-2">
            <input readOnly value={code ?? "加载中…"} aria-label="当前恢复码" className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-zinc-50 px-2 py-1.5 font-mono text-xs" onFocus={(e) => e.target.select()} />
            <Button size="sm" disabled={!code} onClick={() => code && void copyText(code).then((ok) => (ok ? toast.success("已复制") : toast("请手动复制")))}>
              复制
            </Button>
          </div>
          <div className="border-t border-[var(--border)] pt-3">
            <div className="flex gap-2">
              <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="使用其他恢复码" aria-label="其他恢复码" className="min-w-0 flex-1 rounded-lg border border-[var(--border)] px-2 py-1.5 font-mono text-xs outline-none focus:border-[var(--brand)]" />
              <Button size="sm" variant="primary" disabled={!other.trim()} onClick={() => void switchTo()}>
                切换
              </Button>
            </div>
            {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}
          </div>
        </div>
      )}
    </Menu>
  );
}
