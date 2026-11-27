"use client";

import { html as htmlLang } from "@codemirror/lang-html";
import { json as jsonLang } from "@codemirror/lang-json";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { Copy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

/** 只读代码查看（CodeMirror 6）。流式时自动滚到底部。 */
export default function CodeView({ code, config, streaming }: { code: string; config: unknown | null; streaming: boolean }) {
  const [mode, setMode] = useState<"html" | "config">("html");
  const showConfig = mode === "config" && config !== null && !streaming;
  const text = showConfig ? JSON.stringify(config, null, 2) : code;
  const viewRef = useRef<EditorView | null>(null);
  const extensions = useMemo(() => [showConfig ? jsonLang() : htmlLang(), EditorView.lineWrapping], [showConfig]);

  useEffect(() => {
    if (!streaming || !viewRef.current) return;
    const v = viewRef.current;
    v.dispatch({ effects: EditorView.scrollIntoView(v.state.doc.length, { y: "end" }) });
  }, [text, streaming]);

  const copy = async () => {
    if (await copyText(text)) toast.success("已复制代码");
    else {
      viewRef.current?.dispatch({ selection: { anchor: 0, head: viewRef.current.state.doc.length } });
      viewRef.current?.focus();
      toast("请手动复制（已全选）");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-1.5">
        {config !== null && !streaming && (
          <div className="flex rounded-lg bg-zinc-100 p-0.5 text-xs" data-testid="code-mode">
            {(["html", "config"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={cn("rounded-md px-2.5 py-1", mode === m ? "bg-white font-medium shadow-sm" : "text-zinc-500")}>
                {m === "html" ? "HTML" : "配置 JSON"}
              </button>
            ))}
          </div>
        )}
        {streaming && <span className="text-xs text-[var(--muted)]">Leo 正在编写代码…</span>}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void copy()}>
          <Copy size={14} /> 复制代码
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden text-[12px]" data-testid="code-view">
        <CodeMirror value={text} readOnly editable={false} height="100%" style={{ height: "100%" }} extensions={extensions} basicSetup={{ foldGutter: false, highlightActiveLine: false }} onCreateEditor={(v) => (viewRef.current = v)} />
      </div>
    </div>
  );
}
