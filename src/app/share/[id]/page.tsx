import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareFrame } from "@/components/share/ShareFrame";
import { getProjectById, getVersion, getVersionBySeq } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

function load(id: string, v: string | undefined) {
  const project = getProjectById(id);
  if (!project || !project.isPublic) return null;
  const seq = v && /^\d+$/.test(v) ? Number(v) : null;
  const version = seq ? getVersionBySeq(id, seq) : project.currentVersionId ? getVersion(project.currentVersionId) : null;
  return version ? { project, version } : null;
}

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const r = load((await params).id, (await searchParams).v);
  return { title: r ? r.project.title : "这个应用不存在或未公开", robots: { index: false } };
}

/** 分享页（E3）：全屏展示公开项目的当前版本或 ?v= 指定版本。 */
export default async function SharePage({ params, searchParams }: Props) {
  const r = load((await params).id, (await searchParams).v);
  if (!r) notFound();
  return <ShareFrame projectId={r.project.id} html={r.version.html} versionId={r.version.id} />;
}
