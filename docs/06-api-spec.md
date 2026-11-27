# 06 · 接口规范

## 1. 通用约定

- 全部接口在 `/api/*`，JSON 请求和响应（SSE 接口除外），字段名 camelCase。
- 身份：cookie `atoms_vid`（由 middleware 保证存在）。Route Handler 通过 `getVisitorId(req)` 读取：优先请求头 `x-visitor-id`（middleware 注入），其次 cookie。
- 入参用 zod 校验，失败返回 400 `BAD_REQUEST`，`message` 中带第一条校验错误。
- 资源不存在或不属于当前访客：404 `NOT_FOUND`。
- 时间字段：毫秒时间戳（number）。
- 所有 Route Handler 设置 `export const runtime = "nodejs"`；SSE 与需要读写库的接口设置 `export const dynamic = "force-dynamic"`。

## 2. 错误格式与错误码

非 SSE 接口出错：

```json
{ "error": { "code": "RATE_LIMITED", "message": "今日生成次数已用完（每个访客每天 40 次），明天再来吧" } }
```

SSE 接口出错：发送 `event: error`（见 §5），然后结束流。

错误码表（`src/lib/errors.ts`，`message` 为默认中文文案，可带参数）：

| code | HTTP | retryable | 默认文案 |
|---|---|---|---|
| `BAD_REQUEST` | 400 | 否 | 请求参数有误 |
| `NOT_FOUND` | 404 | 否 | 内容不存在或无权访问 |
| `PROJECT_BUSY` | 409 | 否 | 团队正在处理上一个需求，请稍候 |
| `RATE_LIMITED` | 429 | 否 | 今日生成次数已用完（每个访客每天 {n} 次），明天再来吧 |
| `GLOBAL_LIMITED` | 429 | 否 | 今日全站体验额度已用完，明天再来吧 |
| `LLM_TIMEOUT` | 504 | 是 | 模型响应超时，请重试 |
| `LLM_ERROR` | 502 | 是 | 模型服务暂时不可用，请重试 |
| `LLM_BAD_OUTPUT` | 502 | 是 | 模型输出格式不正确，请重试 |
| `LLM_TRUNCATED` | 502 | 是 | 生成内容过长被截断，请把需求拆小一些再试 |
| `PATCH_FAILED` | 500 | 是 | 修改未能应用，请换个说法再试 |
| `INVALID_RECOVERY_CODE` | 400 | 否 | 恢复码无效 |
| `INTERNAL` | 500 | 是 | 服务器开小差了，请重试 |

## 3. 共享类型（`src/types/api.ts`）

```ts
type ProjectSummary = {
  id: string; title: string; templateId: string | null;
  currentSeq: number | null; isPublic: boolean; updatedAt: number;
};

type VersionSummary = {
  id: string; seq: number; label: string;
  source: "template" | "config_edit" | "free" | "patch" | "fix" | "manual";
  templateId: string | null; status: "pending" | "ok" | "error"; createdAt: number;
};

type VersionFull = VersionSummary & {
  html: string; config: unknown | null; plan: PmOutput | null; errors: RuntimeError[] | null;
};

type MessageDTO = {
  id: string; turnId: string; role: "user" | "pm" | "engineer" | "qa" | "system";
  kind: string; status: "running" | "done" | "error" | "stopped";
  content: string; meta: unknown | null; versionId: string | null;
  startedAt: number; finishedAt: number | null; createdAt: number;
};

type ProjectDetail = {
  project: ProjectSummary & { initialPrompt: string; currentVersionId: string | null };
  messages: MessageDTO[];
  versions: VersionSummary[];        // seq 倒序
  currentVersion: VersionFull | null;
  busy: boolean;                     // 项目锁是否被占用
};
```

## 4. REST 接口

### `GET /api/health`
`200 { ok: true, db: true, model: "deepseek-flash", mock: false }`。不需要身份。

### `GET /api/me`
`200 { visitorId: string, recoveryCode: string }`。`recoveryCode` 即 `visitorId`。

### `POST /api/me/restore`
入参 `{ code: string }`（21 位，`/^[A-Za-z0-9_-]{21}$/`）。visitors 表中不存在 → 400 `INVALID_RECOVERY_CODE`。存在 → 重写 cookie 为该值，`200 { ok: true }`。

