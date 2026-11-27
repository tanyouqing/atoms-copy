"use client";

import { ArrowUp, Palette, RotateCcw, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PROMPT_MAX } from "@/lib/examples";
import { STYLE_META, THEME_STYLES, type ThemeStyle } from "@/lib/templates/themes";
import { cn } from "@/lib/utils";

export interface StyleBar {
  /** 当前内置风格；自定义风格时为 null */
  current: ThemeStyle | null;
  customName: string | null;
  onPick: (s: ThemeStyle) => void;
}

/** 输入框上方的一排风格按钮：点一下整体换风格，内容和数据不变。 */
function StyleSwitch({ bar, busy }: { bar: StyleBar; busy: boolean }) {
  return (
    <div className="mb-2 flex items-center gap-1.5 overflow-x-auto text-xs" role="group" aria-label="切换应用风格" data-testid="style-switch">
      <span className="inline-flex shrink-0 items-center gap-1 text-zinc-500">
        <Palette size={13} /> 风格
      </span>
      {THEME_STYLES.map((s) => {
        const on = bar.current === s;
        return (
          <button
            key={s}
            type="button"
            disabled={busy || on}
            aria-pressed={on}
            title={STYLE_META[s].desc}
            onClick={() => bar.onPick(s)}
            data-testid={`switch-${s}`}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors",
              on ? "border-zinc-900 bg-zinc-900 text-white" : "border-[var(--border)] bg-white text-zinc-700 hover:border-zinc-400 disabled:cursor-not-allowed disabled:text-zinc-400",
            )}
          >
            <span className="h-2.5 w-2.5 shrink-0 border border-black/10" style={{ background: STYLE_META[s].swatch.accent, borderRadius: s === "pixel" ? 0 : 99 }} />
            {STYLE_META[s].short}
          </button>
        );
      })}
      {bar.customName && <span className="shrink-0 rounded-full border border-zinc-900 bg-zinc-900 px-2.5 py-1 text-white">{bar.customName}</span>}
    </div>
  );
}

export function Composer(props: { busy: boolean; notice: string | null; onSend: (text: string) => void; onStop: () => void; showRegenerate: boolean; onRegenerate: () => void; styleBar?: StyleBar | null }) {
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
    <div className="border-t border-[var(--border)] bg-[var(--panel)] p-3">
      {props.notice && (
        <div className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800" role="status" data-testid="composer-notice">
          {props.notice}
        </div>
      )}
      {tooLong && <div className="mb-2 text-xs text-[var(--danger)]">需求描述请控制在 2000 字以内</div>}
      {props.styleBar && <StyleSwitch bar={props.styleBar} busy={props.busy} />}
      {props.showRegenerate && !props.busy && (
        <Button size="sm" className="mb-2" onClick={props.onRegenerate}>
          <RotateCcw size={14} /> 重新生成
        </Button>
      )}
      <div className="flex items-end gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 transition-colors focus-within:border-zinc-800">
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
