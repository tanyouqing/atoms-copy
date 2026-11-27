# Atoms Demo

用自然语言描述应用 → AI 团队（Mia 产品经理、Leo 工程师、Iris 测试员）生成单文件 HTML 应用 → 沙箱 iframe 实时预览。完整设计见 [CLAUDE.md](CLAUDE.md) 与 [docs/](docs/)。

> 当前进度：已完成 8 个配置驱动的应用模板及其基础设施（T1.2 + T6.1 的模板部分），工作台、生成流水线、部署尚未开始。完整 README 在 T7.1 按 [docs/14-readme-outline.md](docs/14-readme-outline.md) 编写。

## 本地运行

```bash
npm install
npm run dev                 # http://localhost:3000/dev/templates 模板画廊（仅开发环境）
npm test                    # 单元测试：schema、渲染、静态检查、srcdoc 组装
npm run verify:templates    # 浏览器自检：在沙箱 iframe 中逐个跑模板，截图输出到 .verify/
npm run typecheck && npm run lint
```

## 应用模板

| id | 名称 | 示例（`templates/<id>/example.json`） | 额外变体（`tests/fixtures/templates/`） |
|---|---|---|---|
| `todo` | 待办清单 | 习惯打卡（habit） | 任务模式英文深色、购物清单（checklist） |
| `ledger` | 记账本 | 家庭记账（预算 + 两种图表） | 英文深色旅行预算 |
| `form` | 表单收集 | 读书会报名（8 种字段 + 已收集页 + 导出 CSV） | 英文深色反馈表（单次提交） |
| `kanban` | 看板 | 招聘进度（5 列，WIP 上限） | 英文深色内容排期 |
| `landing` | 落地页 | 咖啡馆（emoji 网格 + 邮箱收集） | 英文深色 SaaS（手机外框 + 定价） |
| `dashboard` | 数据仪表盘 | 门店经营（折线/环形/柱状 + 可排序表格 + 编辑数据） | 英文深色健身数据 |
| `game` | 小游戏 | 记忆翻牌 | 猜数字、贪吃蛇、知识问答 |
| `crud` | 通用记录管理 | 书架（卡片/表格视图、筛选、排序、CSV 导入导出） | 英文深色客户名单 |

每个模板目录含 `template.html`（只有 `__APP_TITLE__`、`__APP_CONFIG__` 两个占位符）、`contract.ts.txt`（给模型看的配置契约）、`example.json`。配置的 zod schema 在 `src/lib/templates/schemas.ts`，渲染在 `src/lib/templates/render.ts`。

`npm run verify:templates` 对 19 个用例逐一检查：runtime 无报错、页面非空白、375px 无横向溢出（看板列区域除外）、典型交互后刷新数据仍在、清空存储后回到 seed 数据，并跑通各模板的关键交互（表单校验、看板拖拽与菜单换列、CSV 导入、仪表盘 JSON 编辑、三种游戏通关等）。

## 设计说明 / 已知问题

- **预览 iframe 增加 `allow-downloads`**：表单和记录管理模板的"导出 CSV"用 Blob + `a[download]`，沙箱不加这个标志时 Chrome 会拦截下载。它不涉及同源权限，`allow-same-origin` 仍然禁止。已同步更新 docs/04、docs/09。
- **仪表盘的存储结构**与其他模板不同：值为 `{ version, base, edited, metrics, charts }`，`base` 是配置数据的哈希。配置被追问修改后以新配置为准，否则"加一个指标"这类修改会被旧存储盖住。已写入 docs/08 §5.2。
- **记账本**：本月没有记录时默认打开最近一个有记录的月份，避免示例数据不在当月时首屏为空。
- **契约中没有写长度上限的字符串**（如落地页各区块文案）在 schema 里只做宽松上限（100 / 400 字），防止异常输出又不额外收紧模型。
- **vendor 版本**：Tailwind Browser 4.3.5、Chart.js 4.5.1，文件来自 npm 包，提交在 `public/vendor/`。存储的 HTML 中写 jsDelivr 地址，预览时替换为本站地址。
- **lint 命令**用 `eslint .`（Next 15.5 已不推荐 `next lint`），规则同 `next/core-web-vitals` + `next/typescript`。
- 看板拖拽在桌面浏览器使用 HTML5 拖放；手机上通过卡片的"⋯ → 移到"菜单换列。
