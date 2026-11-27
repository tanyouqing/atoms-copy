import { z } from "zod";
import { createMessenger } from "@/lib/agent/messages";
import { guardTurn, runTurn } from "@/lib/agent/pipeline";
import { getProjectForVisitor, getVersion, hasUserMessage, newId, toMessageDTO, insertMessage } from "@/lib/db/queries";
import { AppError, notFoundError } from "@/lib/errors";
import { PROMPT_MAX } from "@/lib/examples";
import { readJson, withApi } from "@/lib/http";
import { acquireLock, releaseLock } from "@/lib/locks";
import { checkAndRecordUsage } from "@/lib/rate-limit";
import { sseResponse } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Body = z.object({
  projectId: z.string().min(1),
  prompt: z.string().trim().min(1, "请输入修改要求").max(PROMPT_MAX, "需求描述请控制在 2000 字以内"),
  isInitial: z.boolean().optional(),
});

export const POST = withApi(async (req, { visitorId, ip }) => {
  const body = Body.parse(await readJson(req));
  const project = getProjectForVisitor(body.projectId, visitorId) ?? notFoundError();
  const lock = acquireLock(project.id);
  if (!lock) throw new AppError("PROJECT_BUSY");
  try {
    checkAndRecordUsage({ visitorId, ip, kind: "generate" });
  } catch (e) {
    releaseLock(project.id, lock);
    throw e;
  }

  const current = project.currentVersionId ? getVersion(project.currentVersionId) : null;
  // isInitial 只在项目还没有任何消息和版本时生效（防止刷新重复生成）
  const isFirstTurn = !current && !hasUserMessage(project.id);
  const signal = AbortSignal.any([req.signal, lock.signal]);
  const turnId = newId();

  return sseResponse(async (emit) => {
    try {
      const msg = createMessenger(project.id, turnId, emit);
      const userMessage = toMessageDTO(insertMessage({ projectId: project.id, turnId, role: "user", kind: "text", status: "done", content: body.prompt }));
      emit({ type: "turn", turnId, userMessage });
      await guardTurn({ turnId, signal, emit, msg, systemErrorMessage: true, logCtx: { route: "generate", projectId: project.id } }, () =>
        runTurn({ project, current, prompt: body.prompt, turnId, signal, isFirstTurn }, emit, msg),
      );
    } finally {
      releaseLock(project.id, lock);
    }
  });
});
