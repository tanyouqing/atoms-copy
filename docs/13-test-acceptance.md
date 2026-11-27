# 13 · 测试与验收清单

## 1. 测试分层

| 层 | 工具 | 运行环境 | 何时跑 |
|---|---|---|---|
| 单元 | vitest | Node，临时 SQLite（`:memory:` 或 tmp 文件） | 每个任务完成时 |
| 端到端 | Playwright（Chromium） | `LLM_MOCK=1`，`DATABASE_PATH=./data/test.db`，`next build && next start` | 阶段 2 起每个阶段结束时 |
| 真实模型冒烟 | `npm run smoke:llm` | 真实 Key | T1.1 和 T6.2 |
| 线上冒烟 | 手动 | 服务器 | 每次部署后 |

Playwright 配置：`webServer` 启动 `npm run build && npm run start`（env 中 `LLM_MOCK=1`、`PORT=3100`），`baseURL: http://localhost:3100`，运行前删除 `data/test.db`。

## 2. 单元测试必测用例

| 模块 | 用例 |
|---|---|
| `patch.ts` | 精确匹配单块；多块顺序依赖；缩进不同的宽松匹配；行尾空格；CRLF 文本；SEARCH 不唯一 → ambiguous；找不到 → not_found；空 REPLACE 删除；无法解析 → parse；任一失败则原文不变 |
| `extract.ts` | 带 ```json 围栏；JSON 前后有说明文字；嵌套大括号与字符串中的 `}`；HTML 带 ```html 围栏；无 DOCTYPE 只有 `<html`；无起点报错 |
| `qa-static.ts` | 合法 HTML 通过；缺 `</html>`；非白名单 script src；module 脚本；内联脚本语法错误且行号正确；`application/json` 脚本内容非法 |
| `build-srcdoc.ts` | 输出与输入行数相同；runtime 位于 `<head>` 同一行；vendor 地址被替换；快照中的 `</script>` 被转义 |
| 模板 | 8 个 `example.json` 通过 schema；渲染结果通过 `staticCheck`；渲染结果中不残留 `__APP_CONFIG__` / `__APP_TITLE__` |
| `normalizeIntent` | [07](07-agent-pipeline.md) §2 表格每一行 |
| `rate-limit.ts` | 访客上限、IP 上限、全站上限、24 小时窗口滑动、mock 模式不限流 |
| `sse-client.ts` | 一个 chunk 多事件；事件跨 chunk；忽略 `: ping` 注释行 |
| `workspaceReducer` | turn → message → message_update → version → done 后状态正确；error 后运行状态复位；select_version / back_to_current |
| `queries.ts` | seq 递增；`lastOkVersion` 排除指定版本；删除项目级联 |

## 3. E2E 用例（`tests/e2e/`，LLM_MOCK=1）

| 文件 | 场景 | 断言 |
|---|---|---|
| `01-create.spec.ts` | 首页点"习惯打卡"示例 | 跳转 `/p/`；依次出现 Mia、Leo、Iris 卡片；iframe 中出现应用标题；Iris 显示"检查通过" |
| `02-persist.spec.ts` | 在预览 iframe 中添加一条待办 → 刷新页面 | 对话卡片数量不变；iframe 中该待办仍在 |
| `03-config-edit.spec.ts` | 发送"把主色改成绿色" | 出现 v2 版本卡片，来源标签"配置"；代码 Tab 的配置 JSON 中 `primary` 为 `emerald` |
| `04-patch.spec.ts` | 发送"加一个导出按钮" | v3 来源"补丁"；iframe 中出现"导出"按钮 |
| `05-autofix.spec.ts` | 新建项目，需求含 `#broken` | Iris 卡片出现"发现 1 个问题，正在修复（第 1/4 轮）"；最终出现"已修复"，新版本来源"修复" |
| `06-rollback.spec.ts` | 在已有 ok 版本的项目中发送含 `#broken` 且 mock 修复也失败的需求（`#broken-hard`） | 最终显示"修复失败，已回退到 vX"；当前版本为 vX |
| `07-versions.spec.ts` | 点 v1 版本卡片 → 恢复 | 出现黄色提示条；恢复后系统消息"已恢复到 v1"；版本下拉中 v1 标"当前" |
| `08-share.spec.ts` | 打开分享弹窗，开启公开 → 新上下文（无 cookie）访问分享链接 | 分享页 iframe 渲染应用；关闭公开后返回 404 |
| `09-download.spec.ts` | 点下载 | 下载文件名以 `.html` 结尾；内容包含 CDN 地址且不包含 `__ATOMS__` |
| `10-isolation.spec.ts` | 访客 A 创建项目；访客 B（新上下文）访问 `/p/<id>` 和 `/api/projects/<id>` | 都是 404 |
| `11-stop.spec.ts` | 生成中点"停止" | 卡片显示"已停止"；没有新版本；输入框恢复可用 |
| `12-mobile.spec.ts` | 视口 390×844 走一遍 01 | 分段控件可切换；预览可见 |

