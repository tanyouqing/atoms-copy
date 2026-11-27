import { pingDb } from "@/lib/db/queries";
import { getEnv } from "@/lib/env";
import { withApi } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi(
  () => {
    const env = getEnv();
    return Response.json({ ok: true, db: pingDb(), model: env.DEEPSEEK_MODEL, mock: env.mock });
  },
  { requireVisitor: false },
);
