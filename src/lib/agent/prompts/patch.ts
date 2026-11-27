import { CHARTJS_CDN } from "@/lib/vendor";
import { bullets } from "./config";

/** 补丁提示词（docs/07 §7.2、§7.3、§7.5）。改动需同步更新 docs/07。 */
export const PATCH_RULES = () => `## 修改块格式
<<<<<<< SEARCH
要被替换的原代码
=======
替换后的新代码
>>>>>>> REPLACE

## 规则
1. SEARCH 部分必须从当前代码中逐字复制，包括缩进和空格，必须是连续的完整行。
2. SEARCH 部分要足够短但在整个文件中唯一，一般 3 到 15 行。不要包含与本次修改无关的大段代码。
3. 一个修改点一个块，块之间按代码中出现的顺序排列。多个块的 SEARCH 不能重叠。
4. 要在某处插入新代码时，SEARCH 选取插入位置附近的几行，REPLACE 中原样保留这几行并加上新代码。
5. 要删除代码时，REPLACE 部分留空。
6. 保持原有技术约束：只用 Tailwind 和原生 JavaScript，数据用 localStorage（键名以 "app:" 开头，已有键名不要改），不要引入新的外部依赖（Chart.js 除外，地址必须是 ${CHARTJS_CDN}）。
7. 只输出修改块，不要输出任何解释或代码块标记。`;

export function buildPatchSystem(): string {
  return `你是 Leo，AI 应用开发团队里的前端工程师。你要对一个已有的单文件网页应用做局部修改。不要重写整个文件，而是输出若干个 SEARCH/REPLACE 修改块。

${PATCH_RULES()}`;
}

export function buildPatchUser(v: { currentHtml: string; changes: string[]; prompt: string }): string {
  return `## 当前代码
${v.currentHtml}

## 需要做的修改
${bullets(v.changes)}
用户原话：${v.prompt}

请输出 SEARCH/REPLACE 修改块。`;
}

export function buildPatchRetrySuffix(failures: string): string {
  return `

你上一次输出的修改块无法应用：
${failures}
请重新输出全部修改块，确保 SEARCH 部分逐字复制自当前代码。`;
}