mock 补充约定：`#broken-hard` 时 mock 的 fix 返回一个无法应用的补丁（SEARCH 不存在），用于测试修复失败与回退。

## 4. 真实模型冒烟需求（`scripts/smoke-llm.ts`）

每条记录：PM 选择的 intent/templateId、总耗时、token、静态检查结果。期望列为"合理结果"，不强制完全一致。

| # | 需求 | 期望模板 |
|---|---|---|
| 1 | 做一个每日喝水打卡应用，目标每天 8 杯 | todo（habit 或 task） |
| 2 | 帮我做一个记账本，记录日常开销，按类别看饼图 | ledger |
| 3 | 做一个公司年会报名表，收集姓名、部门、手机号、是否参加晚宴、饮食禁忌 | form |
| 4 | 做一个内容排期看板，列为选题、写作中、待审核、已发布 | kanban |
| 5 | 给我的咖啡店做一个介绍页，有菜单、营业时间和联系方式 | landing |
| 6 | 做一个跑步数据仪表盘，展示本月跑量、配速趋势和每周对比 | dashboard |
| 7 | 做一个中国历史知识问答小游戏，10 道题 | game（quiz） |
| 8 | 做一个番茄钟，25 分钟专注 5 分钟休息，有提示音 | null（自由生成） |

追加两条修改测试（在 #1 生成的项目上）：
- "把主色改成橙色，标题改成『喝水小助手』" → 期望 config_edit。
- "加一个按钮，可以把打卡记录导出成 CSV" → 期望 code_patch。

## 5. 线上冒烟（每次部署后，手动，约 5 分钟）

1. 无痕窗口打开 `http://<IP>`，首页加载 < 2 秒，无控制台报错。
2. 点一个示例，完整看到三个角色工作，得到可用应用。
3. 追问一次修改，得到 v2。
4. 刷新，全部恢复。
5. 开启分享，用手机打开分享链接。
6. 下载 HTML，本地双击打开可用。
7. `docker compose logs app --since 10m` 中无 error 级别日志（模型偶发超时除外）。

## 6. 验收总表（交付前逐项打勾）

### P0
- [ ] AC-1.1 ~ 1.5 首页
- [ ] AC-2.1 ~ 2.3、2.6 智能体卡片
- [ ] AC-3.1 ~ 3.5 预览
- [ ] AC-4.1 ~ 4.6 追问修改
- [ ] AC-7.1 ~ 7.4 持久化与项目管理
- [ ] AC-8.1 ~ 8.5 错误状态与限流

### 延展
- [ ] AC-2.4 ~ 2.5 自动修复与回退（E1）
- [ ] AC-5.1 ~ 5.4 版本时间线（E2）
- [ ] AC-6.1 ~ 6.5 分享与下载（E3、E4）
- [ ] 手动修复按钮（E5）
- [ ] AC-7.5 恢复码（E6）

### 质量
- [ ] `npm run typecheck`、`npm run lint`、`npm test`、`npm run test:e2e` 全部通过
- [ ] 真实模型冒烟 8 条中 ≥ 7 条成功
- [ ] 375px 宽度下首页、工作台、分享页无横向滚动
- [ ] Chrome、Safari（或手机 Safari）各验证一次预览中数据持久化

### 提交
- [ ] GitHub 仓库公开，`git log -p | grep -i "sk-"` 无结果，`.env` 未提交
- [ ] README 完整（见 14），包含在线链接、演示 GIF、取舍说明
- [ ] 在线链接用无痕窗口和手机各跑通一遍
- [ ] DeepSeek 控制台已设用量上限
- [ ] 测评文档副本（标题含姓名）已填写链接与仓库，权限公开
- [ ] AI 工具账单截图已附上（加分项）
