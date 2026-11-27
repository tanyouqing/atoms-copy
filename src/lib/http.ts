import "server-only";
import type { NextRequest } from "next/server";
import { ZodError } from "zod";
import { upsertVisitor } from "@/lib/db/queries";
import { AppError, isAppError } from "@/lib/errors";
import { log } from "@/lib/log";
import { getClientIp, getVisitorId } from "@/lib/visitor";

export interface ApiCtx<P> {
  params: P;
  visitorId: string;
  ip: string;
}

export function errorResponse(e: AppError): Response {
  return Response.json({ error: { code: e.code, message: e.message } }, { status: e.status });
}

/** 把任意异常转换为 AppError（ZodError → BAD_REQUEST，未知 → INTERNAL）。 */
export function toAppError(e: unknown): AppError {
  if (isAppError(e)) return e;
  if (e instanceof ZodError) {
    const first = e.issues[0];
    const where = first?.path.length ? `${first.path.join(".")}：` : "";
    return new AppError("BAD_REQUEST", undefined, first ? `请求参数有误：${where}${first.message}` : undefined);
  }
  if (e instanceof SyntaxError) return new AppError("BAD_REQUEST", undefined, "请求体不是合法的 JSON");
  return new AppError("INTERNAL");
}

/**
 * Route Handler 包装（docs/11 §4）：解析访客、await params、错误转 JSON、单行日志。
 * 访客 ID 缺失时（未经过 middleware 的请求）按 400 处理。
 */
export function withApi<P = Record<string, string>>(
  handler: (req: NextRequest, ctx: ApiCtx<P>) => Promise<Response> | Response,
  opts: { requireVisitor?: boolean } = {},
) {
  const requireVisitor = opts.requireVisitor ?? true;
  return async (req: NextRequest, ctx: { params: Promise<P> }): Promise<Response> => {
    const t0 = Date.now();
    const route = `${req.method} ${req.nextUrl.pathname}`;
    try {
      const visitorId = getVisitorId(req);
      if (requireVisitor && !visitorId) throw new AppError("BAD_REQUEST", undefined, "缺少访客身份，请刷新页面");
      if (visitorId) upsertVisitor(visitorId);
      const params = ((await ctx?.params) ?? {}) as P;
      const res = await handler(req, { params, visitorId: visitorId ?? "", ip: getClientIp(req) });
      if (!res.headers.get("content-type")?.includes("text/event-stream")) log.info("api", { route, status: res.status, ms: Date.now() - t0 });
      return res;
    } catch (e) {
      const err = toAppError(e);
      if (err.code === "INTERNAL") log.error("api.error", { route, ms: Date.now() - t0, err: String(e instanceof Error ? e.stack : e).slice(0, 1000) });
      else log.info("api", { route, status: err.status, code: err.code, ms: Date.now() - t0 });
      return errorResponse(err);
    }
  };
}

/** 读取并校验 JSON 请求体（上限 1 MB）。 */
export async function readJson(req: NextRequest): Promise<unknown> {
  const text = await req.text();
  if (text.length > 1_000_000) throw new AppError("BAD_REQUEST", undefined, "请求体过大");
  return text ? (JSON.parse(text) as unknown) : {};
}
