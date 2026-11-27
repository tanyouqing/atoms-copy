import { Download, History, KeyRound, Link2, Wrench } from "lucide-react";
import { AgentAvatar } from "@/components/ui/avatar";
import { LogoMark } from "@/components/ui/logo";
import { AGENTS, type AgentRole } from "@/lib/agents";
import { Reveal } from "./Reveal";
import { TemplateWall } from "./TemplateWall";

function SectionHead({ no, title, desc, id, dark }: { no: string; title: string; desc: string; id?: string; dark?: boolean }) {
  return (
    <div id={id} className="mb-10 flex scroll-mt-20 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[var(--brand)]">
          <span className="h-px w-6 bg-gradient-to-r from-[var(--brand)] to-transparent" />
          {no}
        </div>
        <h2 className={dark ? "mt-2 text-2xl font-bold tracking-tight text-white sm:text-[32px]" : "mt-2 text-2xl font-bold tracking-tight sm:text-[32px]"}>{title}</h2>
      </div>
      <p className={dark ? "max-w-md text-sm leading-relaxed text-zinc-400 sm:text-right" : "max-w-md text-sm leading-relaxed text-zinc-500 sm:text-right"}>{desc}</p>
    </div>
  );
}

const TEAM: { role: AgentRole; does: string; says: React.ReactNode }[] = [
  {
    role: "pm",
    does: "先把你的话翻译成功能清单，判断用哪个模板。现有模板做不了的需求会直接说明，不会假装做了。",
    says: "「按天打卡」用待办清单的打卡模式就够了；月历视图目前做不了，先不加。",
  },
  {
    role: "engineer",
    does: "按清单填模板配置；模板装不下的，就从零写一个单文件页面。之后你提修改，只动相关的那几行。",
    says: (
      <span className="font-mono text-[12px]">
        <span className="text-[#d6402b]">{'- "themeColor": "indigo"'}</span>
        <br />
        <span className="text-[#15803d]">{'+ "themeColor": "emerald"'}</span>
      </span>
    ),
  },
  {
    role: "qa",
    does: "把应用放进沙箱里跑一遍，抓到报错就带着行号退回给 Leo。最多修四轮，修不好就退回上一个能用的版本。",
    says: "第 42 行读到了 undefined，Leo 麻烦看一下。",
  },
];

