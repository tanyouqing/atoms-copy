import type { MessageDTO, ProjectDetail, ProjectSummary, VersionFull } from "@/types/api";
import type { RuntimeError } from "@/types/runtime";

/** 客户端接口调用集中在这里（docs/11 §3）。 */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  } catch {
    throw new ApiError("NETWORK", "网络连接失败，请检查网络后重试", 0);
  }
  const body = (await res.json().catch(() => null)) as (T & { error?: { code: string; message: string } }) | null;
  if (!res.ok) throw new ApiError(body?.error?.code ?? "INTERNAL", body?.error?.message ?? "服务器开小差了，请重试", res.status);
  return body as T;
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export const api = {
  createProject: (prompt: string) => req<{ project: ProjectSummary }>("/api/projects", post({ prompt })),
  getProject: (id: string) => req<ProjectDetail>(`/api/projects/${id}`),
  updateProject: (id: string, patch: { title?: string; isPublic?: boolean }) => req<{ project: ProjectSummary }>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteProject: (id: string) => req<{ ok: true }>(`/api/projects/${id}`, { method: "DELETE" }),
  restoreVersion: (projectId: string, versionId: string) => req<{ currentVersion: VersionFull; message: MessageDTO | null }>(`/api/projects/${projectId}/restore`, post({ versionId, reason: "user" })),
  getVersion: (id: string) => req<{ version: VersionFull }>(`/api/versions/${id}`),
  reportStatus: (id: string, body: { status: "ok" | "error"; errors?: RuntimeError[]; qa?: { turnId: string; outcome: "pass" | "give_up"; round: number } }) =>
    req<{ ok: true; message: MessageDTO | null; currentVersion: VersionFull | null }>(`/api/versions/${id}/status`, post(body)),
  me: () => req<{ visitorId: string; recoveryCode: string }>("/api/me"),
  restoreVisitor: (code: string) => req<{ ok: true }>("/api/me/restore", post({ code })),
};
