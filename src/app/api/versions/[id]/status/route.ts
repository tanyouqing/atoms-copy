import { z } from "zod";
import { applyQaResult } from "@/lib/agent/qa-result";
import { RuntimeErrorSchema } from "@/lib/agent/schemas";
import { getProjectForVisitor, getVersion } from "@/lib/db/queries";
import { notFoundError } from "@/lib/errors";
import { readJson, withApi } from "@/lib/http";
import { log } from "@/lib/log";
import { FIX_BUDGET } from "@/lib/qa-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z
  .object({
    status: z.enum(["ok", "error"]),
    errors: z.array(RuntimeErrorSchema).max(10).optional(),
    qa: z.object({ turnId: z.string().min(1), outcome: z.enum(["pass", "give_up"]), round: z.number().int().min(0).max(FIX_BUDGET) }).optional(),
  })
  .refine((b) => b.status === "ok" || (b.errors?.length ?? 0) > 0, { message: "status=error 时必须提供 errors", path: ["errors"] });

export const POST = withApi<{ id: string }>(async (req, { params, visitorId }) => {
  const body = Body.parse(await readJson(req));
  const version = getVersion(params.id) ?? notFoundError();
  if (!getProjectForVisitor(version.projectId, visitorId)) notFoundError();
  const r = applyQaResult({ version, status: body.status, errors: body.errors ?? [], qa: body.qa });
  if (body.qa?.outcome === "give_up") log.info("qa.give_up", { projectId: version.projectId, versionId: version.id, rolledBackTo: r.currentVersion?.id ?? null });
  return Response.json({ ok: true, message: r.message, currentVersion: r.currentVersion });
});
