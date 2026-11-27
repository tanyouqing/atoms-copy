import { readableVersion } from "@/lib/access";
import { toVersionFull } from "@/lib/db/queries";
import { withApi } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi<{ id: string }>((_req, { params, visitorId }) => {
  const { version } = readableVersion(params.id, visitorId);
  return Response.json({ version: toVersionFull(version) });
});
