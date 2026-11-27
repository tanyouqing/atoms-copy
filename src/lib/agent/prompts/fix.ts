import type { RuntimeError } from "@/types/runtime";
import { PATCH_RULES } from "./patch";

/** 修复提示词（docs/07 §8）。改动需同步更新 docs/07。 */
export function buildFixSystem(): string {
  return `你是 Leo，AI 应用开发团队里的前端工程师。测试员 Iris 在运行应用时发现了报错，你需要用最小的修改修复它们。不要重写整个文件，而是输出若干个 SEARCH/REPLACE 修改块。修复时不要删除功能，不要改变界面设计。

${PATCH_RULES()}`;
}

/** 去重（按 message），最多 5 条。 */
export function dedupeErrors(errors: RuntimeError[]): RuntimeError[] {
  const seen = new Set<string>();
  return errors.filter((e) => (seen.has(e.message) ? false : (seen.add(e.message), true))).slice(0, 5);
}

export function formatErrors(errors: RuntimeError[]): string {
  return dedupeErrors(errors)
    .map((e) => {
      const pos = e.line ? `（第 ${e.line} 行${e.col ? `，第 ${e.col} 列` : ""}）` : "";
      return `- [${e.type}] ${e.message}${pos}`;
    })
    .join("\n");
}

/** 报错行 ±8 行的带行号片段，重叠区间合并。 */
export function buildExcerpts(html: string, errors: RuntimeError[]): string {
  const lines = html.split("\n");
  const ranges = dedupeErrors(errors)
    .filter((e) => e.line && e.line > 0)
    .map((e) => [Math.max(1, (e.line as number) - 8), Math.min(lines.length, (e.line as number) + 8)] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  if (!ranges.length) return "（无行号信息）";
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  const width = String(lines.length).length;
  return merged
    .map(([a, b]) =>
      lines
        .slice(a - 1, b)
        .map((l, i) => `  ${String(a + i).padStart(width)} | ${l}`)
        .join("\n"),
    )
    .join("\n  ...\n");
}

export function buildFixUser(v: { currentHtml: string; errors: RuntimeError[] }): string {
  return `## 当前代码
${v.currentHtml}

## 测试员发现的问题
${formatErrors(v.errors)}

## 报错位置附近的代码（带行号，仅供定位，SEARCH 中不要包含行号）
${buildExcerpts(v.currentHtml, v.errors)}

请输出 SEARCH/REPLACE 修改块来修复以上问题。`;
}
