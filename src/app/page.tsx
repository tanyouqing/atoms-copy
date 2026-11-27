import { HomeHeader } from "@/components/home/HomeHeader";
import { ExampleCards } from "@/components/home/ExampleCards";
import { ProjectGrid } from "@/components/home/ProjectGrid";
import { PromptBox } from "@/components/home/PromptBox";
import { listProjects } from "@/lib/db/queries";
import { getVisitorIdFromRequest } from "@/lib/visitor";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const visitorId = await getVisitorIdFromRequest();
  const projects = visitorId ? listProjects(visitorId) : [];
  return (
    <div className="min-h-screen">
      <HomeHeader />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-14 sm:pt-20">
        <section className="text-center">
          <h1 className="text-[28px] font-bold tracking-tight sm:text-4xl">一句话，交付一个能用的应用</h1>
          <p className="mt-3 text-base text-[var(--muted)]">描述你的想法，AI 团队会规划、编码、测试并实时预览</p>
        </section>
        <PromptBox />
        <ExampleCards />
        <ProjectGrid projects={projects} />
      </main>
    </div>
  );
}
