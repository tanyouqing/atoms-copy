"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PreviewFrame } from "@/components/workspace/PreviewFrame";
import { readStorageSnapshot, usePreviewBridge } from "@/hooks/usePreviewBridge";
import { buildSrcdoc } from "@/lib/preview/build-srcdoc";
import type { RuntimeError } from "@/types/runtime";

const WIDTHS = { 桌面: "100%", 手机: "375px" } as const;

/** dev 画廊中的单个模板预览：与工作台相同的沙箱、runtime 与存储桥接。 */
export function TemplatePreview({ caseName, html }: { caseName: string; html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const storageKey = `atoms:dev:${caseName}`;
  const [renderKey, setRenderKey] = useState(0);
  const [width, setWidth] = useState<keyof typeof WIDTHS>("桌面");
  const [errors, setErrors] = useState<RuntimeError[]>([]);
  const [ready, setReady] = useState(false);
  const channel = useMemo(() => `${caseName}-${renderKey}-${Math.random().toString(36).slice(2)}`, [caseName, renderKey]);
  const [srcdoc, setSrcdoc] = useState("");
  // 存储快照只能在浏览器里读，所以 srcdoc 在挂载后组装
  useEffect(() => setSrcdoc(buildSrcdoc({ html, channel, storage: readStorageSnapshot(storageKey) })), [html, channel, storageKey]);

  const onError = useCallback((e: RuntimeError) => setErrors((prev) => [...prev, e]), []);
  const onReady = useCallback(() => setReady(true), []);
  usePreviewBridge({ iframeRef, channel, storageKey, onError, onReady });

  const remount = (reset: boolean) => {
    if (reset) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // 忽略：父页面存储不可用
      }
    }
    setErrors([]);
    setReady(false);
    setRenderKey((k) => k + 1);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {(Object.keys(WIDTHS) as (keyof typeof WIDTHS)[]).map((w) => (
          <button key={w} onClick={() => setWidth(w)} className={`rounded-lg px-3 py-1.5 ${width === w ? "bg-zinc-900 text-white" : "bg-white ring-1 ring-zinc-200"}`}>
            {w}
          </button>
        ))}
        <button onClick={() => remount(false)} className="rounded-lg bg-white px-3 py-1.5 ring-1 ring-zinc-200">
          刷新预览
        </button>
        <button onClick={() => remount(true)} className="rounded-lg bg-white px-3 py-1.5 ring-1 ring-zinc-200">
          重置应用数据
        </button>
        <span className={`ml-auto rounded-full px-2.5 py-1 text-xs ${errors.length ? "bg-rose-100 text-rose-700" : ready ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
          {errors.length ? `${errors.length} 个报错` : ready ? "运行正常" : "加载中…"}
        </span>
      </div>
      {errors.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-rose-50 p-3 font-mono text-xs text-rose-700">
          {errors.map((e, i) => (
            <li key={i}>
              {e.line ? `L${e.line}: ` : ""}
              {e.message}
            </li>
          ))}
        </ul>
      )}
      <div className="mx-auto h-full min-h-[640px] w-full flex-1 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm" style={{ maxWidth: WIDTHS[width] }}>
        {srcdoc && <PreviewFrame key={renderKey} srcdoc={srcdoc} iframeRef={iframeRef} title={caseName} />}
      </div>
    </div>
  );
}
