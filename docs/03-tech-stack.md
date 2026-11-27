# 03 · 技术选型与版本

> 规则：只使用本文列出的依赖。需要新增依赖时，先确认标准库或已有依赖无法完成，并在 README 的"依赖说明"中写一句理由。主版本号必须与下表一致；安装时由 `package-lock.json` 锁定精确版本。

## 1. 运行环境

| 项 | 版本 | 说明 |
|---|---|---|
| Node.js | 22 LTS | 本地与 Docker 镜像（`node:22-bookworm-slim`）一致。不用 Alpine（better-sqlite3 预编译包基于 glibc） |
| 包管理器 | npm | 不用 pnpm / yarn，减少部署环节 |
| 操作系统（服务器） | Linux x86_64，Docker 24+、Docker Compose v2 | 见 [10-deployment.md](10-deployment.md) |

## 2. 依赖清单

### 2.1 运行时依赖

| 包 | 主版本 | 用途 |
|---|---|---|
| `next` | 15.x | 全栈框架，App Router，`output: "standalone"` |
| `react` / `react-dom` | 19.x | UI |
| `typescript` | 5.x | 严格模式 |
| `tailwindcss` / `@tailwindcss/postcss` | 4.x | 主站样式 |
| shadcn/ui（CLI 生成到 `src/components/ui`） | 最新 CLI | Button、Input、Textarea、Dialog、AlertDialog、DropdownMenu、Popover、Tabs、Switch、Tooltip、ScrollArea、Skeleton、Badge、Sonner |
| `lucide-react` | 最新 | 图标 |
| `ai` | 5.x | Vercel AI SDK：`generateObject`、`streamText` |
| `@ai-sdk/openai-compatible` | 1.x | 以 OpenAI 兼容方式接 DeepSeek（见 §3） |
| `zod` | 3.25+ 或 4.x（与 `ai` 的 peer 要求一致） | 所有 JSON 结构和接口入参的校验 |
| `drizzle-orm` | 0.4x | ORM |
| `better-sqlite3` | 12.x（或当前最新主版本） | SQLite 驱动 |
| `nanoid` | 5.x | ID 生成 |
| `react-resizable-panels` | 3.x | 工作台分栏 |
| `@uiw/react-codemirror`、`@codemirror/lang-html`、`@codemirror/lang-json` | 4.x / 6.x | 代码查看 |
| `sonner` | 最新 | Toast（shadcn 自带） |

### 2.2 开发依赖

| 包 | 用途 |
|---|---|
| `drizzle-kit` | 生成迁移 SQL |
| `vitest` | 单元测试 |
| `@playwright/test` | 端到端测试 |
| `@types/better-sqlite3`、`@types/node`、`@types/react` | 类型 |
| `eslint`、`eslint-config-next` | Lint |
| `prettier` | 格式化 |
| `tsx` | 运行 `scripts/*.ts` |

### 2.3 生成的应用可用的前端库（白名单）

生成的 HTML **只能**通过 `<script src>` 引用以下两个库，且必须写成下表的 CDN 地址（版本号在实现时选定当时最新的 4.x 并写死在 `src/lib/vendor.ts`）：

| 库 | 存储的 HTML 中写的地址 | 预览时替换为 |
|---|---|---|
| Tailwind CSS Browser | `https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.x.y` | `/vendor/tailwindcss-browser.js` |
| Chart.js | `https://cdn.jsdelivr.net/npm/chart.js@4.x.y/dist/chart.umd.min.js` | `/vendor/chart.umd.min.js` |

两个文件下载后提交到 `public/vendor/`。预览和分享页渲染时把 CDN 地址替换为本站地址（不依赖外网 CDN，国内服务器也秒开）；下载的 HTML 保留 CDN 地址（离线文件需要从 CDN 加载）。详见 [09-preview-runtime.md](09-preview-runtime.md)。

不允许 React CDN、Babel、Vue、jQuery 或任何其他库。理由：原生 JS 能被服务端做语法检查（`vm.Script`），JSX 不能；库越少，低成本模型越不容易写错 API。

## 3. 大模型：DeepSeek Flash

已于 2026-11-27 在官方文档 [Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing) 和 [Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/) 核实：

