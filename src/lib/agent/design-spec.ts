import type { StylePick } from "@/lib/agent/style";
import { PIXEL_FONT_CSS } from "@/lib/vendor";

/** 自由生成提示词中的设计规范与组件片段，原文见 docs/08 §2。 */
export const DESIGN_SPEC = `- 整体风格：简洁现代，浅色背景 bg-slate-50，内容放在白色卡片 bg-white 中，卡片 rounded-2xl border border-slate-200 shadow-sm p-5 或 p-6。
- 主色：用指定主色色系。主按钮 bg-{c}-600 hover:bg-{c}-700 text-white；选中态和标签 bg-{c}-50 text-{c}-700；强调文字 text-{c}-600。其余用 slate 灰阶。
- 字体：默认系统字体，不引入网络字体。标题 text-2xl font-bold text-slate-900；小标题 text-lg font-semibold；正文 text-sm text-slate-600；辅助文字 text-xs text-slate-400。
- 间距：页面 px-4 py-8（手机）/ md:px-8；区块之间 space-y-6；表单项之间 space-y-4。
- 圆角：卡片 rounded-2xl，按钮和输入框 rounded-xl，标签 rounded-full。
- 输入框：w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-{c}-500。
- 页面顶部有一个标题区：emoji 图标 + 应用名 + 一行副标题。
- 列表为空时显示空状态：居中 emoji + 一句引导文案 + 主按钮。
- 交互反馈：操作成功后在页面底部中间显示 2 秒的提示条（toast），删除操作需要确认（用页面内弹窗，不用 confirm）。
- 动效：只用 transition 和 hover 效果，不做复杂动画。
- 数字统计用醒目的大号数字 text-3xl font-bold。`;

export const SNIPPETS = `<!-- 主按钮 -->
<button class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition">➕ 添加</button>
<!-- 次按钮 -->
<button class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">取消</button>
<!-- 卡片 -->
<section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"> … </section>
<!-- 表单项 -->
<label class="block space-y-1"><span class="text-sm font-medium text-slate-700">标题</span>
  <input class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></label>
<!-- 统计卡 -->
<div class="rounded-2xl border border-slate-200 bg-white p-5"><div class="text-xs text-slate-400">本月支出</div><div class="mt-1 text-3xl font-bold text-slate-900">¥1,280</div></div>
<!-- 标签 -->
<span class="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">进行中</span>
<!-- 表格 -->
<div class="overflow-x-auto"><table class="w-full text-sm"><thead class="text-left text-xs text-slate-400"><tr><th class="py-2">名称</th></tr></thead>
<tbody class="divide-y divide-slate-100"><tr><td class="py-2">…</td></tr></tbody></table></div>
<!-- 弹窗 -->
<div id="modal" class="fixed inset-0 z-50 hidden items-center justify-center bg-black/40 p-4">
  <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"> … </div></div>
<!-- 空状态 -->
<div class="py-12 text-center"><div class="text-4xl">📭</div><p class="mt-2 text-sm text-slate-500">还没有内容，点击上方按钮添加</p></div>
<!-- toast -->
<div id="toast" class="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white opacity-0 transition"></div>
<script>
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.style.opacity='1';clearTimeout(t._h);t._h=setTimeout(()=>t.style.opacity='0',2000);}
function load(key,fallback){try{const v=localStorage.getItem(key);return v?JSON.parse(v):fallback;}catch(e){return fallback;}}
function save(key,val){try{localStorage.setItem(key,JSON.stringify(val));}catch(e){}}
</script>`;

/**
 * 自由生成时的风格说明（docs/08 §2.3），拼在用户提示词里，覆盖上面设计规范中与之冲突的部分。
 * 和模板主题用同一套颜色与形状，让自由生成的应用和模板应用看起来是一个系列。
 */
export function styleSpec(pick: StylePick): string {
  const font = pick.custom?.font;
  const pixelFont = `像素字体：在 <head> 里加 <link rel="stylesheet" href="${PIXEL_FONT_CSS}">（这是唯一允许的外部样式表），body 设置 font-family: "Fusion Pixel 12px Proportional Simplified Chinese", monospace；正文 12px、小标题 18px、大标题 24px（12 的整数倍或 1.5 倍最清晰），不要用加粗。`;
  if (pick.custom) {
    const c = pick.custom;
    const shape = { paper: "圆角 rounded-2xl、柔和阴影", pixel: "无圆角（rounded-none）、2px 实线描边、4px 4px 0 的硬投影、按钮按下时位移 2px", bright: "大圆角 rounded-3xl、按钮用 rounded-full、卡片无边框只用柔和大阴影" }[c.base];
    const fontLine = font === "pixel" ? pixelFont : font === "serif" ? "标题用衬线字体 Georgia, \"Songti SC\", serif。" : font === "mono" ? "字体用等宽 ui-monospace, Menlo, monospace。" : "字体用系统无衬线字体。";
    return `- 风格「${c.name}」：页面背景 ${c.bg}，卡片背景 ${c.surface}，主要文字 ${c.text}${c.accent ? `，强调色（主按钮、选中态、进度条）${c.accent}` : ""}。用 Tailwind 任意值写颜色，例如 bg-[${c.bg}]，次要文字用文字色加透明度（如 text-[${c.text}]/60）。
- 形状：${shape}。
- ${fontLine}`;
  }
  if (pick.style === "pixel")
    return `- 像素风：背景 #eef1f6 上加 24px 的浅色网格线（background-image 两条 linear-gradient），卡片白色、无圆角、2px 实线深色描边（#181c28）、4px 4px 0 的硬投影；按钮同样描边加 3px 硬投影，按下时 translate(2px,2px) 并缩小投影；标签、进度条也都是直角。
- ${pixelFont}
- 动效用 steps() 分步过渡，尊重 prefers-reduced-motion。`;
  if (pick.style === "bright")
    return `- 明亮卡片：背景 #f5f7fb，加两团主色浅色径向渐变光晕（radial-gradient，透明度低）；内容放在白色卡片里，卡片 rounded-3xl、无边框、阴影 0 10px 30px -12px rgb(15 23 42/.16)。
- 主按钮 rounded-full，主色 500→700 的线性渐变背景，带同色柔和投影；分段切换和标签也用 rounded-full。
- 字体用系统无衬线，标题 font-bold tracking-tight；灰阶用 Tailwind 原生 slate。`;
  return `- 暖纸墨色：背景 #f6f3ec（暖白纸张），卡片 #fffdf9、rounded-2xl、1px 暖灰描边 #e4ded2、柔和阴影；文字用暖墨色 #1f1c17 / #5f584c / #7b7364，不要用冷灰。
- 标题用衬线字体 Georgia, "Songti SC", serif，正文用系统无衬线字体。`;
}
