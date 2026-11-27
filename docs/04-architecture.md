# 04 · 系统架构

## 1. 总览

```
浏览器                                     服务器（Docker Compose）
┌─────────────────────────────┐          ┌──────────────────────────────────────┐
│ 首页 / 工作台 / 分享页 (React) │  HTTP    │ nginx :80                              │
│                             │ ───────▶ │   └─▶ app :3000 (Next.js standalone)   │
│ 预览 iframe（sandbox）        │   SSE    │        ├─ Route Handlers (/api/*)      │
│   └─ 注入的 runtime 脚本      │ ◀─────── │        ├─ Agent 流水线 (src/lib/agent)  │
│      ├ 报错 → postMessage    │          │        ├─ 模板渲染 (templates/*)        │
│      └ storage → postMessage │          │        └─ SQLite (./data/app.db)        │
└─────────────────────────────┘          └──────────────┬───────────────────────┘
                                                        │ HTTPS
                                                        ▼
                                              DeepSeek API (deepseek-flash)
```

- 单进程、单数据库文件、无队列、无缓存服务。
- 一次"生成 / 修改"是一个 `POST /api/generate` 请求，服务端顺序执行产品经理 → 工程师 → 静态检查，SSE 流式推送事件，结束时写入新版本。
- 运行时检查在浏览器里发生：预览 iframe 加载后，注入脚本上报报错；前端据此调用 `POST /api/fix`。这是整个状态机里唯一跨请求的环节。

## 2. 仓库目录结构（必须照此组织）

