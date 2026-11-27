"use client";

import { Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AgentAvatar } from "@/components/ui/avatar";
import { AGENTS, type AgentRole } from "@/lib/agents";
import { cn } from "@/lib/utils";

/*
 * 首屏右侧的演示：按真实流程把一次生成过程放一遍（需求 → Mia → Leo → Iris → 预览）。
 * 全部是本地状态驱动的假数据，不请求接口。减弱动效时直接显示最终画面。
 */

const PROMPT = "做一个每日习惯打卡，显示连续天数";
const CONFIG: [string, string][] = [
  ["appName", '"每日习惯打卡"'],
  ["mode", '"habit"'],
  ["themeColor", '"emerald"'],
  ["items", '["早起", "喝水 8 杯", "读书"]'],
];
const T = { mia: 2000, miaDone: 3300, leo: 3800, leoDone: 5600, iris: 6100, irisDone: 7500, tick: 8300, end: 12500 };
const FINAL = 9000;

function Row({ role, running, children }: { role: AgentRole; running: boolean; children: React.ReactNode }) {
  const a = AGENTS[role];
  return (
    <div className="atoms-in relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
      {running && <span aria-hidden className="absolute inset-y-0 left-0 w-[2px]" style={{ background: a.color, boxShadow: `0 0 12px ${a.color}` }} />}
      <div className="flex items-center gap-2">
        <AgentAvatar role={role} className="h-6 w-6 ring-0" active={running} />
        <span className="text-[13px] font-semibold text-white">{a.short}</span>
        <span className="text-[11px]" style={{ color: a.color }}>
          {a.title}
        </span>
        <span className="ml-auto">{running ? <Loader2 size={13} className="animate-spin text-zinc-400" /> : <Check size={13} className="text-emerald-400" />}</span>
      </div>
      <div className="mt-1.5 pl-8 text-[12px] leading-relaxed text-zinc-300">{children}</div>
    </div>
  );
}

const HABITS = [
  { name: "早起", days: [1, 1, 1, 0, 1, 1, 1], streak: 3 },
  { name: "喝水 8 杯", days: [1, 1, 1, 1, 1, 1, 1], streak: 7 },
  { name: "读书 20 分钟", days: [0, 1, 1, 1, 1, 1, 0], streak: 5 },
];

