import { NextResponse, type NextRequest } from "next/server";

/** 发放匿名访客 cookie，并通过 x-visitor-id 透传给 Route Handler（docs/04 §6）。 */
const COOKIE = "atoms_vid";
const VALID = /^[A-Za-z0-9_-]{21}$/;
const ALPHABET = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

function newVisitorId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(21));
  let id = "";
  for (const b of bytes) id += ALPHABET[b & 63];
  return id;
}

export function middleware(req: NextRequest) {
  const existing = req.cookies.get(COOKIE)?.value;
  const id = existing && VALID.test(existing) ? existing : newVisitorId();
  const headers = new Headers(req.headers);
  headers.set("x-visitor-id", id);
  const res = NextResponse.next({ request: { headers } });
  if (id !== existing) {
    res.cookies.set(COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 31_536_000 });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|vendor/|favicon.ico).*)"],
};
