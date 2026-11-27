import type { PmOutput } from "@/lib/agent/schemas";
import type { RuntimeError } from "./runtime";

/** 接口 DTO（docs/06 §3）。 */
export type VersionSource = "template" | "config_edit" | "free" | "patch" | "fix" | "manual";
export type VersionStatus = "pending" | "ok" | "error";
export type MessageRole = "user" | "pm" | "engineer" | "qa" | "system";
export type MessageStatus = "running" | "done" | "error" | "stopped";

export interface ProjectSummary {
  id: string;
  title: string;
  templateId: string | null;
  currentSeq: number | null;
  isPublic: boolean;
  updatedAt: number;
}

export interface VersionSummary {
  id: string;
  seq: number;
  label: string;
  source: VersionSource;
  templateId: string | null;
  status: VersionStatus;
  createdAt: number;
}

export interface VersionFull extends VersionSummary {
  html: string;
  config: unknown | null;
  plan: PmOutput | null;
  errors: RuntimeError[] | null;
}

export interface MessageDTO {
  id: string;
  turnId: string;
  role: MessageRole;
  kind: string;
  status: MessageStatus;
  content: string;
  meta: unknown | null;
  versionId: string | null;
  startedAt: number;
  finishedAt: number | null;
  createdAt: number;
}

export interface ProjectDetail {
  project: ProjectSummary & { initialPrompt: string; currentVersionId: string | null };
  messages: MessageDTO[];
  versions: VersionSummary[];
  currentVersion: VersionFull | null;
  busy: boolean;
}

/** qa_report 消息的 meta（docs/05 §2.4）。 */
export interface QaMeta {
  phase: "static" | "runtime";
  errors: RuntimeError[];
  round: number;
  outcome: "pass" | "fixing" | "fixed" | "rolled_back" | "failed";
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