| 项 | 值 |
|---|---|
| 模型名 | `deepseek-flash`（当前对应 DeepSeek-V4.1-Flash。旧名 `deepseek-v4-flash` 仍可用但会被转到同一模型，不要用旧名） |
| Base URL（OpenAI 格式） | `https://api.deepseek.com` |
| 上下文长度 | 1M |
| 支持 | JSON Output、Tool Calls、Chat Prefix Completion（Beta） |
| 思考模式 | **默认开启**（effort 默认 high）。本项目全部步骤**关闭**思考模式以降低延迟和费用：请求体加 `"thinking": {"type": "disabled"}` |
| 价格（每 1M token，美元） | 非高峰：输入缓存命中 $0.003 / 未命中 $0.15 / 输出 $0.6；高峰时段（UTC 周一至周五 01:00–04:00、06:00–10:00）价格翻倍 |

注意事项：
- 思考模式下 `temperature` 无效；我们关闭了思考模式，所以 `temperature` 生效，按 [07-agent-pipeline.md](07-agent-pipeline.md) 中每步的设定传。
- JSON Output 要求提示词中出现 "json" 字样并给出示例结构，我们的所有 JSON 步骤提示词都满足。
- 模型名、Base URL 都从环境变量读取（`DEEPSEEK_MODEL`、`DEEPSEEK_BASE_URL`），升级模型不改代码。
- 价格从环境变量读取用于成本估算（`LLM_PRICE_INPUT_PER_M`、`LLM_PRICE_OUTPUT_PER_M`），默认按非高峰价。

### 3.1 接入方式（必须照此实现）

文件 `src/lib/llm/provider.ts`：

```ts
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { env } from "@/lib/env";

// DeepSeek 默认开启思考模式。AI SDK 不认识这个字段，
// 所以用自定义 fetch 在每个请求体里注入 thinking: disabled。
const deepseekFetch: typeof fetch = async (input, init) => {
  if (init?.body && typeof init.body === "string") {
    const body = JSON.parse(init.body);
    body.thinking = { type: "disabled" };
    init = { ...init, body: JSON.stringify(body) };
  }
  return fetch(input, init);
};

export const deepseek = createOpenAICompatible({
  name: "deepseek",
  baseURL: env.DEEPSEEK_BASE_URL, // https://api.deepseek.com
  apiKey: env.DEEPSEEK_API_KEY,
  fetch: deepseekFetch,
});

export const model = () => deepseek(env.DEEPSEEK_MODEL); // deepseek-flash
```

- 结构化输出用 `generateObject({ model: model(), schema, system, prompt, temperature, maxOutputTokens })`。若 SDK 抛出 `NoObjectGeneratedError`，按 [07-agent-pipeline.md](07-agent-pipeline.md) §4 的 `callJson` 规则从 `error.text` 中提取 JSON 并重试。
- 长文本（自由生成 HTML、补丁）用 `streamText`。
- `LLM_MOCK=1` 时 `src/lib/llm/` 下的封装函数返回固定样例，不发网络请求（用于 E2E 测试和无 Key 的本地演示）。

## 4. 选型理由与备选（写 README 时引用）

| 层 | 选型 | 为什么 | 备选 |
|---|---|---|---|
| 框架 | Next.js 15 App Router | 前后端同仓；standalone 打包后一个 Node 进程运行；流式响应原生支持 | Vite + Hono |
| UI | Tailwind + shadcn/ui | 很快做出像样的界面，组件源码在仓库里可改 | Mantine |
| 智能体编排 | Vercel AI SDK + 手写 TypeScript 状态机 | `generateObject` + zod 直接拿到校验过的 JSON；`streamText` 流式；三步流水线逻辑简单，手写状态机比引入框架更透明 | LangGraph.js / Mastra（后续当步骤变多、需要持久化断点时迁移） |
| 模型 | DeepSeek Flash | 成本极低，国内外服务器都能直连；质量短板用模板优先等工程手段弥补 | 只把修复步骤换成更强模型 |
| 预览 | `iframe sandbox` + `srcdoc` | 单文件 HTML 直接渲染，无构建；沙箱隔离主站 | Sandpack、WebContainer |
| 代码查看 | CodeMirror 6 | 打包进应用、不依赖外部 CDN、体积小、构建内存占用低 | Monaco（默认从 CDN 加载，国内不稳） |
| 数据库 | SQLite + Drizzle | 单机零运维；数据是一个文件，挂 Docker 卷即持久化 | Postgres（Drizzle 代码基本不变） |
| 部署 | Docker Compose + Nginx，自有云服务器 IP 访问 | 完全可控，没有函数时长限制，流式不会被平台掐断 | Node + PM2 |

与原方案的两处调整（均为降低交付风险）：
1. 代码查看器由 Monaco 改为 CodeMirror 6：Monaco 默认从 jsDelivr 加载，服务器在国内时可能加载慢；CodeMirror 打包在应用内。
2. 生成应用引用的库在预览时改为本站托管（`public/vendor/`），避免预览依赖外网 CDN。
