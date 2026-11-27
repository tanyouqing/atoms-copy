import "server-only";
import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";

export const VISITOR_COOKIE = "atoms_vid";
export const VISITOR_ID_RE = /^[A-Za-z0-9_-]{21}$/;

const valid = (v: string | null | undefined): v is string => !!v && VISITOR_ID_RE.test(v);

/** Route Handler 中读取访客 ID：优先 middleware 注入的请求头，其次 cookie。 */
export function getVisitorId(req: NextRequest): string | null {
  const h = req.headers.get("x-visitor-id");
  if (valid(h)) return h;
  const c = req.cookies.get(VISITOR_COOKIE)?.value;
  return valid(c) ? c : null;
}

/** Server Component 中读取访客 ID。 */
export async function getVisitorIdFromRequest(): Promise<string | null> {
  const h = (await headers()).get("x-visitor-id");
  if (valid(h)) return h;
  const c = (await cookies()).get(VISITOR_COOKIE)?.value;
  return valid(c) ? c : null;
}

/** 客户端 IP：x-real-ip（Nginx 设置）→ x-forwarded-for 第一个 → "unknown"。 */
export function getClientIp(req: NextRequest): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || "unknown";
}