### `GET /api/projects`
`200 { projects: ProjectSummary[] }`，当前访客的项目，按 `updatedAt` 倒序。

### `POST /api/projects`
入参 `{ prompt: string }`（trim 后 1–2000 字）。创建项目（title = "新应用"），不调用模型、不计限流。
`201 { project: ProjectSummary }`。前端随后跳转 `/p/{id}?start=1`。

### `GET /api/projects/:id`
`200 ProjectDetail`。

### `PATCH /api/projects/:id`
入参 `{ title?: string (1–40), isPublic?: boolean }`，至少一个。改 title 时置 `title_locked = 1`。`200 { project: ProjectSummary }`。

### `DELETE /api/projects/:id`
级联删除版本和消息。生成中（锁被占用）先 abort 再删除。`200 { ok: true }`。

### `POST /api/projects/:id/restore`
入参 `{ versionId: string, reason?: "user" | "auto_rollback" }`。版本必须属于该项目。设置为当前版本，插入 system `notice` 消息（`user`："已恢复到 v{seq}"；`auto_rollback`：不插入 notice，由 QA 消息说明）。
`200 { currentVersion: VersionFull, message: MessageDTO | null }`。

### `GET /api/versions/:id`
`200 { version: VersionFull }`。所有者可读；项目公开时任何人可读。

### `POST /api/versions/:id/status`
仅所有者。入参：

```ts
{
  status: "ok" | "error";
  errors?: RuntimeError[];          // status=error 时必填，最多 10 条
  qa?: {                            // 客户端 QA 结论，用于写 qa_report 消息
    turnId: string;
    outcome: "pass" | "give_up";    // pass：检查通过；give_up：修复预算用尽或不再修复
    round: number;                  // 已用修复轮数 0..2
  };
}
```

服务端（在一个事务里）：
1. 更新版本 `status` / `errors_json`。
2. 若带 `qa`，找到该版本对应的 `qa_report` 消息（`version_id = :id` 且 role=qa），更新它：
   - `pass`：content "检查通过"（round>0 时为"已修复，检查通过"），meta.outcome = `pass` 或 `fixed`。
   - `give_up`：调用 `lastOkVersion(projectId)`（排除本版本）。找到 → `setCurrentVersion`，content "修复失败，已回退到 v{seq}"，outcome `rolled_back`；找不到 → content "未能自动修复，可以重新生成或换个说法"，outcome `failed`。

响应 `200 { ok: true, message: MessageDTO | null, currentVersion: VersionFull | null }`。`currentVersion` 仅在发生回退时返回，前端据此切换预览。

### `GET /api/versions/:id/download`
所有者或公开项目可下载。返回存储的 `html`（CDN 地址，不注入 runtime），响应头：
`Content-Type: text/html; charset=utf-8`、`Content-Disposition: attachment; filename*=UTF-8''<encodeURIComponent(title)>-v<seq>.html`。

## 5. SSE 接口

响应头：`Content-Type: text/event-stream; charset=utf-8`、`Cache-Control: no-cache, no-transform`、`Connection: keep-alive`、`X-Accel-Buffering: no`。

编码：每个事件

```
event: <type>
data: <单行 JSON>

```

每 15 秒发送 `: ping\n\n`。前端用 `fetch` + `ReadableStream` 读取并按空行切分解析（不能用 `EventSource`，因为是 POST）。解析器放在 `src/lib/sse-client.ts`，要处理一个 chunk 中包含多个事件、一个事件被拆在两个 chunk 的情况。

### 5.1 事件类型（`src/types/sse.ts`）

```ts
type SseEvent =
  | { type: "turn"; turnId: string; userMessage: MessageDTO | null } // 第一个事件；修复流程中可能为 null
  | { type: "message"; message: MessageDTO }                        // 新建一条消息（通常 status=running）
  | { type: "message_update"; id: string; patch: Partial<MessageDTO> } // 更新已有消息（状态、content、meta、finishedAt）
  | { type: "code_delta"; text: string }                            // 自由生成 / 补丁的流式增量（只用于展示）
  | { type: "version"; version: VersionFull; message: MessageDTO }  // 新版本已入库并成为当前版本；message 是 system/version 消息
  | { type: "project"; project: ProjectSummary }                    // 标题等变化
  | { type: "done"; turnId: string; versionId: string | null; fixRoundsUsed: number }
  | { type: "error"; code: string; message: string; retryable: boolean };
```

