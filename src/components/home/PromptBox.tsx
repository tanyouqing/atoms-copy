"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AgentAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PROMPT_MAX } from "@/lib/examples";
import { cn } from "@/lib/utils";
import { FILL_EVENT } from "./prompt-bus";
import { useCreateProject } from "./useCreateProject";

const PLACEHOLDERS = ["一个记录每天喝水量的打卡应用", "给小区跳蚤市场做一个报名表", "孩子的零花钱账本，能看每周花了多少", "团队周会用的议题看板"];

export function PromptBox() {
  const [value, setValue] = useState("");
  const [hint, setHint] = useState(0);
  const [flash, setFlash] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
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

  // 输入框为空时轮换示例占位文字；减弱动效时不轮换
  useEffect(() => {
    if (value || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setHint((h) => (h + 1) % PLACEHOLDERS.length), 3200);
    return () => clearInterval(t);
  }, [value]);

  // 模板墙点击后把需求填进来
  useEffect(() => {
    const on = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      setValue(text);
      boxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      ref.current?.focus({ preventScroll: true });
      setFlash(true);
      setTimeout(() => setFlash(false), 700);
    };
    window.addEventListener(FILL_EVENT, on);
    return () => window.removeEventListener(FILL_EVENT, on);
  }, []);

  const submit = () => canSubmit && void create(value.trim());

  return (
    <div className="mt-8" ref={boxRef}>
      <div
        className={cn(
          "rounded-2xl border bg-[var(--panel)] p-3 shadow-[0_1px_0_rgba(31,28,23,0.04),0_12px_32px_-18px_rgba(31,28,23,0.35)] transition-[border-color,box-shadow] duration-200 focus-within:border-zinc-800",
          flash ? "border-[var(--brand)] ring-4 ring-[var(--brand-soft)]" : "border-[var(--border)]",
        )}
      >
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
          placeholder={`比如：${PLACEHOLDERS[hint]}`}
          className="w-full resize-none bg-transparent px-1 text-[15px] leading-6 outline-none placeholder:text-zinc-400"
        />
        <div className="flex items-center justify-between gap-2 border-t border-dashed border-[var(--border)] pt-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex -space-x-1.5">
              {(["pm", "engineer", "qa"] as const).map((r) => (
                <AgentAvatar key={r} role={r} className="h-6 w-6 ring-2 ring-[var(--panel)]" active={pending} />
              ))}
            </span>
            <span className={cn("truncate text-xs", tooLong ? "text-[var(--danger)]" : "text-zinc-500")}>
              {tooLong ? (
                "需求描述请控制在 2000 字以内"
              ) : pending ? (
                "正在叫人…"
              ) : (
                <>
                  <span className="hidden sm:inline">三个人都在，</span>Enter 提交，Shift + Enter 换行
                </>
              )}
            </span>
          </div>
          <Button variant="primary" disabled={!canSubmit} onClick={submit} className="h-9 rounded-xl px-4">
            {pending ? <Loader2 size={16} className="animate-spin" /> : null}
            开始生成
            {!pending && <ArrowRight size={16} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