export function TeamSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHead id="team" no="01 · 谁在干活" title="一支三个人的小队" desc="每次生成都按同一套流程走：先想清楚，再写，最后检查。每一步在工作台里都看得见。" />
      <div className="relative grid gap-4 md:grid-cols-3">
        <div className="pointer-events-none absolute left-[16%] right-[16%] top-[52px] hidden h-0.5 bg-gradient-to-r from-[var(--pm)] via-[var(--engineer)] to-[var(--qa)] opacity-60 md:block" aria-hidden />
        {TEAM.map(({ role, does, says }, i) => {
          const a = AGENTS[role];
          return (
            <Reveal key={role} delay={i * 90}>
              <article className="group relative h-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 transition-[transform,box-shadow] duration-300 hover:-translate-y-1" style={{ "--c": a.color } as React.CSSProperties}>
                <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: a.color }} />
                <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-25 blur-3xl transition-opacity duration-300 group-hover:opacity-50" style={{ background: a.color }} />
                <div className="flex items-center gap-3">
                  <AgentAvatar role={role} className="h-16 w-16 ring-4 ring-white" />
                  <div>
                    <div className="text-xl font-bold">{a.short}</div>
                    <div className="font-mono text-xs font-medium uppercase tracking-wide" style={{ color: a.color }}>
                      {a.title}
                    </div>
                  </div>
                  <span className="ml-auto self-start font-mono text-3xl font-bold text-zinc-100">0{i + 1}</span>
                </div>
                <p className="mt-4 text-[13.5px] leading-relaxed text-zinc-600">{does}</p>
                <div className="mt-4 rounded-xl rounded-tl-sm px-3 py-2.5 text-[13px] leading-relaxed text-zinc-800" style={{ background: a.tint }}>
                  {says}
                </div>
              </article>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

export function TemplateSection() {
  return (
    <section className="relative overflow-hidden bg-[var(--night)]">
      <div className="tech-grid absolute inset-0" aria-hidden />
      <div className="glow-orb -right-40 top-20 h-96 w-96 bg-[#3b82f6]/20" aria-hidden />
      <div className="glow-orb -left-40 bottom-0 h-96 w-96 bg-[#ff5a1f]/20 [animation-delay:-8s]" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHead dark id="templates" no="02 · 从哪儿起步" title="八个打磨过的模板" desc="常见需求先套模板，界面和交互都是调好的；模板覆盖不到的，再让 Leo 从零写。点一张卡，把例子填进输入框。" />
        <TemplateWall />
      </div>
    </section>
  );
}

function FixLog() {
  return (
    <div className="mt-4 space-y-1 rounded-lg border border-white/5 bg-[var(--night)] p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
      <div>
        <span className="text-[#ff7a5c]">✕</span> L42 TypeError: items is undefined
      </div>
      <div>
        <span className="text-[#7cb3ff]">→</span> Leo 修复中（第 1/4 轮）
      </div>
      <div>
        <span className="text-[#5ee08f]">✓</span> 重新运行，0 个报错
      </div>
    </div>
  );
}

function VersionRail() {
  const vs = [
    { v: 1, l: "初版" },
    { v: 2, l: "改成绿色" },
    { v: 3, l: "加导出" },
  ];
  return (
    <div className="mt-4 flex items-center gap-1.5">
      {vs.map((x, i) => (
        <div key={x.v} className="flex items-center gap-1.5">
          <span className={i === 2 ? "rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-white" : "rounded-md border border-[var(--border)] bg-white px-2 py-1 text-[11px] text-zinc-600"}>
            v{x.v} · {x.l}
          </span>
          {i < vs.length - 1 && <span className="h-px w-3 bg-zinc-300" />}
        </div>
      ))}
    </div>
  );
}

const DETAILS = [
  {
    icon: Wrench,
    title: "坏了会自己修",
    desc: "预览里一出报错，Iris 就把错误和行号交给 Leo。四轮修不好，自动退回上一个能用的版本，不会留给你一个白屏。",
    extra: <FixLog />,
    wide: true,
  },
  {
    icon: History,
    title: "每次修改都是一个版本",
    desc: "随时点开旧版本对比，觉得之前的好，一键恢复。",
    extra: <VersionRail />,
  },
  {
    icon: Link2,
    title: "一个链接就能分享",
    desc: "打开公开开关，对方不用登录就能用。数据各存各的浏览器。",
  },
  {
    icon: KeyRound,
    title: "不用注册",
    desc: "打开就能用。换设备时用恢复码把项目找回来。",
  },
  {
    icon: Download,
    title: "带走一个 HTML 文件",
    desc: "生成结果是单个 HTML 文件，下载后双击就能打开，放到任何静态托管上都能跑。",
  },
];

export function DetailSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHead no="03 · 交付之后" title="不止生成一次" desc="一个应用很少一次就对。这里的重点是让你放心地改：改坏了能修，修不好能退，满意了能分享。" />
      <div className="grid gap-4 md:grid-cols-3">
        {DETAILS.map(({ icon: Icon, title, desc, extra, wide }, i) => (
          <Reveal key={title} delay={(i % 3) * 80} className={wide ? "md:col-span-2" : undefined}>
            <div className="group h-full rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 transition-[border-color,box-shadow] duration-300 hover:border-[var(--brand)]/40 hover:shadow-[0_20px_40px_-24px_rgba(255,90,31,0.5)]">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff6a2b] to-[#ffb020] text-white shadow-[0_8px_20px_-8px_rgba(255,90,31,0.7)]">
                <Icon size={19} />
              </span>
              <h3 className="mt-3 text-base font-semibold">{title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-600">{desc}</p>
              {extra}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const TICKER = [
  "做一个读书清单，显示今年读完了几本",
  "家庭记账本，超预算时提醒",
  "周末徒步报名表，导出名单",
  "内容排期看板：选题 → 写作 → 审核 → 发布",
  "独立咖啡馆的介绍页",
  "跑步数据仪表盘，按周看跑量",
  "贪吃蛇，可以调速度",
  "家里的药品管理，快过期的排前面",
];

/** 首屏底部滚动的需求条：只是装饰，鼠标悬停暂停，减弱动效时不动。 */
export function PromptTicker() {
  const items = [...TICKER, ...TICKER];
  return (
    <div className="relative border-y border-white/10 bg-white/[0.02] py-3 [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]" aria-hidden>
      <div className="marquee flex w-max gap-8 font-mono text-[12px] text-zinc-500">
        {items.map((t, i) => (
          <span key={i} className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-[var(--brand)]">›</span>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

export function HomeFooter() {
  return (
    <footer className="bg-[var(--night)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 font-mono text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span className="flex items-center gap-2">
          <LogoMark size={16} /> Atoms Demo · 一句话生成单文件 Web 应用
        </span>
        <span>模型 DeepSeek Flash · 自托管部署 · 数据保存在 SQLite</span>
      </div>
    </footer>
  );
}
