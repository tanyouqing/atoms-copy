"use client";

import { ArrowUpRight, ChartColumn, ClipboardList, Gamepad2, ListChecks, PanelsTopLeft, SquareKanban, Table2, Wallet, type LucideIcon } from "lucide-react";
import { TEMPLATE_SHOWCASE } from "@/lib/examples";
import { TEMPLATES, type TemplateId } from "@/lib/templates/registry";
import { fillPrompt } from "./prompt-bus";
import { Reveal } from "./Reveal";

const ICONS: Record<TemplateId, LucideIcon> = {
  todo: ListChecks,
  ledger: Wallet,
  form: ClipboardList,
  kanban: SquareKanban,
  landing: PanelsTopLeft,
  dashboard: ChartColumn,
  game: Gamepad2,
  crud: Table2,
};

/** 模板墙：点一张卡，把对应的示例需求填进输入框。 */
export function TemplateWall() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {TEMPLATES.map((t, i) => {
        const Icon = ICONS[t.id];
        const s = TEMPLATE_SHOWCASE[t.id];
        return (
          <Reveal key={t.id} delay={(i % 4) * 70}>
            <button
              type="button"
              onClick={() => fillPrompt(s.prompt)}
              className="group flex h-full w-full flex-col rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left text-white backdrop-blur transition-[border-color,transform,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)]/50 hover:bg-white/[0.06] hover:shadow-[0_0_0_1px_rgba(255,90,31,0.2),0_20px_40px_-20px_rgba(255,90,31,0.45)]"
            >
              <span className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-300 transition-colors duration-200 group-hover:border-transparent group-hover:bg-[var(--brand)] group-hover:text-white">
                  <Icon size={18} />
                </span>
                <span className="font-mono text-[12px] text-zinc-600">{String(i + 1).padStart(2, "0")}</span>
              </span>
              <span className="mt-4 text-[15px] font-semibold">{t.name}</span>
              <span className="mt-1 text-[13px] text-zinc-400">{s.blurb}</span>
              <span className="mt-4 flex items-start gap-1 border-t border-white/10 pt-3 font-mono text-[11.5px] leading-relaxed text-zinc-500 group-hover:text-zinc-200">
                <span className="line-clamp-2 flex-1">“{s.prompt}”</span>
                <ArrowUpRight size={14} className="mt-0.5 shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </span>
            </button>
          </Reveal>
        );
      })}
    </div>
  );
}
