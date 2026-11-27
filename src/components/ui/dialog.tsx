"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

/** 简单弹窗：遮罩 + 居中面板，Esc / 点遮罩关闭。 */
export function Dialog({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" aria-label="关闭" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>
        <div className="space-y-3 text-sm text-zinc-600">{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog(props: { open: boolean; title: string; description: string; confirmText?: string; danger?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title={props.title}
      footer={
        <>
          <Button onClick={props.onClose}>取消</Button>
          <Button
            variant={props.danger ? "danger" : "primary"}
            onClick={() => {
              props.onConfirm();
              props.onClose();
            }}
          >
            {props.confirmText ?? "确定"}
          </Button>
        </>
      }
    >
      <p>{props.description}</p>
    </Dialog>
  );
}
