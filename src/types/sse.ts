import type { MessageDTO, ProjectSummary, VersionFull } from "./api";

/** SSE 事件（docs/06 §5.1）。 */
export type SseEvent =
  | { type: "turn"; turnId: string; userMessage: MessageDTO | null }
  | { type: "message"; message: MessageDTO }
  | { type: "message_update"; id: string; patch: Partial<MessageDTO> }
  | { type: "code_delta"; text: string }
  | { type: "version"; version: VersionFull; message: MessageDTO }
  | { type: "project"; project: ProjectSummary }
  | { type: "done"; turnId: string; versionId: string | null; fixRoundsUsed: number }
  | { type: "error"; code: string; message: string; retryable: boolean };

export type SseEventType = SseEvent["type"];
