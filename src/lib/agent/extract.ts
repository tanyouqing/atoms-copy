import { AppError } from "@/lib/errors";

/**
 * 从模型输出中提取 JSON 对象文本（docs/07 §4）：去掉 ``` 围栏，
 * 取第一个 `{` 到与之匹配的 `}`（跳过字符串中的括号）。找不到返回 null。
 */
export function extractJson(text: string): string | null {
  const s = text.replace(/```(?:json)?/gi, "");
  const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

export function parseJsonLoose(text: string): unknown {
  const raw = extractJson(text);
  if (raw === null) throw new SyntaxError("输出中没有 JSON 对象");
  return JSON.parse(raw) as unknown;
}

/** 去掉开头的 ```html / ``` 与结尾的 ```。 */
export function stripFences(text: string): string {
  return text.replace(/^\s*```[a-zA-Z]*\s*\n?/, "").replace(/\n?```\s*$/, "");
}

export interface ExtractedHtml {
  html: string;
  complete: boolean; // 是否包含 </html>
}

/** docs/07 §6.3：起点为第一个 <!DOCTYPE（否则 <html），终点为最后一个 </html>。无起点抛 LLM_BAD_OUTPUT。 */
export function extractHtml(text: string): ExtractedHtml {
  const s = stripFences(text);
  let start = s.search(/<!DOCTYPE/i);
  if (start < 0) start = s.search(/<html/i);
  if (start < 0) throw new AppError("LLM_BAD_OUTPUT", undefined, "模型没有输出 HTML 代码，请重试");
  const lower = s.toLowerCase();
  const end = lower.lastIndexOf("</html>");
  if (end < start) return { html: s.slice(start).replace(/\s*```\s*$/, ""), complete: false };
  return { html: s.slice(start, end + "</html>".length), complete: true };
}

/** 未截断但缺少结尾标签时补齐 </body></html>。 */
export function closeHtml(html: string): string {
  let out = html.trimEnd();
  if (!/<\/body>/i.test(out)) out += "\n</body>";
  if (!/<\/html>/i.test(out)) out += "\n</html>";
  return out;
}

/** 续写拼接：去掉续写开头与 buffer 末尾的重叠（N 从 200 试到 10）。 */
export function joinContinuation(buffer: string, cont: string): string {
  const c = stripFences(cont);
  for (let n = Math.min(200, buffer.length, c.length); n >= 10; n--) {
    if (buffer.endsWith(c.slice(0, n))) return buffer + c.slice(n);
  }
  return buffer + c;
}
