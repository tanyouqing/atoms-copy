"use client";

import { Check, PenLine } from "lucide-react";
import { useEffect, useState } from "react";
import { STYLE_META, THEME_STYLES, isThemeStyle, type ThemeStyle } from "@/lib/templates/themes";
import { VENDOR_STYLES } from "@/lib/vendor";
import { cn } from "@/lib/utils";

const PIXEL_FONT = '"Fusion Pixel 12px Proportional Simplified Chinese", ui-monospace, monospace';
const STORE_KEY = "atoms:style";

/** 记住上次选的风格（只是个人偏好，读写失败时用默认值）。 */
export function useRememberedStyle(): [ThemeStyle, (s: ThemeStyle) => void] {
  const [style, setStyle] = useState<ThemeStyle>("paper");
  useEffect(() => {
    try {
      const v = localStorage.getItem(STORE_KEY);
      if (isThemeStyle(v)) setStyle(v);
    } catch {
      // 隐私模式等读不到存储时用默认风格
    }
  }, []);
  const set = (s: ThemeStyle) => {
    setStyle(s);
    try {
      localStorage.setItem(STORE_KEY, s);
    } catch {
      // 记不住也不影响本次选择
    }
  };
  return [style, set];
}

/** 风格小预览：一张迷你应用卡片，形状和颜色与模板主题一致。 */
export function StyleThumb({ style, className }: { style: ThemeStyle; className?: string }) {
  const { bg, surface, ink, accent } = STYLE_META[style].swatch;
  const pixel = style === "pixel";
  const bright = style === "bright";
  const card = pixel ? { borderRadius: 0, border: `2px solid ${ink}`, boxShadow: `3px 3px 0 ${ink}` } : bright ? { borderRadius: 10, boxShadow: "0 6px 14px -6px rgb(15 23 42/.25)" } : { borderRadius: 7, border: "1px solid #e4ded2", boxShadow: "0 6px 14px -10px rgb(31 28 23/.5)" };
  const btn = pixel ? { borderRadius: 0, background: accent, boxShadow: `2px 2px 0 ${ink}`, border: `1.5px solid ${ink}` } : bright ? { borderRadius: 999, backgroundImage: `linear-gradient(135deg, #60a5fa, ${accent})`, boxShadow: `0 4px 8px -4px ${accent}` } : { borderRadius: 4, background: accent };
  const font = pixel ? PIXEL_FONT : style === "paper" ? 'Georgia, "Songti SC", serif' : "ui-sans-serif, system-ui, sans-serif";
  const bgImage = pixel
    ? "linear-gradient(rgb(24 28 40/.07) 1px,transparent 1px),linear-gradient(90deg,rgb(24 28 40/.07) 1px,transparent 1px)"
    : bright
      ? "radial-gradient(60px 40px at 0% 0%, #bfdbfe, transparent 70%), radial-gradient(60px 40px at 100% 0%, #e0e7ff, transparent 70%)"
      : undefined;
  return (
    <div aria-hidden className={cn("relative h-16 w-full overflow-hidden", className)} style={{ background: bg, backgroundImage: bgImage, backgroundSize: pixel ? "8px 8px" : undefined }}>
      <div className="absolute inset-x-2.5 top-2.5 bottom-0 p-2" style={{ background: surface, ...card }}>
        <div className="flex items-center justify-between">
          <span style={{ fontFamily: font, color: ink, fontSize: pixel ? 12 : 13, fontWeight: bright ? 700 : 600, lineHeight: 1 }}>Aa 字</span>
          <span className="h-3 w-7" style={btn} />
        </div>
        <div className="mt-1.5 h-1 w-4/5" style={{ background: ink, opacity: 0.18, borderRadius: pixel ? 0 : 99 }} />
        <div className="mt-1 h-1 w-3/5" style={{ background: ink, opacity: 0.12, borderRadius: pixel ? 0 : 99 }} />
      </div>
    </div>
  );
}

/** 像素字体样式表：预览卡片里要用像素字体时加载（按 unicode-range 只下载用到的字）。 */
export function PixelFontLink() {
  return <link rel="stylesheet" href={VENDOR_STYLES[0].local} precedence="low" />;
}

/**
 * 首页输入框下方的风格卡片：默认选中上次用过的（首次为暖纸墨色），不选也能直接生成。
 * 最后一张"其他风格"把"整体风格："插进需求里，用户写自己的风格，由产品经理生成一套颜色。
 */
export function StylePicker({ value, onChange, onCustom, disabled }: { value: ThemeStyle; onChange: (s: ThemeStyle) => void; onCustom: () => void; disabled?: boolean }) {
  return (
    <div className="mt-3" role="radiogroup" aria-label="选择应用风格">
      <PixelFontLink />
      <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
        <span className="text-xs font-medium text-zinc-300">应用风格</span>
        <span className="truncate text-[11px] text-zinc-500">生成后也可以随时一键切换</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {THEME_STYLES.map((s) => {
          const on = value === s;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              data-testid={`style-${s}`}
              onClick={() => onChange(s)}
              className={cn(
                "group relative overflow-hidden rounded-xl border bg-white/[0.03] text-left transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] disabled:opacity-60",
                on ? "border-[var(--brand)] shadow-[0_0_0_1px_var(--brand),0_10px_30px_-12px_rgba(255,90,31,0.6)]" : "border-white/10 hover:border-white/25",
              )}
            >
              <StyleThumb style={s} className="transition-transform duration-200 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
              <div className="flex items-center justify-between gap-1 px-2.5 py-2">
                <span className="truncate text-[13px] font-medium text-zinc-100">{STYLE_META[s].name}</span>
                {on && <Check size={14} className="shrink-0 text-[var(--brand)]" />}
              </div>
              <span className="sr-only">{STYLE_META[s].desc}</span>
            </button>
          );
        })}
        <button
          type="button"
          disabled={disabled}
          onClick={onCustom}
          data-testid="style-custom"
          className="flex min-h-[100px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/20 px-2 text-center text-zinc-400 transition hover:border-white/40 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] disabled:opacity-60"
        >
          <PenLine size={16} />
          <span className="text-[13px] font-medium">其他风格</span>
          <span className="text-[11px] leading-4 text-zinc-500">如「赛博朋克」「森系」</span>
        </button>
      </div>
    </div>
  );
}
