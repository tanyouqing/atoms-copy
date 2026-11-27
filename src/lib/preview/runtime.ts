/**
 * 注入预览 iframe 的运行时脚本（docs/09 §4）。在生成代码之前执行：
 * - localStorage 垫片：opaque origin 下原生 localStorage 不可用，改为内存 + postMessage 回传父页面；
 * - 报错捕获：error / unhandledrejection / console.error → atoms:error；
 * - 就绪信号：load 后 1500ms 上报 atoms:ready；
 * - 拦截页面内导航，改为新窗口打开。
 *
 * 规则：源码里每条语句都必须以分号结尾，注释只能整行写 `//`，
 * 因为导出前会去掉注释并把换行替换为空格（注入后不能改变 HTML 行号）。
 */
const SOURCE = String.raw`
(function () {
  var A = window.__ATOMS__ || { channel: "", storage: {} };
  var collected = [];
  var seen = {};
  function send(msg) {
    msg.channel = A.channel;
    try { parent.postMessage(msg, "*"); } catch (e) {}
  }
  function report(err) {
    if (seen[err.message] || collected.length >= 20) return;
    seen[err.message] = 1;
    collected.push(err);
    send({ type: "atoms:error", error: err });
  }
  // ---- localStorage 垫片 ----
  var nativeOk = false;
  try { window.localStorage.getItem("__t"); nativeOk = true; } catch (e) { nativeOk = false; }
  function makeStore(initial, persist) {
    var data = {};
    var k0;
    for (k0 in initial) { if (Object.prototype.hasOwnProperty.call(initial, k0)) data[k0] = String(initial[k0]); }
    function post(op, key, value) { if (persist) send({ type: "atoms:storage", op: op, key: key, value: value }); }
    var store = {
      getItem: function (k) { k = String(k); return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem: function (k, v) { k = String(k); v = String(v); data[k] = v; post("set", k, v); },
      removeItem: function (k) { k = String(k); delete data[k]; post("remove", k); },
      clear: function () { data = {}; post("clear"); },
      key: function (i) { var ks = Object.keys(data); return i >= 0 && i < ks.length ? ks[i] : null; }
    };
    Object.defineProperty(store, "length", { get: function () { return Object.keys(data).length; } });
    return store;
  }
  if (!nativeOk) {
    var local = makeStore(A.storage || {}, true);
    var session = makeStore({}, false);
    try { Object.defineProperty(window, "localStorage", { value: local, configurable: true }); } catch (e) { window.__atomsLocal = local; }
    try { Object.defineProperty(window, "sessionStorage", { value: session, configurable: true }); } catch (e) {}
  }
  // ---- 报错捕获 ----
  window.addEventListener("error", function (e) {
    var t = e.target;
    if (t && t !== window && (t.src || t.href)) {
      report({ type: "error", message: "资源加载失败：" + (t.src || t.href) });
      return;
    }
    report({ type: "error", message: String(e.message || "Unknown error"), line: e.lineno, col: e.colno, stack: e.error && e.error.stack ? String(e.error.stack).slice(0, 1000) : undefined });
  }, true);
  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    report({ type: "unhandledrejection", message: String((r && r.message) || r), stack: r && r.stack ? String(r.stack).slice(0, 1000) : undefined });
  });
  var origError = console.error;
  console.error = function () {
    try { report({ type: "console", message: Array.prototype.map.call(arguments, String).join(" ").slice(0, 500) }); } catch (_) {}
    return origError.apply(console, arguments);
  };
  // ---- 就绪信号 ----
  window.addEventListener("load", function () {
    setTimeout(function () {
      var body = document.body;
      var elementCount = body ? body.querySelectorAll("*").length : 0;
      var textLength = body ? (body.innerText || "").trim().length : 0;
      var hasCanvas = !!document.querySelector("canvas");
      var blank = elementCount < 5 && textLength < 10 && !hasCanvas;
      send({ type: "atoms:ready", errors: collected, blank: blank, elementCount: elementCount });
    }, 1500);
  });
  // ---- 导航拦截 ----
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (href.charAt(0) === "#" || href.indexOf("javascript:") === 0 || a.hasAttribute("download")) return;
    e.preventDefault();
    window.open(a.href, "_blank", "noopener");
  }, true);
})();
`;

/** 去掉整行注释，把换行替换为空格。结果不含任何换行符。 */
export function minifyRuntime(src: string): string {
  return src
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "" && !l.startsWith("//"))
    .join(" ");
}

export const RUNTIME_SOURCE = minifyRuntime(SOURCE);
