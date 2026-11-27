"use client";

import { cn } from "@/lib/utils";

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150 disabled:opacity-50", checked ? "bg-[var(--brand)]" : "bg-zinc-300")}
    >
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-150", checked ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}
