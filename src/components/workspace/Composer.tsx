"use client";

import { ArrowUp, RotateCcw, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PROMPT_MAX } from "@/lib/examples";

export function Composer(props: { busy: boolean; notice: string | null; onSend: (text: string) => void; onStop: () => void; showRegenerate: boolean; onRegenerate: () => void }) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const tooLong = value.length > PROMPT_MAX;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 6 * 22 + 16)}px`;
  }, [value]);

  const send = () => {
    const t = value.trim();
    if (!t || tooLong || props.busy) return;
    props.onSend(t);
    setValue("");
  };

  return (
    <div className="border-t border-[var(--border)] bg-white p-3">
      {props.notice && (
        <div className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800" role="status" data-testid="composer-notice">
          {props.notice}
        </div>
      )}
      {tooLong && <div className="mb-2 text-xs text-[var(--danger)]">需求描述请控制在 2000 字以内</div>}
      {props.showRegenerate && !props.busy && (
        <Button size="sm" className="mb-2" onClick={props.onRegenerate}>
          <RotateCcw size={14} /> 重新生成
        </Button>
      )}
      <div className="flex items-end gap-2 rounded-xl border border-[var(--border)] px-3 py-2 focus-within:border-[var(--brand)]">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          disabled={props.busy}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          aria-label="继续描述修改"
          placeholder={props.busy ? "团队正在工作…" : "继续描述修改，例如：把主色改成绿色"}
          className="max-h-[148px] min-h-[22px] flex-1 resize-none bg-transparent text-sm leading-[22px] outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed"
        />
        {props.busy ? (
          <Button variant="danger" size="sm" onClick={props.onStop} aria-label="停止">
            <Square size={12} className="fill-white" /> 停止
          </Button>
        ) : (
          <Button variant="primary" size="icon" onClick={send} disabled={!value.trim() || tooLong} aria-label="发送">
            <ArrowUp size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}
