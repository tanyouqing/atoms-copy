import { z } from "zod";
import { visitorExists } from "@/lib/db/queries";
import { AppError } from "@/lib/errors";
import { readJson, withApi } from "@/lib/http";
import { VISITOR_COOKIE, VISITOR_ID_RE } from "@/lib/visitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ code: z.string().trim() });

export const POST = withApi(async (req) => {
  const { code } = Body.parse(await readJson(req));
  if (!VISITOR_ID_RE.test(code) || !visitorExists(code)) throw new AppError("INVALID_RECOVERY_CODE");
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", `${VISITOR_COOKIE}=${code}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`);
  return res;
});
