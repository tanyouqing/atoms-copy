/** SEARCH/REPLACE 补丁解析与应用（docs/07 §7.4）。纯函数，不调用模型。 */
export interface Patch {
  search: string;
  replace: string;
}

export type PatchFailure = { index: number; reason: "not_found" | "ambiguous" | "parse" };
export type ApplyResult = { ok: true; html: string; applied: number } | { ok: false; failures: PatchFailure[] };

const BLOCK_RE = /<<<<<<< SEARCH\r?\n([\s\S]*?)\r?\n?=======\r?\n([\s\S]*?)\r?\n?>>>>>>> REPLACE/g;

export function parsePatches(text: string): Patch[] {
  const out: Patch[] = [];
  for (const m of text.matchAll(BLOCK_RE)) out.push({ search: m[1] ?? "", replace: m[2] ?? "" });
  return out;
}

function countOccurrences(hay: string, needle: string): { count: number; index: number } {
  let count = 0;
  let first = -1;
  let from = 0;
  while (needle.length) {
    const i = hay.indexOf(needle, from);
    if (i < 0) break;
    if (first < 0) first = i;
    count++;
    from = i + needle.length;
  }
  return { count, index: first };
}

/** 应用单个补丁；失败返回原因。 */
function applyOne(doc: string, p: Patch): { ok: true; doc: string } | { ok: false; reason: "not_found" | "ambiguous" } {
  const eol = doc.includes("\r\n") ? "\r\n" : "\n";
  const search = p.search.replace(/\r\n/g, "\n");
  const replace = p.replace.replace(/\r\n/g, "\n").split("\n").join(eol);
  const searchDoc = search.split("\n").join(eol);

  if (searchDoc.trim().length) {
    const exact = countOccurrences(doc, searchDoc);
    if (exact.count === 1) return { ok: true, doc: doc.slice(0, exact.index) + replace + doc.slice(exact.index + searchDoc.length) };
    if (exact.count > 1) return { ok: false, reason: "ambiguous" };
  }

  // 宽松匹配：逐行 trim 后比较连续窗口（忽略首尾空行）
  const sLines = search.split("\n").map((l) => l.trim());
  while (sLines.length && sLines[0] === "") sLines.shift();
  while (sLines.length && sLines[sLines.length - 1] === "") sLines.pop();
  if (!sLines.length) return { ok: false, reason: "not_found" };
  const dLines = doc.split(eol);
  const trimmed = dLines.map((l) => l.trim());
  const hits: number[] = [];
  for (let i = 0; i + sLines.length <= trimmed.length; i++) {
    let match = true;
    for (let j = 0; j < sLines.length; j++) {
      if (trimmed[i + j] !== sLines[j]) {
        match = false;
        break;
      }
    }
    if (match) hits.push(i);
  }
  if (hits.length === 0) return { ok: false, reason: "not_found" };
  if (hits.length > 1) return { ok: false, reason: "ambiguous" };
  const at = hits[0] as number;
  const replLines = replace === "" ? [] : replace.split(eol);
  const next = [...dLines.slice(0, at), ...replLines, ...dLines.slice(at + sLines.length)];
  return { ok: true, doc: next.join(eol) };
}

/** 顺序应用全部补丁；任一失败则整体失败（原文不变）。 */
export function applyPatches(html: string, patches: Patch[]): ApplyResult {
  if (!patches.length) return { ok: false, failures: [{ index: 0, reason: "parse" }] };
  let doc = html;
  const failures: PatchFailure[] = [];
  patches.forEach((p, index) => {
    const r = applyOne(doc, p);
    if (r.ok) doc = r.doc;
    else failures.push({ index, reason: r.reason });
  });
  return failures.length ? { ok: false, failures } : { ok: true, html: doc, applied: patches.length };
}

export function describeFailures(failures: PatchFailure[]): string {
  return failures
    .map((f) => {
      const n = f.index + 1;
      if (f.reason === "parse") return "- 格式无法解析，没有找到完整的 SEARCH/REPLACE 修改块";
      if (f.reason === "ambiguous") return `- 第 ${n} 个块：SEARCH 内容在代码中出现了多次，请多包含几行使其唯一`;
      return `- 第 ${n} 个块：SEARCH 内容在代码中找不到`;
    })
    .join("\n");
}

/** 存库时 search/replace 各截断到 300 字符。 */
export function summarizePatches(patches: Patch[]): Patch[] {
  const cut = (s: string) => (s.length > 300 ? `${s.slice(0, 300)}…` : s);
  return patches.map((p) => ({ search: cut(p.search), replace: cut(p.replace) }));
}
