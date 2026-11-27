import { withApi } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi((_req, { visitorId }) => Response.json({ visitorId, recoveryCode: visitorId }));
