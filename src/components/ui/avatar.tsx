import { AGENTS, type AgentRole } from "@/lib/agents";
import { cn } from "@/lib/utils";

export function AgentAvatar({ role, className }: { role: AgentRole; className?: string }) {
  const a = AGENTS[role];
  return (
    <span aria-hidden className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white", className)} style={{ background: a.color }}>
      {a.initial}
    </span>
  );
}