function MiniApp({ t }: { t: number }) {
  const built = t >= T.leoDone;
  const ticked = t >= T.tick;
  if (!built)
    return (
      <div className="relative flex h-full flex-col gap-2.5 overflow-hidden p-4" aria-hidden>
        <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
        <div className="h-2.5 w-36 animate-pulse rounded bg-white/5" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-white/5" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
        <p className="mt-auto text-center font-mono text-[11px] text-zinc-500">{t >= T.leo ? "> 渲染模板…" : "> 等待配置"}</p>
        {t >= T.leo && <span className="scanline pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-transparent via-[var(--signal)]/15 to-transparent" />}
      </div>
    );
  const done = HABITS.filter((h, i) => h.days[6] || (i === 2 && ticked)).length;
  return (
    <div className="atoms-in flex h-full flex-col bg-gradient-to-b from-emerald-50 to-white p-4">
      <div className="text-[15px] font-bold text-emerald-900">每日习惯打卡</div>
      <div className="mt-0.5 text-[11px] text-emerald-800/70">今天完成 {done}/3</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-100">
        <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${(done / 3) * 100}%` }} />
      </div>
      <ul className="mt-3 space-y-2">
        {HABITS.map((h, i) => {
          const today = h.days[6] || (i === 2 && ticked);
          return (
            <li key={h.name} className="rounded-lg border border-emerald-100 bg-white px-2.5 py-2 shadow-sm">
              <div className="flex items-center gap-2">
                <span className={cn("flex h-4 w-4 items-center justify-center rounded border transition-colors duration-300", today ? "border-emerald-500 bg-emerald-500 text-white" : "border-emerald-300")}>{today && <Check size={11} strokeWidth={3} />}</span>
                <span className="flex-1 truncate text-[12px] font-medium text-zinc-800">{h.name}</span>
                <span className="text-[10px] tabular-nums text-emerald-700">连续 {i === 2 && ticked ? h.streak + 1 : h.streak} 天</span>
              </div>
              <div className="mt-1.5 flex gap-1 pl-6">
                {h.days.map((d, j) => {
                  const on = j === 6 ? today : d;
                  return <span key={j} className={cn("h-2 flex-1 rounded-sm transition-colors duration-300", on ? "bg-emerald-400" : "bg-emerald-50")} />;
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function HeroDemo() {
  const [t, setT] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setT(FINAL);
      return;
    }
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    if (ref.current) io.observe(ref.current);
    const timer = setInterval(() => {
      if (!visible || document.hidden) return;
      setT((x) => (x + 100 >= T.end ? 0 : x + 100));
    }, 100);
    return () => {
      clearInterval(timer);
      io.disconnect();
    };
  }, []);

  const chars = Math.max(0, Math.min(PROMPT.length, Math.floor((t - 200) / 55)));
  const configLines = Math.max(0, Math.min(CONFIG.length, Math.floor((t - T.leo - 200) / 320)));
  const stage = t >= T.irisDone ? "deployed" : t >= T.iris ? "testing" : t >= T.leo ? "building" : t >= T.mia ? "planning" : "idle";
  const elapsed = t >= T.mia ? ((Math.min(t, T.irisDone) - T.mia) / 1000).toFixed(1) : "0.0";

  return (
    <div ref={ref} className="relative" aria-label="生成过程演示" role="img">
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[32px] bg-[radial-gradient(closest-side,rgba(255,90,31,0.28),transparent)] blur-2xl" aria-hidden />
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0f1319]/90 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur">
        <div className="flex h-10 items-center gap-2 border-b border-white/10 px-3 text-[12px]">
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--pm)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--engineer)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--qa)]" />
          </span>
          <span className="ml-1 font-semibold text-zinc-200">每日习惯打卡</span>
          {t >= T.leoDone && <span className="atoms-in rounded bg-white px-1.5 py-px font-mono text-[10px] font-semibold text-zinc-900">v1</span>}
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-zinc-400">
            <span className={cn("h-1.5 w-1.5 rounded-full", stage === "deployed" ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : stage === "idle" ? "bg-zinc-600" : "animate-pulse bg-[var(--brand)] shadow-[0_0_8px_var(--brand)]")} />
            {stage}
          </span>
        </div>
        <div className="grid h-[420px] grid-cols-1 sm:grid-cols-[1.1fr_1fr]">
          <div className="space-y-2 overflow-hidden p-3">
            <div className="flex justify-end">
              <div className="max-w-[92%] rounded-xl rounded-br-sm bg-gradient-to-br from-[#ff6a2b] to-[#ff3d3d] px-2.5 py-1.5 text-[12px] text-white shadow-[0_6px_20px_-8px_rgba(255,90,31,0.7)]">
                {PROMPT.slice(0, chars)}
                {chars < PROMPT.length && <span className="atoms-caret ml-px inline-block h-3 w-px translate-y-0.5 bg-white" />}
              </div>
            </div>
            {t >= T.mia && (
              <Row role="pm" running={t < T.miaDone}>
                {t < T.miaDone ? (
                  "在看需求…"
                ) : (
                  <>
                    用「待办清单」的打卡模式。
                    <span className="mt-1 flex flex-wrap gap-1">
                      {["添加习惯", "每日打卡", "连续天数", "近 7 天"].map((f) => (
                        <span key={f} className="rounded border border-[var(--pm)]/30 bg-[var(--pm)]/10 px-1.5 text-[10.5px] text-[#ffc861]">
                          {f}
                        </span>
                      ))}
                    </span>
                  </>
                )}
              </Row>
            )}
            {t >= T.leo && (
              <Row role="engineer" running={t < T.leoDone}>
                <div className="rounded-md border border-white/5 bg-black/40 px-2 py-1.5 font-mono text-[10.5px] leading-[1.6]">
                  {CONFIG.slice(0, Math.max(1, configLines)).map(([k, v]) => (
                    <div key={k} className="truncate">
                      <span className="text-[#7cc4ff]">&quot;{k}&quot;</span>
                      <span className="text-zinc-500">: </span>
                      <span className="text-[#ffb86b]">{v}</span>
                    </div>
                  ))}
                </div>
              </Row>
            )}
            {t >= T.iris && (
              <Row role="qa" running={t < T.irisDone}>
                {t < T.irisDone ? "点按钮、看报错…" : <span className="text-emerald-400">6 个按钮 0 报错，检查通过</span>}
              </Row>
            )}
          </div>
          <div className="hidden border-l border-white/10 bg-black/20 sm:block">
            <MiniApp t={t} />
          </div>
        </div>
        <div className="flex h-8 items-center gap-3 border-t border-white/10 px-3 font-mono text-[10px] text-zinc-500">
          <span>deepseek-flash</span>
          <span className="text-zinc-700">|</span>
          <span>sandbox: iframe</span>
          <span className="ml-auto tabular-nums text-zinc-400">{elapsed}s</span>
        </div>
      </div>
    </div>
  );
}
