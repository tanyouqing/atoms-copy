# 09 · 预览沙箱与运行时协议

## 1. 三种呈现形式

| 场景 | HTML 来源 | 注入 runtime | 替换 vendor 地址 | 存储 |
|---|---|---|---|---|
| 工作台预览 | 当前查看的版本 `html` | 是 | 是（CDN → `/vendor/*`） | 父页面 localStorage `atoms:data:<projectId>` |
| 分享页 | 当前或 `?v=` 指定版本 | 是 | 是 | 父页面 localStorage `atoms:share:<projectId>` |
| 下载文件 | 版本 `html` 原样 | 否 | 否（保留 CDN） | 浏览器原生 localStorage |

## 2. iframe 属性（`src/components/workspace/PreviewFrame.tsx`）

```tsx
<iframe
  key={renderKey}                     // 版本切换、刷新、重置数据时变化，强制重新挂载
  srcDoc={srcdoc}
  sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads"
  referrerPolicy="no-referrer"
  title="应用预览"
  className="h-full w-full border-0 bg-white"
/>
```

`allow-downloads` 用于模板中的"导出 CSV"（Blob + a[download]），不扩大对主站的访问权限。**禁止**添加 `allow-same-origin`（否则生成代码可读取主站 cookie 与存储）。`PreviewFrame` 同时被分享页复用。

## 3. 组装 srcdoc（`src/lib/preview/build-srcdoc.ts`）

```ts
export function buildSrcdoc(opts: {
  html: string;
  channel: string;                       // 每次渲染随机生成：crypto.randomUUID()
  storage: Record<string, string>;       // 初始存储快照
}): string;
```

步骤：
1. **替换 vendor 地址**：按 `vendor.ts` 的映射，把 HTML 中出现的 CDN 地址字符串替换为 `window.location.origin + 本地路径`（srcdoc 文档的相对地址解析不可靠，所以用绝对地址）。只做字符串替换，不改变行数。
2. **生成 runtime 脚本**：`<script>` + `RUNTIME_SOURCE`（见 §4）+ 前置一句 `window.__ATOMS__={channel:"…",storage:{…}};` + `</script>`。整段**不得包含换行符**：`RUNTIME_SOURCE` 在 `runtime.ts` 中写成普通多行代码，导出前用简单压缩（去掉注释、把换行替换为空格；runtime 代码中所有语句都必须以分号结尾，不依赖自动分号插入）。快照用 `JSON.stringify` 并把 `<` 转义为 `<`。
3. **插入位置**：紧跟在 `<head>` 开始标签（`/<head[^>]*>/i` 的第一个匹配）之后，与它在同一行。没有 `<head>` 时插在 `<html…>` 之后；都没有则放在最前面（此时行号会偏移 0 行，因为同样不加换行）。
4. 因为没有新增换行，iframe 中报错的行号等于存储 HTML 的行号，修复提示词可以直接用。

## 4. Runtime 脚本（`src/lib/preview/runtime.ts`）

运行时脚本在生成代码之前执行，职责：

### 4.1 localStorage 垫片

沙箱无 same-origin 时，iframe 的 origin 是 opaque，访问 `window.localStorage` 会抛 `SecurityError`。

```js
(function(){
  var A = window.__ATOMS__;
  var native = null;
  try { native = window.localStorage; native.getItem("__t"); } catch (e) { native = null; }
  if (native) return;                              // 极少数情况下可用，则不替换
  var data = Object.assign({}, A.storage);
  function post(op, key, value){ parent.postMessage({ channel: A.channel, type: "atoms:storage", op: op, key: key, value: value }, "*"); }
  var shim = {
    getItem: function(k){ k = String(k); return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function(k, v){ k = String(k); v = String(v); data[k] = v; post("set", k, v); },
    removeItem: function(k){ k = String(k); delete data[k]; post("remove", k); },
    clear: function(){ data = {}; post("clear"); },
    key: function(i){ return Object.keys(data)[i] || null; },
    get length(){ return Object.keys(data).length; }
  };
  try { Object.defineProperty(window, "localStorage", { value: shim, configurable: true }); } catch (e) {}
  try { Object.defineProperty(window, "sessionStorage", { value: Object.assign({}, shim, { setItem: function(k,v){ data["__s:"+k]=String(v); } }), configurable: true }); } catch (e) {}
})();
```

