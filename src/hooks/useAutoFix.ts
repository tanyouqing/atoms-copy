"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RuntimeError } from "@/types/runtime";

/**
 * 测试员（Iris）的客户端 QA 状态机（docs/07 §11）：
 * 等待预览 ready（最长 8 秒）→ 合并报错 → 通过则上报 ok；有错且预算剩余则请求修复；否则放弃（服务端负责回退）。
 * 不渲染 UI，也不直接请求接口：通过回调交给 Workspace。
 */
export const FIX_BUDGET = 2;
const READY_TIMEOUT = 8000;

export type QaPhase = "idle" | "checking" | "fixing";

export interface QaJob {
  turnId: string;
  versionId: string;
  roundsUsed: number;
}

export interface AutoFixHandlers {
  /** 检查通过 */
  onPass: (job: QaJob) => Promise<void>;
  /** 请求一轮修复；返回下一个要检查的版本，或 null（修复失败 / 停止） */
  onFix: (job: QaJob, errors: RuntimeError[], round: number) => Promise<{ next: QaJob | null; failed: boolean; stopped: boolean }>;
  /** 放弃（预算用尽） */
  onGiveUp: (job: QaJob, errors: RuntimeError[]) => Promise<void>;
}

/** 过滤噪声：ResizeObserver、无行号的 "Script error." */
export function filterNoise(errors: RuntimeError[]): RuntimeError[] {
  const seen = new Set<string>();
  return errors.filter((e) => {
    if (e.message.includes("ResizeObserver loop")) return false;
    if (e.message.includes("Script error.") && !e.line) return false;
    if (seen.has(e.message)) return false;
    seen.add(e.message);
    return true;
  });
}

export function useAutoFix(handlers: AutoFixHandlers) {
  const [phase, setPhase] = useState<QaPhase>("idle");
  const jobRef = useRef<QaJob | null>(null);
  const errorsRef = useRef<RuntimeError[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const earlyReady = useRef<Map<string, { errors: RuntimeError[]; blank: boolean }>>(new Map());
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const finalize = useCallback(async (job: QaJob, ready: { errors: RuntimeError[]; blank: boolean } | null) => {
    if (jobRef.current !== job) return;
    clearTimer();
    let errors = filterNoise([...errorsRef.current, ...(ready?.errors ?? [])]);
    if (!ready) errors = [...errors, { type: "error", message: "页面加载超时（8 秒内没有完成渲染）" }];
    else if (ready.blank) errors = [...errors, { type: "error", message: "页面渲染后内容为空" }];
    errors = errors.slice(0, 10);

    const h = handlersRef.current;
    if (!errors.length) {
      jobRef.current = null;
      setPhase("idle");
      await h.onPass(job);
      return;
    }
    let round = job.roundsUsed;
    while (round < FIX_BUDGET) {
      round++;
      setPhase("fixing");
      const r = await h.onFix(job, errors, round);
      if (r.stopped) {
        jobRef.current = null;
        setPhase("idle");
        return;
      }
      if (r.next) {
        begin(r.next);
        return;
      }
    }
    jobRef.current = null;
    setPhase("idle");
    await h.onGiveUp({ ...job, roundsUsed: round }, errors);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const begin = useCallback(
    (job: QaJob) => {
      clearTimer();
      jobRef.current = job;
      errorsRef.current = [];
      setPhase("checking");
      const early = earlyReady.current.get(job.versionId);
      if (early) {
        void finalize(job, early);
        return;
      }
      timerRef.current = setTimeout(() => void finalize(job, null), READY_TIMEOUT);
    },
    [finalize],
  );

  const onPreviewError = useCallback((versionId: string, e: RuntimeError): boolean => {
    const job = jobRef.current;
    if (job && job.versionId === versionId) {
      errorsRef.current.push(e);
      return true;
    }
    return !!job; // 修复进行中的其他报错也不弹错误条
  }, []);

  const onPreviewReady = useCallback(
    (versionId: string, r: { errors: RuntimeError[]; blank: boolean }) => {
      const job = jobRef.current;
      if (job && job.versionId === versionId) void finalize(job, r);
      else {
        earlyReady.current.set(versionId, r);
        if (earlyReady.current.size > 20) earlyReady.current.clear();
      }
    },
    [finalize],
  );

  const cancel = useCallback(() => {
    clearTimer();
    jobRef.current = null;
    setPhase("idle");
  }, []);

  useEffect(() => clearTimer, []);

  return { phase, begin, cancel, onPreviewError, onPreviewReady };
}