```
atoms-demo/
├─ CLAUDE.md                     # 编码智能体入口（本文档集的索引）
├─ AGENTS.md                     # 与 CLAUDE.md 内容相同
├─ README.md                     # 对外说明文档（见 docs/14-readme-outline.md）
├─ docs/                         # 本文档集
├─ .env.example
├─ Dockerfile
├─ docker-compose.yml
├─ nginx/default.conf
├─ next.config.ts                # output: "standalone"
├─ drizzle.config.ts
├─ drizzle/                      # drizzle-kit 生成的迁移 SQL（提交到仓库）
├─ templates/                    # 8 个应用模板（运行时用 fs 读取）
│  ├─ todo/        template.html  example.json
│  ├─ ledger/      …
│  ├─ form/
│  ├─ kanban/
│  ├─ landing/
│  ├─ dashboard/
│  ├─ game/
│  └─ crud/
├─ public/vendor/                # tailwindcss-browser.js、chart.umd.min.js
├─ scripts/
│  ├─ usage-report.ts            # 打印 token 用量与估算费用
│  └─ smoke-llm.ts               # 用真实 Key 跑一遍 8 个示例需求
├─ tests/
│  ├─ unit/                      # vitest
│  ├─ e2e/                       # playwright（LLM_MOCK=1）
│  └─ fixtures/llm/              # mock 模型输出
└─ src/
   ├─ middleware.ts              # 发放访客 cookie
   ├─ app/
   │  ├─ layout.tsx  globals.css  not-found.tsx
   │  ├─ page.tsx                # 首页
   │  ├─ p/[id]/page.tsx         # 工作台（服务端取数据 → <Workspace/>）
   │  ├─ share/[id]/page.tsx     # 分享页
   │  ├─ dev/templates/page.tsx  # 仅开发环境：模板画廊，逐个渲染 example.json
   │  └─ api/
   │     ├─ health/route.ts
   │     ├─ me/route.ts                       # GET
   │     ├─ me/restore/route.ts               # POST
   │     ├─ projects/route.ts                 # GET, POST
   │     ├─ projects/[id]/route.ts            # GET, PATCH, DELETE
   │     ├─ projects/[id]/restore/route.ts    # POST
   │     ├─ versions/[id]/route.ts            # GET
   │     ├─ versions/[id]/status/route.ts     # POST
   │     ├─ versions/[id]/download/route.ts   # GET
   │     ├─ generate/route.ts                 # POST (SSE)
   │     └─ fix/route.ts                      # POST (SSE)
   ├─ components/
   │  ├─ ui/                     # shadcn 生成
   │  ├─ home/                   # PromptBox, ExampleCards, ProjectGrid, RecoveryMenu
   │  ├─ workspace/              # Workspace, TopBar, ChatPanel, AgentCard, VersionCard,
   │  │                          # Composer, PreviewPane, PreviewFrame, CodeView,
   │  │                          # VersionMenu, ShareDialog, ViewingBanner, ErrorBar
   │  └─ share/                  # ShareFrame, MadeWithBadge
   ├─ hooks/
   │  ├─ useGeneration.ts        # 发起 SSE、解析事件、维护运行中状态
   │  ├─ usePreviewBridge.ts     # 监听 iframe postMessage（报错、storage、ready）
   │  └─ useAutoFix.ts           # 测试员自动修复状态机（客户端部分）
   ├─ lib/
   │  ├─ env.ts                  # zod 校验环境变量
   │  ├─ db/ index.ts schema.ts queries.ts
   │  ├─ visitor.ts              # 读取/校验访客 ID
   │  ├─ rate-limit.ts
   │  ├─ locks.ts                # 项目级内存锁
   │  ├─ sse.ts                  # SSE 编码工具
   │  ├─ errors.ts               # 错误码 + 中文文案
   │  ├─ agents.ts               # 角色常量（名称、颜色）
   │  ├─ examples.ts             # 首页示例
   │  ├─ vendor.ts               # 白名单库 CDN 地址 ↔ 本地地址
   │  ├─ llm/
   │  │  ├─ provider.ts          # DeepSeek 接入
   │  │  ├─ call.ts              # callJson / streamCode，含超时、重试、用量记录
   │  │  └─ mock.ts              # LLM_MOCK 实现
   │  ├─ agent/
   │  │  ├─ pipeline.ts          # 生成状态机（服务端部分）
   │  │  ├─ fix.ts               # 修复流程
   │  │  ├─ prompts/             # pm.ts, config.ts, free.ts, patch.ts, fix.ts（提示词模板）
   │  │  ├─ schemas.ts           # PM 输出等 zod schema
   │  │  ├─ design-spec.ts       # 自由生成用的设计规范与组件片段
   │  │  ├─ patch.ts             # SEARCH/REPLACE 解析与应用
   │  │  ├─ extract.ts           # 从模型输出中提取 JSON / HTML
   │  │  └─ qa-static.ts         # 服务端静态检查
   │  ├─ templates/
   │  │  ├─ registry.ts          # 模板元数据（id、名称、适用场景）
   │  │  ├─ schemas.ts           # 每个模板的 APP_CONFIG zod schema
   │  │  └─ render.ts            # 读取 template.html，注入配置
   │  └─ preview/
   │     ├─ runtime.ts           # 注入 iframe 的脚本（字符串导出）
   │     └─ build-srcdoc.ts      # 组装 srcdoc：runtime + 存储快照 + 替换 vendor 地址
   └─ types/                     # 共享类型（SSE 事件、API DTO）
```

## 3. 生成状态机

一轮"用户提出需求 → 交付一个通过检查的版本"称为一个 **turn**。状态机横跨两个接口：

```
             POST /api/generate（一个 SSE 请求）
┌──────────────────────────────────────────────────────────────────┐
│ ① 校验/限流/加锁 → 保存用户消息                                    │
│ ② PM：callJson → PmOutput（意图、模板、功能、版本名）               │
│ ③ Engineer：按意图分支                                             │
│     template_new   → callJson(模板配置) → render                   │
│     config_edit    → callJson(新配置)   → render                   │
│     code_patch     → streamText(补丁)   → applyPatches             │
│     free_new / regenerate(无模板) → streamText(HTML) → extract     │
│ ④ 静态检查 qa-static；失败 → 服务端修复 1 轮（计入修复预算）         │
│ ⑤ 写入版本 status=pending，设为当前版本 → SSE: version, done        │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼  浏览器加载新版本到 iframe
┌──────────────────────────────────────────────────────────────────┐
│ ⑥ QA（客户端）：等待 runtime 上报 ready（含 3 秒内收集到的报错）      │
│     无报错 → POST /api/versions/:id/status {ok} → turn 结束          │
│     有报错且修复预算剩余 → POST /api/fix（SSE）→ 新版本 → 回到 ⑥       │
│     有报错且预算用尽 → status=error，回退到最近 ok 版本 → turn 结束    │
└──────────────────────────────────────────────────────────────────┘
```

