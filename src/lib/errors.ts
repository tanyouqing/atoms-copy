/** 错误码与中文文案（docs/06 §2）。客户端也会 import 这个文件，所以不放服务端依赖。 */
export const ERRORS = {
  BAD_REQUEST: { status: 400, retryable: false, message: "请求参数有误" },
  NOT_FOUND: { status: 404, retryable: false, message: "内容不存在或无权访问" },
  PROJECT_BUSY: { status: 409, retryable: false, message: "团队正在处理上一个需求，请稍候" },
  RATE_LIMITED: { status: 429, retryable: false, message: "今日生成次数已用完（每个访客每天 {n} 次），明天再来吧" },
  GLOBAL_LIMITED: { status: 429, retryable: false, message: "今日全站体验额度已用完，明天再来吧" },
  LLM_TIMEOUT: { status: 504, retryable: true, message: "模型响应超时，请重试" },
  LLM_ERROR: { status: 502, retryable: true, message: "模型服务暂时不可用，请重试" },
  LLM_BAD_OUTPUT: { status: 502, retryable: true, message: "模型输出格式不正确，请重试" },
  LLM_TRUNCATED: { status: 502, retryable: true, message: "生成内容过长被截断，请把需求拆小一些再试" },
  PATCH_FAILED: { status: 500, retryable: true, message: "修改未能应用，请换个说法再试" },
  INVALID_RECOVERY_CODE: { status: 400, retryable: false, message: "恢复码无效" },
  INTERNAL: { status: 500, retryable: true, message: "服务器开小差了，请重试" },
  // 内部码：用户主动停止，不发 error 事件
  ABORTED: { status: 499, retryable: false, message: "已停止" },
} as const;

export type ErrorCode = keyof typeof ERRORS;

function fill(template: string, params?: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(params?.[k] ?? `{${k}}`));
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  constructor(code: ErrorCode, params?: Record<string, string | number>, detail?: string) {
    super(detail ?? fill(ERRORS[code].message, params));
    this.code = code;
    this.status = ERRORS[code].status;
    this.retryable = ERRORS[code].retryable;
  }
}

export function notFoundError(): never {
  throw new AppError("NOT_FOUND");
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;
