# 12 · 实施任务清单（按顺序执行）

> 规则：严格按顺序做；每个任务完成后满足"完成标准"并提交一次。每个阶段结束时应用都处于可演示状态。时间为参考预算（合计约 8 小时）。如果进度落后，按 §"砍需求顺序"处理，不要跳过测试。

## 阶段 0：脚手架与上线（约 1 小时）

### T0.1 初始化项目
- `create-next-app`（TypeScript、App Router、Tailwind、ESLint、`src/` 目录、别名 `@/*`），Node 22。
- 安装 [03-tech-stack.md](03-tech-stack.md) 中的依赖；`shadcn init`（zinc），添加所需组件。
- 建立 [04-architecture.md](04-architecture.md) §2 的目录骨架（空文件即可）。
- 复制本文档集：根目录 `CLAUDE.md`、`AGENTS.md`，其余放 `docs/`。
- **完成标准**：`npm run dev` 打开首页；`typecheck`、`lint` 通过。

### T0.2 环境变量、日志、错误
- `src/lib/env.ts`、`src/lib/log.ts`、`src/lib/errors.ts`（含 `AppError`）、`src/lib/http.ts`（`withApi`）、`.env.example`。
- **完成标准**：缺少 `DEEPSEEK_API_KEY` 且 `LLM_MOCK!=1` 时启动报清晰错误。

### T0.3 数据库
- `schema.ts`（[05-data-model.md](05-data-model.md) §3）、`db/index.ts`（PRAGMA + 自动迁移）、`drizzle.config.ts`，生成首个迁移并提交。
- `queries.ts` 中 §4 列出的全部函数。
- `/api/health`。
- **完成标准**：首次请求 `/api/health` 自动建库建表；单元测试用临时库跑通 `createProject → createVersion（seq 递增）→ setCurrentVersion → lastOkVersion`。

### T0.4 访客身份
- `middleware.ts`（cookie + `x-visitor-id` 透传，matcher 排除 `_next/static`、`vendor`、favicon）、`src/lib/visitor.ts`、`/api/me`、`/api/me/restore`。
- **完成标准**：无痕窗口首次访问获得 cookie；`/api/me` 返回同一 ID。

### T0.5 Docker 与部署
- `Dockerfile`、`.dockerignore`、`docker-compose.yml`、`nginx/default.conf`（[10-deployment.md](10-deployment.md)）。
- 本地 `docker compose up --build` 跑通；推送 GitHub（公开仓库）；部署到服务器（内存不足按 §6）。
- **完成标准**：`http://<IP>/api/health` 返回 ok；容器重启后数据库文件仍在 `./data`。

## 阶段 1：生成链路与首批模板（约 1.5 小时）

### T1.1 模型接入
- `lib/llm/provider.ts`（[03-tech-stack.md](03-tech-stack.md) §3.1）、`lib/llm/call.ts`（`callJson`、`streamCode`，[07](07-agent-pipeline.md) §4、§6.3）、`lib/llm/mock.ts`（§12）、用量写入 `llm_calls`。
- `lib/agent/extract.ts`（`extractJson`、`extractHtml`）+ 单元测试。
- `scripts/smoke-llm.ts`：用真实 Key 调一次 PM 步骤并打印结果与请求体。
- **完成标准**：真实 Key 下 smoke 脚本返回合法 `PmOutput`，日志确认请求体含 `thinking: {type:"disabled"}` 和 `response_format`；mock 模式下返回样例。

### T1.2 模板基础设施 + 3 个模板
- `templates/_shared/contract-base.ts.txt`、`lib/templates/registry.ts`、`schemas.ts`、`render.ts`、`lib/vendor.ts`，下载两个 vendor 文件到 `public/vendor/`。
- 模板：`todo`、`ledger`、`landing`（[08-templates.md](08-templates.md) §4、§5）。
- `/dev/templates` 画廊页（仅 `NODE_ENV !== "production"` 可访问，否则 404）。
- `tests/unit/templates.test.ts`。
- **完成标准**：3 个模板在画廊中逐条满足"功能要求"；单元测试通过。

### T1.3 静态检查与补丁工具
- `lib/agent/qa-static.ts`、`lib/agent/patch.ts` + 单元测试（[07](07-agent-pipeline.md) §7.4、§9 要求的用例）。
- **完成标准**：单元测试全部通过。

### T1.4 提示词与流水线
- `lib/agent/schemas.ts`、`prompts/*.ts`（全部 5 个）、`design-spec.ts`、`pipeline.ts`（[07](07-agent-pipeline.md) §10）、`lib/locks.ts`、`lib/sse.ts`、`lib/rate-limit.ts`。
- 路由：`POST /api/projects`、`GET /api/projects`、`GET/PATCH/DELETE /api/projects/:id`、`POST /api/generate`。
- **完成标准**：用 curl 调 `/api/generate`（mock 与真实各一次），能看到 `turn → message… → version → done` 事件序列，数据库中有消息和版本；同一项目并发请求第二个返回 409。

