import { ExampleCards } from "@/components/home/ExampleCards";
import { HeroCanvas } from "@/components/home/HeroCanvas";
import { HeroDemo } from "@/components/home/HeroDemo";
import { HomeHeader } from "@/components/home/HomeHeader";
import { DetailSection, HomeFooter, PromptTicker, TeamSection, TemplateSection } from "@/components/home/HomeSections";
import { ProjectGrid } from "@/components/home/ProjectGrid";
import { PromptBox } from "@/components/home/PromptBox";
import { listProjects } from "@/lib/db/queries";
import { getVisitorIdFromRequest } from "@/lib/visitor";

export const dynamic = "force-dynamic";

const STATS = [
  { k: "8", v: "个调好的模板" },
  { k: "≈30s", v: "从需求到可用" },
  { k: "2 轮", v: "报错自动修复" },
  { k: "0", v: "注册步骤" },
];

export default async function HomePage() {
  const visitorId = await getVisitorIdFromRequest();
  const projects = visitorId ? listProjects(visitorId) : [];
  return (
    <div className="min-h-screen overflow-x-clip">
      <HomeHeader />
      <main>
        <section className="relative -mt-14 overflow-hidden bg-[var(--night)] pt-14 text-white">
          <div className="tech-grid absolute inset-0" aria-hidden />
          <div className="glow-orb -left-32 top-10 h-96 w-96 bg-[#ff5a1f]/35" aria-hidden />
          <div className="glow-orb -right-24 top-40 h-[28rem] w-[28rem] bg-[#27d3c3]/20 [animation-delay:-6s]" aria-hidden />
          <div className="glow-orb bottom-[-10rem] left-1/3 h-80 w-80 bg-[#3b82f6]/25 [animation-delay:-11s]" aria-hidden />
          <HeroCanvas />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-20">
            <div className="atoms-in">
              <p className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[12px] text-zinc-400">
                <span className="text-[var(--signal)]">$</span> atoms new --team mia,leo,iris
                <span className="atoms-caret inline-block h-3.5 w-[7px] bg-[var(--signal)]" aria-hidden />
              </p>
              <h1 aria-label="一句话，交付一个能用的应用" className="mt-5 text-[36px] font-extrabold leading-[1.12] tracking-tight sm:text-5xl lg:text-[58px]">
                一句话，
                <br />
                交付一个
                <span className="relative inline-block whitespace-nowrap">
                  <span className="text-fire">能用的</span>
                  <svg viewBox="0 0 120 14" preserveAspectRatio="none" className="absolute -bottom-1.5 left-0 h-3 w-full text-[var(--brand)] sm:-bottom-2" aria-hidden>
                    <path className="atoms-draw" style={{ "--len": 130 } as React.CSSProperties} d="M2 9 C 30 3, 60 3, 118 7" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                </span>
                应用
              </h1>
              <p className="mt-5 max-w-xl text-[15px] leading-7 text-zinc-400">
                说说你想要什么。<span className="text-[#ffc861]">Mia</span> 拆需求，<span className="text-[#7cb3ff]">Leo</span> 写代码，<span className="text-[#5ee08f]">Iris</span> 跑一遍检查，几十秒后应用就在页面里跑起来。不满意就接着说，改到满意为止。
              </p>
              <PromptBox />
              <ExampleCards />
            </div>
            <div className="atoms-in [animation-delay:120ms]">
              <HeroDemo />
            </div>
          </div>
          <div className="relative mx-auto max-w-6xl px-4 pb-12 sm:px-6">
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.v} className="bg-[var(--night)]/80 px-4 py-4 backdrop-blur">
                  <dt className="sr-only">{s.v}</dt>
                  <dd className="font-mono text-2xl font-semibold text-white">{s.k}</dd>
                  <dd className="mt-0.5 text-xs text-zinc-500">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <PromptTicker />
        </section>

        <section id="projects" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-14 sm:px-6">
          <ProjectGrid projects={projects} />
        </section>

        <TeamSection />
        <TemplateSection />
        <DetailSection />
      </main>
      <HomeFooter />
    </div>
  );
}
