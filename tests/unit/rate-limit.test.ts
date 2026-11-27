import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setDbForTests } from "@/lib/db";
import { resetEnvForTests } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { WINDOW_MS, checkAndRecordUsage, evaluateLimits } from "@/lib/rate-limit";

const limits = { visitor: 2, ip: 3, global: 4 };

describe("evaluateLimits", () => {
  it("访客上限", () => expect(evaluateLimits({ visitor: 2, ip: 0, global: 0 }, limits)).toEqual({ ok: false, code: "RATE_LIMITED", n: 2 }));
  it("IP 上限", () => expect(evaluateLimits({ visitor: 0, ip: 3, global: 0 }, limits)).toMatchObject({ ok: false, code: "RATE_LIMITED" }));
  it("全站上限", () => expect(evaluateLimits({ visitor: 0, ip: 0, global: 4 }, limits)).toEqual({ ok: false, code: "GLOBAL_LIMITED" }));
  it("未超限放行", () => expect(evaluateLimits({ visitor: 1, ip: 2, global: 3 }, limits)).toEqual({ ok: true }));
});

describe("checkAndRecordUsage", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    setDbForTests(":memory:");
    Object.assign(process.env, { LLM_MOCK: "0", DEEPSEEK_API_KEY: "test", RATE_LIMIT_VISITOR_PER_DAY: "2", RATE_LIMIT_IP_PER_DAY: "3", RATE_LIMIT_GLOBAL_PER_DAY: "100" });
    resetEnvForTests();
  });
  afterEach(() => {
    process.env = { ...saved };
    resetEnvForTests();
  });

  it("超过访客上限抛 RATE_LIMITED，24 小时窗口滑动后恢复", () => {
    const t = 10 * WINDOW_MS;
    checkAndRecordUsage({ visitorId: "v", ip: "i", kind: "generate", now: t });
    checkAndRecordUsage({ visitorId: "v", ip: "i", kind: "fix", now: t + 1 });
    expect(() => checkAndRecordUsage({ visitorId: "v", ip: "i", kind: "generate", now: t + 2 })).toThrowError(AppError);
    try {
      checkAndRecordUsage({ visitorId: "v", ip: "i", kind: "generate", now: t + 2 });
    } catch (e) {
      expect((e as AppError).code).toBe("RATE_LIMITED");
      expect((e as AppError).message).toContain("每天 2 次");
    }
    expect(() => checkAndRecordUsage({ visitorId: "v", ip: "i", kind: "generate", now: t + WINDOW_MS + 1 })).not.toThrow();
  });

  it("mock 模式不限流", () => {
    process.env.LLM_MOCK = "1";
    resetEnvForTests();
    for (let i = 0; i < 5; i++) checkAndRecordUsage({ visitorId: "v", ip: "i", kind: "generate", now: i });
  });
});
