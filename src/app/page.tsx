import { ExampleCards } from "@/components/home/ExampleCards";
import { HeroDemo } from "@/components/home/HeroDemo";
import { HomeHeader } from "@/components/home/HomeHeader";
import { DetailSection, HomeFooter, TeamSection, TemplateSection } from "@/components/home/HomeSections";
import { ProjectGrid } from "@/components/home/ProjectGrid";
import { PromptBox } from "@/components/home/PromptBox";
import { listProjects } from "@/lib/db/queries";
import { getVisitorIdFromRequest } from "@/lib/visitor";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const visitorId = await getVisitorIdFromRequest();
  const projects = visitorId ? listProjects(visitorId) : [];
  return (
    <div className="min-h-screen overflow-x-clip">
      <HomeHeader />
      <main>
        <section className="paper-dots relative">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[var(--bg)]" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-24">
            <div className="atoms-in">
              <p className="flex items-center gap-2 text-[13px] text-zinc-500">
                <span className="h-px w-6 bg-zinc-400" />
                一句话生成单文件 Web 应用
              </p>
              <h1 aria-label="一句话，交付一个能用的应用" className="mt-4 text-[34px] font-extrabold leading-[1.15] tracking-tight sm:text-5xl lg:text-[54px]">
                一句话，
                <br />
                交付一个
                <span className="relative inline-block whitespace-nowrap">
                  能用的
                  <svg viewBox="0 0 120 14" preserveAspectRatio="none" className="absolute -bottom-1.5 left-0 h-3 w-full text-[var(--brand)] sm:-bottom-2" aria-hidden>
                    <path className="atoms-draw" style={{ "--len": 130 } as React.CSSProperties} d="M2 9 C 30 3, 60 3, 118 7" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                </span>
                应用
              </h1>
              <p className="mt-5 max-w-xl text-[15px] leading-7 text-zinc-600">说说你想要什么。Mia 拆需求，Leo 写代码，Iris 跑一遍检查，几十秒后应用就在页面里跑起来。不满意就接着说，改到满意为止。</p>
              <PromptBox />
              <ExampleCards />
            </div>
            <div className="atoms-in [animation-delay:120ms]">
              <HeroDemo />
            </div>
          </div>
        </section>

        <section id="projects" className="mx-auto max-w-6xl scroll-mt-20 px-4 sm:px-6">
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
