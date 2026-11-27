import "server-only";

/** 项目级内存锁（docs/04 §5）。单进程部署，Map 足够。 */
const g = globalThis as unknown as { __atomsLocks?: Map<string, AbortController> };
const locks = (g.__atomsLocks ??= new Map<string, AbortController>());

/** 加锁成功返回 AbortController；已被占用返回 null。 */
export function acquireLock(projectId: string): AbortController | null {
  if (locks.has(projectId)) return null;
  const ac = new AbortController();
  locks.set(projectId, ac);
  return ac;
}

export function releaseLock(projectId: string, ac: AbortController) {
  if (locks.get(projectId) === ac) locks.delete(projectId);
}

export function isLocked(projectId: string): boolean {
  return locks.has(projectId);
}

/** 删除项目前中止正在进行的生成。 */
export function abortProject(projectId: string) {
  const ac = locks.get(projectId);
  if (ac) {
    ac.abort();
    locks.delete(projectId);
  }
}
