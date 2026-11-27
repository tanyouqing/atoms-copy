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
          "flow-border rounded-2xl bg-[#10141b]/90 p-3 shadow-[0_20px_60px_-20px_rgba(255,90,31,0.35)] backdrop-blur transition-shadow duration-200 focus-within:shadow-[0_20px_70px_-15px_rgba(255,90,31,0.55)]",
          flash && "ring-4 ring-[var(--brand)]/40",
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
          className="w-full resize-none bg-transparent px-1 text-[15px] leading-6 text-zinc-100 caret-[var(--brand)] outline-none placeholder:text-zinc-500"
        />
        <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex -space-x-1.5">
              {(["pm", "engineer", "qa"] as const).map((r) => (
                <AgentAvatar key={r} role={r} className="h-6 w-6 ring-2 ring-[#10141b]" active={pending} />
              ))}
            </span>
            <span className={cn("truncate text-xs", tooLong ? "text-[#ff8a7a]" : "text-zinc-400")}>
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
          <Button variant="primary" disabled={!canSubmit} onClick={submit} className="h-9 rounded-xl bg-gradient-to-r from-[#ff6a2b] to-[#ff3d3d] px-4 shadow-[0_8px_24px_-8px_rgba(255,90,31,0.8)] hover:from-[#ff7a40] hover:to-[#ff5050] disabled:from-zinc-700 disabled:to-zinc-700 disabled:text-zinc-400 disabled:shadow-none">
            {pending ? <Loader2 size={16} className="animate-spin" /> : null}
            开始生成
            {!pending && <ArrowRight size={16} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
