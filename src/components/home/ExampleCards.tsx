"use client";

import { EXAMPLES } from "@/lib/examples";
import { useCreateProject } from "./useCreateProject";

export function ExampleCards() {
  const { create, pending } = useCreateProject();
  return (
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {EXAMPLES.map((ex) => (
        <button
          key={ex.title}
          type="button"
          disabled={pending}
          onClick={() => void create(ex.prompt)}
          className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-white p-4 text-left transition-colors duration-150 hover:border-[var(--brand)] disabled:opacity-60"
        >
          <span className="text-xl leading-none">{ex.emoji}</span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{ex.title}</span>
            <span className="mt-1 block truncate text-xs text-[var(--muted)]">{ex.prompt}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
