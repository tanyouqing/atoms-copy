import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * 服务端渲染与首次 hydrate 时为 false，之后为 true。
 * 用于依赖浏览器时区 / 当前时间的文本：服务器（容器多为 UTC）和浏览器算出的结果不同，直接渲染会触发 React #418。
 */
export function useMounted(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
