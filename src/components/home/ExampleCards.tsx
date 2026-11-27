"use client";

import { ChartColumn, Gamepad2, ListChecks, SquareKanban, Wallet, type LucideIcon } from "lucide-react";
import { EXAMPLES } from "@/lib/examples";
import type { TemplateId } from "@/lib/templates/registry";
import { useCreateProject } from "./useCreateProject";

export const TEMPLATE_ICONS: Partial<Record<TemplateId, LucideIcon>> = {
  todo: ListChecks,
  ledger: Wallet,
  kanban: SquareKanban,
  game: Gamepad2,
  dashboard: ChartColumn,
};

/** 输入框下面的一排示例：点一下直接开工。 */
export function ExampleCards() {
  const { create, pending } = useCreateProject();
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="mr-1 font-mono text-xs text-zinc-500">{"// 或者直接试试"}</span>
      {EXAMPLES.map((ex) => {
        const Icon = TEMPLATE_ICONS[ex.template] ?? ListChecks;
        return (
          <button
            key={ex.title}
            type="button"
            disabled={pending}
            title={ex.prompt}
            onClick={() => void create(ex.prompt)}
            className="group inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-2 pr-3 text-sm text-zinc-300 backdrop-blur transition-[border-color,transform,color,background-color] duration-150 hover:-translate-y-px hover:border-[var(--brand)]/60 hover:bg-[var(--brand)]/10 hover:text-white disabled:opacity-60"
          >
            <Icon size={15} className="text-zinc-500 transition-colors group-hover:text-[var(--brand)]" />
            {ex.title}
          </button>
        );
      })}
    </div>
  );
}
