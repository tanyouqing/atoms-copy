"use client";

import { useEffect, type RefObject } from "react";
import type { RuntimeError } from "@/types/runtime";

/** 读取父页面中保存的 iframe 存储快照（docs/09 §5）。 */
export function readStorageSnapshot(storageKey: string): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeStorage(storageKey: string, update: (cur: Record<string, string>) => Record<string, string>) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(update(readStorageSnapshot(storageKey))));
  } catch {
    // 父页面存储不可用（隐私模式等）时，预览仍可使用，只是刷新后数据不保留
  }
}

interface BridgeMessage {
  channel?: string;
  type?: string;
  op?: "set" | "remove" | "clear";
  key?: string;
  value?: string;
  error?: RuntimeError;
  errors?: RuntimeError[];
  blank?: boolean;
}

/** 监听预览 iframe 的 postMessage：存储回写、报错、就绪信号。 */
export function usePreviewBridge(opts: {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  channel: string;
  storageKey: string;
  onError?: (e: RuntimeError) => void;
  onReady?: (r: { errors: RuntimeError[]; blank: boolean }) => void;
}) {
  const { iframeRef, channel, storageKey, onError, onReady } = opts;
  useEffect(() => {
    const handler = (event: MessageEvent<BridgeMessage>) => {
      const d = event.data;
      if (event.source !== iframeRef.current?.contentWindow || !d || d.channel !== channel) return;
      if (d.type === "atoms:storage" && d.op) {
        writeStorage(storageKey, (cur) => {
          if (d.op === "clear") return {};
          const next = { ...cur };
          if (d.op === "set" && d.key !== undefined) next[d.key] = String(d.value ?? "");
          if (d.op === "remove" && d.key !== undefined) delete next[d.key];
          return next;
        });
      } else if (d.type === "atoms:error" && d.error) onError?.(d.error);
      else if (d.type === "atoms:ready") onReady?.({ errors: d.errors ?? [], blank: !!d.blank });
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [iframeRef, channel, storageKey, onError, onReady]);
}