（sessionStorage 只做内存实现、不回传；上面只是示意，实现时 sessionStorage 用独立的内存对象。）

E2E 测试必须覆盖：生成的待办应用添加一条 → 刷新工作台 → 数据仍在。若 `Object.defineProperty` 在某浏览器上失败，回退方案是在 runtime 中定义全局 `var localStorage = shim`（函数作用域外的 var 声明会遮蔽 window 属性的读取）——实现时在 Chrome、Firefox、Safari 各验证一次，记录在 README"已知问题"中。

### 4.2 报错捕获

```js
window.addEventListener("error", function(e){
  if (e.target && e.target !== window && (e.target.src || e.target.href)) {
    report({ type: "error", message: "资源加载失败：" + (e.target.src || e.target.href) });
    return;
  }
  report({ type: "error", message: String(e.message || "Unknown error"), line: e.lineno, col: e.colno, stack: e.error && e.error.stack ? String(e.error.stack).slice(0, 1000) : undefined });
}, true);
window.addEventListener("unhandledrejection", function(e){
  var r = e.reason; report({ type: "unhandledrejection", message: String(r && r.message || r), stack: r && r.stack ? String(r.stack).slice(0, 1000) : undefined });
});
var origError = console.error;
console.error = function(){ try { report({ type: "console", message: Array.prototype.map.call(arguments, String).join(" ").slice(0, 500) }); } catch (_) {} return origError.apply(console, arguments); };
```

- `report()`：去重（同 message 只报一次），最多累计 20 条；立即 `postMessage({ channel, type: "atoms:error", error })`，同时放入 `collected` 数组。

### 4.3 就绪信号

```js
window.addEventListener("load", function(){
  setTimeout(function(){
    var body = document.body;
    var elementCount = body ? body.querySelectorAll("*").length : 0;
    var textLength = body ? (body.innerText || "").trim().length : 0;
    var hasCanvas = !!document.querySelector("canvas");
    var blank = elementCount < 5 && textLength < 10 && !hasCanvas;
    parent.postMessage({ channel: A.channel, type: "atoms:ready", errors: collected, blank: blank, elementCount: elementCount }, "*");
  }, 1500);
});
```

1500ms 给 Tailwind Browser 编译样式和应用初始化留出时间。

### 4.4 其他

- 拦截页面内导航：点击 `<a href>` 且 href 不以 `#` 开头、也不是 `javascript:` 时，阻止默认行为，改为 `window.open(href, "_blank", "noopener")`（防止 iframe 内跳走后预览丢失）。
- 不拦截 `alert/confirm/prompt`（已开 `allow-modals`）。

## 5. 父页面桥接（`src/hooks/usePreviewBridge.ts`）

```ts
usePreviewBridge({
  iframeRef, channel, storageKey,              // storageKey: "atoms:data:<projectId>" 或 "atoms:share:<projectId>"
  onError: (e: RuntimeError) => void,
  onReady: (r: { errors: RuntimeError[]; blank: boolean }) => void,
});
```

- 监听 `window.message`：只处理 `event.source === iframeRef.current?.contentWindow && event.data?.channel === channel` 的消息。
- `atoms:storage`：更新父页面 `localStorage[storageKey]`（值为 JSON 对象 `{ [key]: string }`），`set` / `remove` / `clear` 分别处理。父页面 localStorage 读写同样 try/catch。
- 初始快照：渲染 iframe 前读取 `localStorage[storageKey]` 解析为对象，传给 `buildSrcdoc`。
- "重置应用数据"：删除 `localStorage[storageKey]` 后变更 `renderKey` 重新挂载。
- **同一项目的所有版本共享一份应用数据**（与真实应用升级行为一致）。查看旧版本时也使用同一份数据；如果旧版本的数据结构不兼容，用户可点"重置应用数据"。

## 6. 报错到 UI 的映射

| 时机 | 处理 |
|---|---|
| 自动 QA 进行中（`useAutoFix.phase` 为 checking） | 报错进入 QA 收集，不弹错误条 |
| QA 结束后（用户自由操作时）出现新报错 | 预览底部错误条"应用出现了 N 个错误 [查看] [让测试员修复]"；"让测试员修复"调用 `/api/fix`（`manual: true`） |
| 查看旧版本时报错 | 只显示错误条，不提供修复按钮 |
| 分享页 | 忽略报错 |
