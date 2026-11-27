"use client";

import type { RefObject } from "react";

/**
 * 预览 iframe（docs/09 §2）。永远不加 allow-same-origin。
 * allow-downloads：模板的"导出 CSV"需要（见 README 设计说明）。
 */
export function PreviewFrame({ srcdoc, iframeRef, title = "应用预览" }: { srcdoc: string; iframeRef: RefObject<HTMLIFrameElement | null>; title?: string }) {
  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcdoc}
      sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads"
      referrerPolicy="no-referrer"
      title={title}
      className="h-full w-full border-0 bg-white"
    />
  );
}
