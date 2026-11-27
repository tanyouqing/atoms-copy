import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Workspace } from "@/components/workspace/Workspace";
import { getProjectDetail } from "@/lib/db/queries";
import { isLocked } from "@/lib/locks";
import { getVisitorIdFromRequest } from "@/lib/visitor";

export const dynamic = "force-dynamic";

async function load(id: string) {
  const visitorId = await getVisitorIdFromRequest();
  return visitorId ? getProjectDetail(id, visitorId, isLocked(id)) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const detail = await load((await params).id);
  return { title: detail ? `${detail.project.title} · Atoms Demo` : "页面不存在 · Atoms Demo" };
}

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await load(id);
  if (!detail) notFound();
  return (
    <Suspense>
      <Workspace initial={detail} />
    </Suspense>
  );
}
