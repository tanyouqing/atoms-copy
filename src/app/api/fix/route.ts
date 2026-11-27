import { z } from "zod";
import { createMessenger } from "@/lib/agent/messages";
import { guardTurn, runFix } from "@/lib/agent/pipeline";
import { RuntimeErrorSchema } from "@/lib/agent/schemas";
import { findQaMessageForVersion, getProjectForVisitor, getVersion, insertMessage, newId, toMessageDTO, updateVersionStatus } from "@/lib/db/queries";
import { AppError, notFoundError } from "@/lib/errors";
import { readJson, withApi } from "@/lib/http";
import { acquireLock, releaseLock } from "@/lib/locks";
import { FIX_BUDGET } from "@/lib/qa-limits";
import { checkAndRecordUsage } from "@/lib/rate-limit";
import { sseResponse } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Body = z.object({
  projectId: z.string().min(1),
  versionId: z.string().min(1),
  turnId: z.string().min(1).nullable().optional(),
  errors: z.array(RuntimeErrorSchema).min(1).max(10),
  round: z.number().int().min(1).max(FIX_BUDGET),
  manual: z.boolean().optional(),
});

export const POST = withApi(async (req, { visitorId, ip }) => {
  const body = Body.parse(await readJson(req));
  const project = getProjectForVisitor(body.projectId, visitorId) ?? notFoundError();
  const version = getVersion(body.versionId);
  if (!version || version.projectId !== project.id) notFoundError();
  if (project.currentVersionId !== version.id) throw new AppError("BAD_REQUEST", undefined, "只能修复当前版本");
  const manual = !!body.manual;
  if (!manual && !body.turnId) throw new AppError("BAD_REQUEST", undefined, "缺少 turnId");
  const lock = acquireLock(project.id);
  if (!lock) throw new AppError("PROJECT_BUSY");
  try {
    checkAndRecordUsage({ visitorId, ip, kind: "fix" });
  } catch (e) {
    releaseLock(project.id, lock);
    throw e;
  }

  const signal = AbortSignal.any([req.signal, lock.signal]);
  const turnId = manual ? newId() : (body.turnId as string);
  const round = manual ? 1 : body.round;

  return sseResponse(async (emit) => {
    try {
      const msg = createMessenger(project.id, turnId, emit);
      const userMessage = manual
        ? toMessageDTO(insertMessage({ projectId: project.id, turnId, role: "user", kind: "text", status: "done", content: "请修复预览中的报错" }))
        : null;
      emit({ type: "turn", turnId, userMessage });
      updateVersionStatus(version.id, "error", body.errors);
      const qaMsg = manual ? null : findQaMessageForVersion(version.id);
      await guardTurn({ turnId, signal, emit, msg, systemErrorMessage: manual, logCtx: { route: "fix", projectId: project.id, round } }, () =>
        runFix({ project, version, turnId, errors: body.errors, round, signal, manual }, emit, msg, qaMsg?.id ?? null),
      );
    } finally {
      releaseLock(project.id, lock);
    }
  });
});
