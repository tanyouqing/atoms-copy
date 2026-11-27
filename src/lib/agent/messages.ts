import "server-only";
import { finishRunningMessages, insertMessage, toMessageDTO, updateMessage, type MessagePatch } from "@/lib/db/queries";
import type { Emit } from "@/lib/sse";
import type { MessageDTO, MessageRole } from "@/types/api";

/** 消息写库 + 同步发 SSE（message / message_update）。UI 卡片完全由这些消息驱动。 */
export function createMessenger(projectId: string, turnId: string, emit: Emit) {
  return {
    start(role: MessageRole, kind: string, content: string, opts: { meta?: unknown; versionId?: string | null } = {}): MessageDTO {
      const m = toMessageDTO(insertMessage({ projectId, turnId, role, kind, status: "running", content, meta: opts.meta, versionId: opts.versionId }));
      emit({ type: "message", message: m });
      return m;
    },
    /** 一次性插入已完成的消息（用户消息、系统消息）。 */
    add(role: MessageRole, kind: string, content: string, opts: { meta?: unknown; versionId?: string | null; status?: "done" | "error" } = {}): MessageDTO {
      const m = toMessageDTO(insertMessage({ projectId, turnId, role, kind, status: opts.status ?? "done", content, meta: opts.meta, versionId: opts.versionId }));
      emit({ type: "message", message: m });
      return m;
    },
    update(id: string, patch: MessagePatch): MessageDTO | null {
      const row = updateMessage(id, patch);
      if (!row) return null;
      const dto = toMessageDTO(row);
      emit({ type: "message_update", id, patch: { status: dto.status, content: dto.content, meta: dto.meta, versionId: dto.versionId, finishedAt: dto.finishedAt } });
      return dto;
    },
    /** 只发 SSE、不写库的临时进度（如"已写 3.2k 字符"）。 */
    progress(id: string, content: string) {
      emit({ type: "message_update", id, patch: { content } });
    },
    /** 把本轮所有 running 消息置为指定状态（停止 / 出错）。 */
    finishAll(status: "stopped" | "error", content?: string) {
      for (const m of finishRunningMessages(projectId, turnId, status)) {
        const row = content !== undefined ? updateMessage(m.id, { content }) : null;
        const dto = toMessageDTO(row ?? m);
        emit({ type: "message_update", id: m.id, patch: { status, content: dto.content, finishedAt: dto.finishedAt ?? Date.now() } });
      }
    },
  };
}

export type Messenger = ReturnType<typeof createMessenger>;

export const fmtK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
