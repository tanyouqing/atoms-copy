# 11 · 编码规范

## 1. TypeScript

- `tsconfig.json`：`"strict": true`、`"noUncheckedIndexedAccess": true`、路径别名 `@/*` → `src/*`。
- 禁止 `any`（确有需要用 `unknown` 再收窄）；禁止 `// @ts-ignore`（必要时 `// @ts-expect-error` 并写原因）。
- 类型优先从 zod schema 推导（`z.infer`），不要手写重复类型。
- 共享类型放在 `src/types/`；只在一个模块内使用的类型就近定义。

## 2. 命名

| 对象 | 规范 | 例子 |
|---|---|---|
| 文件（组件） | PascalCase | `AgentCard.tsx` |
| 文件（其他） | kebab-case | `rate-limit.ts`、`build-srcdoc.ts` |
| React 组件 | PascalCase，具名导出 | `export function AgentCard()` |
| hooks | `useXxx` | `useAutoFix` |
| 常量 | UPPER_SNAKE | `TEMPLATE_IDS` |
| 数据库列 | snake_case；TS 字段 camelCase | `current_version_id` ↔ `currentVersionId` |
| API JSON 字段 | camelCase | `fixRoundsUsed` |
| 错误码 | UPPER_SNAKE | `LLM_TIMEOUT` |

页面文件（`page.tsx`、`layout.tsx`、`route.ts`）按 Next.js 约定默认导出。

## 3. 目录边界

- `src/lib/**` 中访问数据库、文件系统、模型的模块，第一行写 `import "server-only";`。
- 客户端组件文件第一行 `"use client";`，只在需要状态或浏览器 API 的组件上加。
- 组件不直接 `fetch` 散落各处：工作台的接口调用集中在 `src/lib/api-client.ts`（`api.renameProject()` 等），SSE 集中在 `useGeneration`。
- 提示词只放在 `src/lib/agent/prompts/`，每个文件导出 `buildXxxSystem()`、`buildXxxUser(vars)` 两个纯函数，模板变量用对象传入，不在别处拼接提示词。

## 4. Route Handler 模板

```ts
import { NextRequest } from "next/server";
import { z } from "zod";
import { withApi } from "@/lib/http";       // 统一处理 AppError → JSON、日志、耗时

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ title: z.string().trim().min(1).max(40).optional(), isPublic: z.boolean().optional() })
  .refine((b) => b.title !== undefined || b.isPublic !== undefined, "至少提供一个字段");

export const PATCH = withApi(async (req: NextRequest, { params, visitorId }) => {
  const body = Body.parse(await req.json());            // ZodError 由 withApi 转为 400
  const project = getProjectForVisitor(params.id, visitorId) ?? notFoundError();
  // …
  return Response.json({ project: toSummary(updated) });
});
```

- `withApi` 负责：解析 visitorId（并 upsert visitor）、`await ctx.params`（Next 15 中 params 是 Promise）、捕获 `AppError` / `ZodError` / 未知错误、输出单行日志。
- `AppError(code, params?)`：`code` 必须在 `errors.ts` 表中，HTTP 状态与文案从表里取。

## 5. React

- 函数组件 + hooks；不引入状态管理库。工作台状态集中在 `Workspace` 组件的一个 `useReducer`（`workspaceReducer` 放在 `src/components/workspace/state.ts`，纯函数，有单元测试）。
- reducer 的 action 覆盖：`sse/turn`、`sse/message`、`sse/message_update`、`sse/code_delta`、`sse/version`、`sse/project`、`sse/done`、`sse/error`、`view/select_version`、`view/back_to_current`、`restore/success`、`qa/rolled_back` 等。SSE 事件直接映射为 action，避免分散的 setState。
- 样式只用 Tailwind 类名；可复用的组合用 `cn()`（shadcn 自带）。不写 CSS Modules。
- 列表 key 用业务 id，不用下标。
- 所有用户可见文案用中文，集中的文案（错误、智能体名称、示例）放在 `src/lib/`，组件内的一次性文案可以直接写。

## 6. 错误处理

- 服务端：业务错误抛 `AppError`；模型相关错误在 `lib/llm/call.ts` 中统一转换；任何 `catch` 都要么转换后重新抛出，要么记录日志并返回明确结果，不允许空 catch（生成的应用模板内的 storage try/catch 除外）。
- 客户端：接口错误统一用 `ApiError { code, message }`，UI 直接展示 `message`。
- SSE 中途异常：服务端保证发出 `error` 事件；客户端在流意外结束（没收到 `done`/`error`）时显示"连接中断，请刷新页面查看进度"。

## 7. 数据库

- 只通过 `src/lib/db/queries.ts` 访问数据库，路由和流水线中不写 SQL / Drizzle 查询。
- 改表结构：改 `schema.ts` → `npx drizzle-kit generate` → 提交生成的 SQL。不手写迁移、不用 `push`。

## 8. 测试

- 单元测试（vitest）文件放 `tests/unit/*.test.ts`，必须覆盖：`patch.ts`、`extract.ts`、`qa-static.ts`、`render.ts` + 模板 schema、`rate-limit.ts`、`build-srcdoc.ts`（行号不变）、`workspaceReducer`、`sse-client` 解析器、意图修正 `normalizeIntent`。
- E2E（Playwright）放 `tests/e2e/`，在 `LLM_MOCK=1` 下运行，使用独立数据库文件 `./data/test.db`（启动前删除）。
- 命令：`npm test`（vitest run）、`npm run test:e2e`（playwright test --trace off）。

## 9. npm scripts（`package.json`）

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "node .next/standalone/server.js",
  "lint": "next lint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:e2e": "playwright test --trace off",
  "db:generate": "drizzle-kit generate",
  "usage": "tsx scripts/usage-report.ts",
  "smoke:llm": "tsx scripts/smoke-llm.ts"
}
```

## 10. Git

- 分支：直接在 `main` 上按任务提交（个人项目、时间紧），每完成 [12-tasks.md](12-tasks.md) 中一个任务提交一次。
- 提交信息：Conventional Commits，英文，如 `feat(agent): add patch-based follow-up edits`、`fix(preview): keep line numbers stable`。
- 绝不提交：`.env`、`data/`、任何 API Key。提交前 `git diff --cached | grep -i "sk-"` 自查。

## 11. 完成定义（每个任务）

1. `npm run typecheck`、`npm run lint` 无错误。
2. 相关单元测试通过；涉及主流程的任务 E2E 通过。
3. 在浏览器里手动走一遍该任务的验收点。
4. 不留 `console.log`（`lib/log.ts` 除外）、不留 TODO（确需留下的写进 README"后续规划"）。
