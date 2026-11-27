import "server-only";
import { getProjectById, getVersion, type ProjectRow, type VersionRow } from "@/lib/db/queries";
import { notFoundError } from "@/lib/errors";

/** 版本读取权限：所有者可读；项目公开时任何人可读。否则 404。 */
export function readableVersion(id: string, visitorId: string): { version: VersionRow; project: ProjectRow } {
  const version = getVersion(id) ?? notFoundError();
  const project = getProjectById(version.projectId) ?? notFoundError();
  if (project.visitorId !== visitorId && !project.isPublic) notFoundError();
  return { version, project };
}
