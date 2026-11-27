import { z } from "zod";
import { deleteProject, getProjectDetail, getProjectForVisitor, projectSummary, updateProject } from "@/lib/db/queries";
import { notFoundError } from "@/lib/errors";
import { readJson, withApi } from "@/lib/http";
import { abortProject, isLocked } from "@/lib/locks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type P = { id: string };

export const GET = withApi<P>((_req, { params, visitorId }) => {
  const detail = getProjectDetail(params.id, visitorId, isLocked(params.id)) ?? notFoundError();
  return Response.json(detail);
});

const Patch = z
  .object({ title: z.string().trim().min(1).max(40).optional(), isPublic: z.boolean().optional() })
  .refine((b) => b.title !== undefined || b.isPublic !== undefined, "至少提供一个字段");

export const PATCH = withApi<P>(async (req, { params, visitorId }) => {
  const body = Patch.parse(await readJson(req));
  if (!getProjectForVisitor(params.id, visitorId)) notFoundError();
  const updated =
    updateProject(params.id, {
      ...(body.title !== undefined ? { title: body.title, titleLocked: true } : {}),
      ...(body.isPublic !== undefined ? { isPublic: body.isPublic } : {}),
    }) ?? notFoundError();
  return Response.json({ project: projectSummary(updated) });
});

export const DELETE = withApi<P>((_req, { params, visitorId }) => {
  if (!getProjectForVisitor(params.id, visitorId)) notFoundError();
  abortProject(params.id);
  deleteProject(params.id);
  return Response.json({ ok: true });
});