事件顺序保证：`turn` 总是第一个；`done` 或 `error` 总是最后一个且只出现一次；`version` 一定在 `done` 之前。

### `POST /api/generate`

入参：

```ts
{
  projectId: string;
  prompt: string;          // 1–2000 字
  isInitial?: boolean;     // 首页带过来的首次生成。服务端用 initial_prompt 校验，防止重复（若项目已有版本或已有 user 消息则忽略 isInitial，按普通追问处理）
  style?: "paper" | "pixel" | "bright";   // 风格卡片的选择（首页带到工作台的 ?style=，或工作台的风格按钮）
  styleOnly?: boolean;     // 工作台"换风格"按钮：当前是模板应用时不调用模型、不计入限流，直接换 theme 重新渲染（见 07 §2.1）
}
```

流程（失败时在对应步骤发 `error`）：
1. 校验归属 → 限流检查（`kind=generate`）→ 加锁（失败直接返回 409 JSON，不开流）。
2. 开流；插入 user 消息；发 `turn`。
3. 执行 [07-agent-pipeline.md](07-agent-pipeline.md) 的服务端步骤，过程中发 `message` / `message_update` / `code_delta`。
4. 写入版本后发 `version`；首轮且标题未锁定时更新标题并发 `project`。
5. 发 `done`，释放锁。

### `POST /api/fix`

入参：

```ts
{
  projectId: string;
  versionId: string;        // 出错的版本，必须是当前版本
  turnId: string;           // 所属 turn（手动修复时传新 turnId = null，服务端新建）
  errors: RuntimeError[];   // 1–10 条
  round: number;            // 本次是第几轮修复（1 或 2）；手动修复传 1
  manual?: boolean;         // 用户点"让测试员修复"
}
```

流程：校验 → 限流（`kind=fix`）→ 加锁 → 开流（`turn` 事件，`userMessage` 在非手动修复时为 null）→ 把该版本对应的 qa 消息（`version_id = versionId` 且 role=qa）更新为 status=done、content "发现 N 个问题，正在修复（第 k/2 轮）"、meta `{phase:"runtime", errors, round, outcome:"fixing"}`，同时把版本 status 置为 `error` → 插入 engineer 消息（kind `engineer_patch`，"正在修复问题…"）→ 修复（见 07 §8）→ 静态检查（不通过则本轮失败）→ 写入版本（`source=fix`，label "修复：<原 label>"，config_json = null）→ `version` → 为新版本插入 qa running 消息"正在检查运行情况…" → `done`（`fixRoundsUsed = round`）。

（`turn` 事件类型中 `userMessage` 因此为 `MessageDTO | null`。）

手动修复（`manual=true`）：新建一个 turn，先插入一条 user 消息"请修复预览中的报错"，其余相同，预算重新计 2 轮。

## 6. 限流规则（`src/lib/rate-limit.ts`）

检查顺序与默认值（环境变量可覆盖）：

| 维度 | 窗口 | 默认上限 | 环境变量 |
|---|---|---|---|
| 单访客 | 滚动 24 小时 | 40 次 | `RATE_LIMIT_VISITOR_PER_DAY` |
| 单 IP | 滚动 24 小时 | 80 次 | `RATE_LIMIT_IP_PER_DAY` |
| 全站 | 滚动 24 小时 | 1000 次 | `RATE_LIMIT_GLOBAL_PER_DAY` |

- `generate` 和 `fix` 都计数（自动修复也计）。通过检查后立即插入 `usage_events`。
- IP 取 `x-real-ip` 请求头（Nginx 设置），没有则取 `x-forwarded-for` 第一个，再没有用 `"unknown"`。
- `LLM_MOCK=1` 时不限流。

## 7. 页面数据获取

- 工作台 `src/app/p/[id]/page.tsx` 是 Server Component：直接调用 `getProjectDetail`，找不到调用 `notFound()`；把 `ProjectDetail` 作为 props 传给客户端组件 `<Workspace initial={...} />`。之后的变化通过 SSE 事件和接口响应在客户端合并，不需要 SWR/React Query。
- 首页项目列表：Server Component 直接查库渲染；重命名/删除后调用 `router.refresh()`。
- 分享页：Server Component 查库，项目不存在或未公开 → `notFound()`。
