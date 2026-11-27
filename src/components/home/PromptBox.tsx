"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PROMPT_MAX } from "@/lib/examples";
import { useCreateProject } from "./useCreateProject";

export function PromptBox() {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const { create, pending } = useCreateProject();
  const tooLong = value.length > PROMPT_MAX;
  const canSubmit = value.trim().length > 0 && !tooLong && !pending;

  useEffect(() => ref.current?.focus(), []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 84), 200)}px`;
  }, [value]);

  const submit = () => canSubmit && void create(value.trim());

  return (
    <div className="mt-8">
      <div className="rounded-xl border border-[var(--border)] bg-white p-3 transition-colors focus-within:border-[var(--brand)]">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          rows={3}
          aria-label="描述你想要的应用"
          placeholder="描述你想要的应用，例如：一个记录每天喝水量的打卡应用"
          className="w-full resize-none bg-transparent text-[15px] leading-6 outline-none placeholder:text-zinc-400"
        />
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className={tooLong ? "text-xs text-[var(--danger)]" : "text-xs text-zinc-400"}>{tooLong ? "需求描述请控制在 2000 字以内" : "Enter 提交，Shift + Enter 换行"}</span>
          <Button variant="primary" disabled={!canSubmit} onClick={submit}>
            {pending ? <Loader2 size={16} className="animate-spin" /> : null}
            开始生成
            {!pending && <ArrowRight size={16} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
