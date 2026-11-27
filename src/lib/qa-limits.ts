/** 测试员（Iris）的检查与修复上限，客户端和服务端共用（docs/07 §10–§11）。 */

/** 每个 turn 的修复轮数上限（服务端静态修复和客户端运行时修复共享）。 */
export const FIX_BUDGET = 4;

/** 预览等待 atoms:ready 的最长时间。 */
export const PREVIEW_READY_TIMEOUT_MS = 25_000;
export const PREVIEW_READY_TIMEOUT_S = PREVIEW_READY_TIMEOUT_MS / 1000;