## 阶段 2：工作台界面（约 1.25 小时）

### T2.1 首页
- `PromptBox`、`ExampleCards`、`ProjectGrid`（[02-ux-ui-spec.md](02-ux-ui-spec.md) §4）。
- **完成标准**：AC-1.1 ~ 1.5。

### T2.2 工作台框架与对话流
- `p/[id]/page.tsx`、`Workspace`（reducer）、`TopBar`、`ChatPanel`、`AgentCard`、`VersionCard`、`Composer`、`lib/sse-client.ts`、`useGeneration`（含停止）。
- `?start=1` 自动开始首次生成（`isInitial: true`），开始后用 `router.replace` 去掉参数。
- **完成标准**：AC-2.1 ~ 2.3、AC-2.6、AC-4.1、AC-8.1、AC-8.5；刷新后对话完整恢复（AC-7.2）。

### T2.3 预览与代码
- `lib/preview/runtime.ts`、`build-srcdoc.ts` + 单元测试、`PreviewFrame`、`usePreviewBridge`、`PreviewPane`、`CodeView`。
- 自由生成时代码 Tab 流式显示。
- 手机端分段切换布局。
- **完成标准**：AC-3.1 ~ 3.5；生成的 todo 应用添加数据后刷新仍在。

## 阶段 3：持久化细节与追问修改（约 0.75 小时）

### T3.1 追问修改
- 意图路由 `normalizeIntent` + 单元测试；`config_edit`、`code_patch`（含重试与整页重写降级）、`regenerate` 三条分支在 UI 中验证。
- **完成标准**：AC-4.2 ~ 4.6。

### T3.2 项目管理
- 重命名、删除、首页列表刷新、恢复码菜单（`RecoveryMenu`）。
- **完成标准**：AC-7.3 ~ 7.5。

## 阶段 4：亮点一 —— 智能体团队与自动修复（约 1 小时）

### T4.1 客户端 QA 与自动修复
- `useAutoFix`（[07](07-agent-pipeline.md) §11）、`POST /api/versions/:id/status`、`POST /api/fix`、`lib/agent/fix.ts`、`ErrorBar`（手动修复）。
- mock 的 `#broken` 用例。
- **完成标准**：AC-2.4、AC-2.5；E2E 用例"自动修复成功"和"修复失败回退"通过。

### T4.2 卡片打磨
- 耗时计时、配置折叠区、补丁摘要、QA 错误列表、空预览动画。
- **完成标准**：[02](02-ux-ui-spec.md) §5.4 表格中每种状态都能在 mock 模式下看到。

## 阶段 5：亮点二 —— 版本与分享（约 1 小时）

### T5.1 版本时间线与回滚
- `VersionMenu`、查看模式 `ViewingBanner`、`POST /api/projects/:id/restore`、`GET /api/versions/:id`。
- **完成标准**：AC-5.1 ~ 5.4。

### T5.2 分享与下载
- `ShareDialog`、`share/[id]/page.tsx`、`MadeWithBadge`、`GET /api/versions/:id/download`。
- **完成标准**：AC-6.1 ~ 6.5。

## 阶段 6：补齐模板与自测（约 0.75 小时）

### T6.1 其余 5 个模板
- `form`、`kanban`、`dashboard`、`game`、`crud`。
- **完成标准**：同 T1.2；8 个模板单元测试全部通过。

### T6.2 E2E 与真实模型冒烟
- `tests/e2e/` 按 [13-test-acceptance.md](13-test-acceptance.md) §3 编写并通过。
- `scripts/smoke-llm.ts` 扩展为跑 §4 的 8 条真实需求，输出每条的路径、耗时、是否通过静态检查。
- 部署最新版到服务器，按 §5 线上冒烟。
- **完成标准**：E2E 全绿；真实模型 8 条中 ≥ 7 条一次成功；线上冒烟通过。

## 阶段 7：文档与提交（约 0.5 小时）

### T7.1 README 与说明
- 按 [14-readme-outline.md](14-readme-outline.md) 编写 `README.md`；`npm run usage` 输出贴入"成本"一节。
- **完成标准**：陌生人照 README 能在本地用 `LLM_MOCK=1` 跑起来。

### T7.2 提交检查
- 按 [13-test-acceptance.md](13-test-acceptance.md) §6 的提交清单逐项确认。

## 砍需求顺序（进度落后时，从上往下砍）

1. P2 全部（Remix、设备切换、可编辑代码）。
2. E6 恢复码。
3. E5 手动修复按钮（保留自动修复）。
4. 模板从 8 个减到 5 个（保留 todo、ledger、landing、kanban、game，其他需求走自由生成）。
5. E3 分享页（保留下载）。

**不可砍**：P0 全部、E1 自动修复闭环、E2 版本回滚、限流、单元测试中的 patch / qa-static / build-srcdoc。
