/** 静态检查与预览 runtime 上报的错误（docs/07 §9、docs/09 §4.2）。 */
export interface RuntimeError {
  type: "static" | "error" | "unhandledrejection" | "console";
  message: string;
  line?: number;
  col?: number;
  stack?: string;
}
