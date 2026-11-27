import "server-only";
import { findQaMessageForVersion, getVersion, inTransaction, lastOkVersion, setCurrentVersion, toMessageDTO, toVersionFull, updateMessage, updateVersionStatus, type VersionRow } from "@/lib/db/queries";
import type { MessageDTO, QaMeta, VersionFull } from "@/types/api";
import type { RuntimeError } from "@/types/runtime";

export interface QaResultInput {
  version: VersionRow;
  status: "ok" | "error";
  errors: RuntimeError[];
  qa?: { outcome: "pass" | "give_up"; round: number; phase?: QaMeta["phase"] };
}

export interface QaResult {
  message: MessageDTO | null;
  currentVersion: VersionFull | null;
}

/**
 * 写入 QA 结论（docs/06 POST /api/versions/:id/status）：
 * 更新版本状态；更新该版本的 qa_report 消息；give_up 时回退到最近 ok 版本。
 */
export function applyQaResult(input: QaResultInput): QaResult {
  return inTransaction(() => {
    const { version, qa } = input;
    updateVersionStatus(version.id, input.status, input.status === "error" ? input.errors : null);
    if (!qa) return { message: null, currentVersion: null };

    const msg = findQaMessageForVersion(version.id);
    const prevMeta = (msg?.metaJson ? (JSON.parse(msg.metaJson) as Partial<QaMeta>) : {}) ?? {};
    const phase = qa.phase ?? prevMeta.phase ?? "runtime";
    let content: string;
    let meta: QaMeta;
    let currentVersion: VersionFull | null = null;

    if (qa.outcome === "pass") {
      content = qa.round > 0 ? "已修复，检查通过" : "检查通过";
      meta = { phase, errors: [], round: qa.round, outcome: qa.round > 0 ? "fixed" : "pass" };
    } else {
      const fallback = lastOkVersion(version.projectId, version.id);
      if (fallback) {
        setCurrentVersion(version.projectId, fallback.id);
        currentVersion = toVersionFull(getVersion(fallback.id) ?? fallback);
        content = `修复失败，已回退到 v${fallback.seq}`;
        meta = { phase, errors: input.errors, round: qa.round, outcome: "rolled_back" };
      } else {
        content = "未能自动修复，可以重新生成或换个说法";
        meta = { phase, errors: input.errors, round: qa.round, outcome: "failed" };
      }
    }
    const updated = msg ? updateMessage(msg.id, { status: qa.outcome === "pass" ? "done" : "error", content, meta }) : null;
    return { message: updated ? toMessageDTO(updated) : null, currentVersion };
  });
}
