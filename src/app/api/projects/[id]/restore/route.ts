import { z } from "zod";
import { getProjectForVisitor, getVersion, inTransaction, insertMessage, newId, setCurrentVersion, toMessageDTO, toVersionFull } from "@/lib/db/queries";
import { AppError, notFoundError } from "@/lib/errors";
import { readJson, withApi } from "@/lib/http";
import { isLocked } from "@/lib/locks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ versionId: z.string().min(1), reason: z.enum(["user", "auto_rollback"]).default("user") });

export const POST = withApi<{ id: string }>(async (req, { params, visitorId }) => {
  const body = Body.parse(await readJson(req));
  getProjectForVisitor(params.id, visitorId) ?? notFoundError();
  if (isLocked(params.id)) throw new AppError("PROJECT_BUSY");
  const v = getVersion(body.versionId);
  if (!v || v.projectId !== params.id) notFoundError();
  const message = inTransaction(() => {
    setCurrentVersion(params.id, v.id);
    if (body.reason !== "user") return null;
    return toMessageDTO(
      insertMessage({ projectId: params.id, turnId: newId(), role: "system", kind: "notice", status: "done", content: `已恢复到 v${v.seq}`, versionId: v.id }),
    );
  });
  return Response.json({ currentVersion: toVersionFull(v), message });
});
