"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PreviewFrame } from "@/components/workspace/PreviewFrame";
import { readStorageSnapshot, usePreviewBridge } from "@/hooks/usePreviewBridge";
import { buildSrcdoc } from "@/lib/preview/build-srcdoc";
import { MadeWithBadge } from "./MadeWithBadge";

/** 分享页全屏 iframe，数据存在父页面 atoms:share:<projectId>，忽略报错。 */
export function ShareFrame({ projectId, html, versionId }: { projectId: string; html: string; versionId: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const storageKey = `atoms:share:${projectId}`;
  const channel = useMemo(() => `${versionId}-${Math.random().toString(36).slice(2)}`, [versionId]);
  const [srcdoc, setSrcdoc] = useState("");
  useEffect(() => setSrcdoc(buildSrcdoc({ html, channel, storage: readStorageSnapshot(storageKey) })), [html, channel, storageKey]);
  usePreviewBridge({ iframeRef, channel, storageKey });
  return (
    <div className="h-dvh w-screen overflow-hidden bg-white">
      {srcdoc && <PreviewFrame srcdoc={srcdoc} iframeRef={iframeRef} />}
      <MadeWithBadge />
    </div>
  );
}
