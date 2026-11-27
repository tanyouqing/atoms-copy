# CLAUDE.md — Atoms Demo 编码智能体入口

> 本文件是给编码智能体的总入口（`AGENTS.md` 内容与此相同）。开工前完整阅读本文件，再按"阅读顺序"读 `docs/`。文档之间如有冲突，以**编号更大的专项文档**为准（例如 07 的流水线细节优先于 04 的概述），并在 README"已知问题"里记一笔。

## 1. 项目一句话

做一个可运行的 "Atoms Demo"（参考 atoms.dev）：用户用自然语言描述应用 → 一支可见的 AI 团队（Mia 产品经理、Leo 工程师、Iris 测试员）规划并生成**单文件 HTML 应用** → 在页面沙箱 iframe 中实时预览 → 可继续对话修改、回滚版本、公开分享。无需注册，数据持久化在 SQLite。部署在自有云服务器（Docker Compose + Nginx，IP 访问，不用 Vercel）。模型只用 **DeepSeek Flash（`deepseek-flash`）**。

这是一个求职笔试作品，评审看：完成度、工程思维、用户体验、创新性、可交付性。**主流程稳定第一**。

## 2. 阅读顺序

| # | 文档 | 内容 | 何时必读 |
|---|---|---|---|
| 01 | [docs/01-prd.md](docs/01-prd.md) | 需求、用户故事、验收标准（AC 编号） | 开工前 |
| 12 | [docs/12-tasks.md](docs/12-tasks.md) | **按顺序执行的任务清单**与完成标准、砍需求顺序 | 开工前，并贯穿全程 |
| 04 | [docs/04-architecture.md](docs/04-architecture.md) | 架构、目录结构、状态机、并发与安全 | 开工前 |
| 03 | [docs/03-tech-stack.md](docs/03-tech-stack.md) | 依赖与版本、DeepSeek 接入代码 | T0.1、T1.1 |
| 11 | [docs/11-conventions.md](docs/11-conventions.md) | 编码规范、完成定义 | 开工前 |
| 05 | [docs/05-data-model.md](docs/05-data-model.md) | SQLite 表结构、Drizzle schema、查询函数 | T0.3 |
| 06 | [docs/06-api-spec.md](docs/06-api-spec.md) | REST 与 SSE 接口、错误码、限流 | T1.4 起 |
| 07 | [docs/07-agent-pipeline.md](docs/07-agent-pipeline.md) | 智能体流水线、**全部提示词原文**、JSON schema、补丁、修复、mock | T1.1、T1.4、T3.1、T4.1 |
| 08 | [docs/08-templates.md](docs/08-templates.md) | 设计规范、8 个模板的配置契约与功能要求、模板工程规范 | T1.2、T6.1 |
| 09 | [docs/09-preview-runtime.md](docs/09-preview-runtime.md) | iframe 沙箱、runtime 注入、localStorage 垫片、消息协议 | T2.3 |
| 02 | [docs/02-ux-ui-spec.md](docs/02-ux-ui-spec.md) | 页面布局、组件、状态、文案、视觉 token | 阶段 2 起 |
| 10 | [docs/10-deployment.md](docs/10-deployment.md) | Dockerfile、Compose、Nginx、环境变量、内存不足方案、备份 | T0.5、每次部署 |
| 13 | [docs/13-test-acceptance.md](docs/13-test-acceptance.md) | 单元 / E2E 用例、真实模型冒烟、验收总表、提交清单 | 每个阶段结束 |
| 14 | [docs/14-readme-outline.md](docs/14-readme-outline.md) | README（对外说明文档）大纲 | T7.1 |

## 3. 不可违反的规则

1. **沙箱**：预览 iframe 永远不加 `allow-same-origin`。
2. **模型**：只调用 `DEEPSEEK_MODEL`（默认 `deepseek-flash`），Base URL `https://api.deepseek.com`，每个请求体注入 `thinking: {type: "disabled"}`。模型名、地址、Key 只从环境变量读。
3. **密钥**：API Key 只在服务端；不提交 `.env`、`data/`；日志不打印 Key 和提示词全文。
4. **生成物**：单文件 HTML；外部脚本只允许 `src/lib/vendor.ts` 白名单中的 Tailwind Browser 和 Chart.js，外部样式表只允许其中的像素字体（像素风主题）；原生 JS，无 module / 框架 / 网络请求。
5. **提示词**：只放在 `src/lib/agent/prompts/`，内容以 07 文档中的原文为准；改动提示词需同步更新 07。
6. **模型输出不可信**：所有 JSON 用 zod 校验；意图按 07 §2 规则修正；HTML 必须过静态检查。
7. **修复预算**：每个 turn 最多 2 轮修复；用尽则回退到最近 `ok` 版本，没有则提示重新生成。
8. **权限**：所有项目 / 版本接口校验访客归属，不属于则 404。
9. **行号稳定**：注入的 runtime 脚本不得引入换行（修复提示词依赖行号）。
10. **mock 优先测试**：E2E 一律在 `LLM_MOCK=1` 下跑；真实 Key 只用于冒烟脚本和手动验证。

## 4. 常用命令

```bash
npm run dev                 # 本地开发 http://localhost:3000
LLM_MOCK=1 npm run dev      # 无 Key 演示
npm run typecheck && npm run lint
npm test                    # 单元测试
npm run test:e2e            # E2E（自动以 LLM_MOCK=1 启动）
npm run db:generate         # 改 schema 后生成迁移
npm run smoke:llm           # 真实模型冒烟（需 Key）
npm run usage               # token 用量与费用汇总
docker compose up -d --build
```

## 5. 工作方式

- 严格按 [docs/12-tasks.md](docs/12-tasks.md) 的顺序做，每个任务满足完成标准后提交一次（Conventional Commits，英文）。
- 阶段 0 结束时必须已经部署到服务器，之后每个阶段都保持可演示。
- 每完成一个阶段，对照 [docs/13-test-acceptance.md](docs/13-test-acceptance.md) 跑一遍对应用例。
- 进度落后时按 12 文档末尾的"砍需求顺序"处理；不可砍项不能动。

## 6. 文档未覆盖时的决策原则

按优先级：
1. 选让主流程更稳的做法。
2. 选更简单、依赖更少的做法。
3. 与现有文档风格和已有代码保持一致。
4. 做出决定后，在 README"已知问题 / 设计说明"中写一句，不要停下来等确认。

需要人工处理、编码智能体无法完成的事项（如服务器 SSH 登录、填写真实 Key、DeepSeek 控制台设上限、录制 GIF、填写测评文档），在最终汇报中列为"待人工完成"清单。

## 7. 已核实的外部事实（2026-11-27）

- DeepSeek：模型名 `deepseek-flash`（旧名 `deepseek-v4-flash` 已转到同一模型，不用旧名）；OpenAI 格式 Base URL `https://api.deepseek.com`；支持 JSON Output；思考模式默认开启，通过 `thinking: {type: "disabled"}` 关闭；非高峰价格每百万 token 输入 $0.15（缓存命中 $0.003）、输出 $0.6，高峰时段（UTC 工作日 01:00–04:00、06:00–10:00）翻倍。来源：https://api-docs.deepseek.com/quick_start/pricing 、https://api-docs.deepseek.com/guides/thinking_mode/
- 服务器内存未知：假设 ≥ 2 GB；不足时按 [docs/10-deployment.md](docs/10-deployment.md) §6 加 swap 或本地 / CI 构建镜像。