- **修复预算**：每个 turn 共 4 轮（服务端静态修复和客户端运行时修复共享）。`done` 事件里返回 `fixRoundsUsed`，客户端用 `4 - fixRoundsUsed` 作为剩余预算。
- 每一步开始和结束都写 `messages` 表（role + kind + status + content + meta），UI 卡片完全由这些消息驱动，所以刷新后能原样恢复。
- 详细的每步输入输出、提示词、重试策略见 [07-agent-pipeline.md](07-agent-pipeline.md)。

## 4. 关键模块职责

| 模块 | 职责 | 不负责 |
|---|---|---|
| `lib/agent/pipeline.ts` | 编排一次 turn 的服务端步骤，产出 SSE 事件，写库 | 不直接拼提示词（调用 `prompts/*`） |
| `lib/llm/call.ts` | 统一的模型调用：超时、重试、JSON 提取与校验、用量写入 `llm_calls` | 不知道业务含义 |
| `lib/templates/render.ts` | `renderTemplate(id, config) → html` | 不校验配置（调用方先用 schema 校验） |
| `lib/agent/patch.ts` | 解析 SEARCH/REPLACE 块并应用，返回成功/失败明细 | 不调用模型 |
| `lib/agent/qa-static.ts` | HTML 结构、外链白名单、内联脚本语法检查 | 不运行代码 |
| `lib/preview/*` | 构造 iframe 内容，定义 iframe ↔ 父页面的消息协议 | 不访问数据库 |
| `hooks/useAutoFix.ts` | 客户端 QA 状态机：收集报错、决定修复还是回退 | 不渲染 UI |

## 5. 并发、超时与取消

- **项目锁**：`lib/locks.ts` 维护 `Map<projectId, AbortController>`。`/api/generate` 和 `/api/fix` 开始时加锁，已被锁返回 409 `PROJECT_BUSY`；结束（成功、失败、取消）时释放。单进程部署，内存锁足够。
- **取消**：客户端点"停止"时 `AbortController.abort()` 断开 fetch；服务端监听 `request.signal` 的 `abort`，向模型调用传同一个 signal，并把当前运行中的智能体消息置为 `stopped`、写一条系统消息"已停止"，不产生版本。
- **超时**：PM / 配置步骤 45 秒；自由生成与补丁 150 秒；修复 90 秒。超时视为失败（`LLM_TIMEOUT`）。
- **Nginx**：`/api/` 关闭缓冲，`proxy_read_timeout 300s`。服务端每 15 秒发一次 SSE 注释行 `: ping` 防止中间设备断连。

## 6. 身份与权限

- `middleware.ts`：请求没有 `atoms_vid` cookie 时生成 `nanoid(21)` 并写入（`HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000`，不加 `Secure`，因为站点是 HTTP）。同时把 ID 放到请求头 `x-visitor-id` 透传给 Route Handler，避免首个请求读不到 cookie。
- 所有项目、版本接口：用访客 ID 查归属，不属于当前访客一律返回 404（不返回 403，避免暴露存在性）。
- 例外：`GET /api/versions/:id` 和分享页允许在项目 `is_public = 1` 时匿名读取。

## 7. 安全边界

- 生成代码只在 `sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads"` 的 iframe 中运行，**永不**加 `allow-same-origin`。iframe 内拿不到主站 cookie、localStorage 和 DOM。
- iframe ↔ 父页面消息：父页面只处理 `event.source === iframe.contentWindow` 且 `data.channel === <本次渲染的随机 nonce>` 的消息。
- API Key 只存在服务端环境变量，不进任何响应、日志或前端打包。
- 所有接口入参 zod 校验；请求体上限 1 MB（Next 默认 + Nginx `client_max_body_size 2m`）。
- 主站页面设置响应头 `X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`（在 `next.config.ts` 的 `headers()` 中）。

## 8. 日志

- `src/lib/log.ts`：`log.info(event, fields)` 输出单行 JSON 到 stdout（`{"t":"…","level":"info","event":"generate.done","projectId":"…","ms":12345}`）。
- 必须记录：每个 API 请求的结果与耗时、每次模型调用（不含提示词全文，只记长度）、限流命中、修复与回退。
- 不记录：API Key、完整用户输入（只记前 80 字符）。
