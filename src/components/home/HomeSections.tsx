import { Download, History, KeyRound, Link2, Wrench } from "lucide-react";
import { AgentAvatar } from "@/components/ui/avatar";
import { LogoMark } from "@/components/ui/logo";
import { AGENTS, type AgentRole } from "@/lib/agents";
import { Reveal } from "./Reveal";
import { TemplateWall } from "./TemplateWall";

function SectionHead({ no, title, desc, id }: { no: string; title: string; desc: string; id?: string }) {
  return (
    <div id={id} className="mb-8 flex scroll-mt-20 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="font-display text-sm italic text-[var(--brand)]">{no}</div>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h2>
      </div>
      <p className="max-w-md text-sm leading-relaxed text-zinc-500 sm:text-right">{desc}</p>
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
        <span className="text-[#B54A3A]">{'- "themeColor": "indigo"'}</span>
        <br />
        <span className="text-[#2F7A4D]">{'+ "themeColor": "emerald"'}</span>
      </span>
    ),
  },
  {
    role: "qa",
    does: "把应用放进沙箱里跑一遍，抓到报错就带着行号退回给 Leo。最多修两轮，修不好就退回上一个能用的版本。",
    says: "第 42 行读到了 undefined，Leo 麻烦看一下。",
  },
];

export function TeamSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHead id="team" no="01 · 谁在干活" title="一支三个人的小队" desc="每次生成都按同一套流程走：先想清楚，再写，最后检查。每一步在工作台里都看得见。" />
      <div className="relative grid gap-4 md:grid-cols-3">
        <div className="pointer-events-none absolute left-[16%] right-[16%] top-[52px] hidden border-t-2 border-dashed border-zinc-300 md:block" aria-hidden />
        {TEAM.map(({ role, does, says }, i) => {
          const a = AGENTS[role];
          return (
            <Reveal key={role} delay={i * 90}>
              <article className="relative h-full rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
                <div className="flex items-center gap-3">
                  <AgentAvatar role={role} className="h-16 w-16 ring-4 ring-[var(--bg)]" />
                  <div>
                    <div className="font-display text-xl font-semibold">{a.short}</div>
                    <div className="text-sm" style={{ color: a.color }}>
                      {a.title}
                    </div>
                  </div>
                  <span className="ml-auto self-start font-display text-3xl italic text-zinc-200">{i + 1}</span>
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
    <section className="border-y border-[var(--border)] bg-[var(--panel)]/60">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHead id="templates" no="02 · 从哪儿起步" title="八个打磨过的模板" desc="常见需求先套模板，界面和交互都是调好的；模板覆盖不到的，再让 Leo 从零写。点一张卡，把例子填进输入框。" />
        <TemplateWall />
      </div>
    </section>
  );
}

function FixLog() {
  return (
    <div className="mt-4 space-y-1 rounded-lg bg-zinc-900 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
      <div>
        <span className="text-[#F2A38A]">✕</span> L42 TypeError: items is undefined
      </div>
      <div>
        <span className="text-[#8FD0FF]">→</span> Leo 修复中（第 1/2 轮）
      </div>
      <div>
        <span className="text-[#8FE0B0]">✓</span> 重新运行，0 个报错
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
    desc: "预览里一出报错，Iris 就把错误和行号交给 Leo。两轮修不好，自动退回上一个能用的版本，不会留给你一个白屏。",
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
            <div className="h-full rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
              <Icon size={20} className="text-[var(--brand)]" />
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

export function HomeFooter() {
  return (
    <footer className="border-t border-[var(--border)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span className="flex items-center gap-2">
          <LogoMark size={16} /> Atoms Demo · 一句话生成单文件 Web 应用
        </span>
        <span>模型 DeepSeek Flash · 自托管部署 · 数据保存在 SQLite</span>
      </div>
    </footer>
  );
}
