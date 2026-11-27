import "server-only";
import { countUsage, insertUsage } from "@/lib/db/queries";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/log";

export const WINDOW_MS = 24 * 60 * 60 * 1000;

export interface Limits {
  visitor: number;
  ip: number;
  global: number;
}

export type LimitResult = { ok: true } | { ok: false; code: "RATE_LIMITED" | "GLOBAL_LIMITED"; n?: number };

/** 纯判断：给定计数与上限，返回是否放行（检查顺序：访客 → IP → 全站）。 */
export function evaluateLimits(counts: Limits, limits: Limits): LimitResult {
  if (counts.visitor >= limits.visitor) return { ok: false, code: "RATE_LIMITED", n: limits.visitor };
  if (counts.ip >= limits.ip) return { ok: false, code: "RATE_LIMITED", n: limits.visitor };
  if (counts.global >= limits.global) return { ok: false, code: "GLOBAL_LIMITED" };
  return { ok: true };
}

/** 检查并记录一次用量（docs/06 §6）。超限抛 AppError；mock 模式不限流。 */
export function checkAndRecordUsage(input: { visitorId: string; ip: string; kind: "generate" | "fix"; now?: number }) {
  const env = getEnv();
  if (env.mock) return;
  const now = input.now ?? Date.now();
  const limits = { visitor: env.RATE_LIMIT_VISITOR_PER_DAY, ip: env.RATE_LIMIT_IP_PER_DAY, global: env.RATE_LIMIT_GLOBAL_PER_DAY };
  const r = evaluateLimits(countUsage({ visitorId: input.visitorId, ip: input.ip, sinceMs: now - WINDOW_MS }), limits);
  if (!r.ok) {
    log.warn("rate_limited", { code: r.code, kind: input.kind, ip: input.ip });
    throw new AppError(r.code, r.n !== undefined ? { n: r.n } : undefined);
  }
  insertUsage({ ...input, now });
}
