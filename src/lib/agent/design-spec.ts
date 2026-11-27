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
