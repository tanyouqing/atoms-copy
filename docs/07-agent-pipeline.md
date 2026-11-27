# 07 · 智能体流水线与提示词

> 这是整个项目最核心的文档。核心思想：**只用 DeepSeek Flash 这种低成本模型时，用工程手段把模型需要自由发挥的部分压到最小**。四层兜底：模板优先、多步短输出、自动修复、补丁式修改。

## 1. 角色与步骤总览

| 步骤 | 角色 | 调用方式 | 输出 | temperature | maxOutputTokens | 超时 |
|---|---|---|---|---|---|---|
| `pm` | Mia · 产品经理 | `callJson` | `PmOutput` | 0.2 | 800 | 45s |
| `config` | Leo · 工程师 | `callJson` | 模板 `APP_CONFIG` | 0.3 | 4000 | 45s |
| `free` | Leo · 工程师 | `streamCode` | 完整 HTML | 0.5 | 16000 | 150s |
| `patch` | Leo · 工程师 | `streamCode` | SEARCH/REPLACE 块 | 0.1 | 6000 | 150s |
| `fix` | Leo（由 Iris 触发） | `streamCode` | SEARCH/REPLACE 块 | 0.1 | 6000 | 90s |
| 静态检查 | Iris · 测试员 | 本地代码 | `RuntimeError[]` | – | – | – |
| 运行时检查 | Iris · 测试员 | 浏览器 | `RuntimeError[]` | – | – | – |

## 2. 意图路由

PM 输出 `intent`，服务端再按下表**强制修正**（模型判断不可信时以规则为准）：

| 条件 | 最终 intent |
|---|---|
| 项目没有当前版本 | `new_app`（忽略模型输出） |
| 模型输出 `config_edit`，但当前版本 `config_json` 为 null（已脱离模板） | `code_patch` |
| 模型输出 `new_app` 但已有版本 | `regenerate` |
| 其他 | 采用模型输出 |

模板选择也会修正（`new_app` / `regenerate`），任一条件成立时 `templateId` 改为 null（自由生成）：
- PM 输出的 `unsupported` 不为空（用户要的功能里有模板做不到的）；
- 选了 `game`，但用户原话没有提到四种玩法（猜数字、记忆翻牌、贪吃蛇、问答测验）中的任何一种。

见 `src/lib/agent/intent.ts` 的 `templateFitsPrompt`。

各 intent 的工程师分支：

| intent | templateId | 工程师步骤 | 版本 source | 新版本 config_json |
|---|---|---|---|---|
| `new_app` / `regenerate` | 非 null | `config` → `renderTemplate` | `template` | 新配置 |
| `new_app` / `regenerate` | null | `free` | `free` | null |
| `config_edit` | 当前模板 | `config`（带当前配置） → `renderTemplate` | `config_edit` | 新配置 |
| `code_patch` | – | `patch` → `applyPatches`；失败重试 1 次；再失败走 `free`（带当前代码整页重写） | `patch`（整页重写时为 `free`） | null |

`regenerate` 时，新版本的 `parent_version_id` 仍指向当前版本（便于回滚），但内容与之无关。

### 2.1 风格路由（`src/lib/agent/style.ts`）

应用有三种内置风格（`paper` 暖纸墨色 / `pixel` 像素风 / `bright` 明亮卡片，见 [08-templates.md](08-templates.md) §2.3），也可以是"某个内置风格的形状 + 一套自定义颜色"（`custom`）。服务端用 `decideStyle` 决定本轮风格，**不依赖模型照抄**：

| 情况 | 本轮风格 |
|---|---|
| PM 输出 `style: "custom"` 且 `customTheme` 合法（用户在文字里描述了别的风格） | 自定义 |
| 新建 / 重新生成 | 用户在风格卡片上的选择（`/api/generate` 的 `style`）> PM 的内置风格 > `paper` |
| 修改 | PM 给出与当前不同的内置风格才换，否则保持当前（含自定义） |
| 工作台风格按钮（`styleOnly: true`） | 按钮选择 |

确定后：
- 模板应用：`applyStyle` 把 `theme.style` / `theme.custom` 写进配置再渲染。
- **只换风格的快速路径**：工作台按钮（`styleOnly`）或 PM 输出 `styleOnly: true` 且是模板应用的 `config_edit` 时，不调用 `config` 步骤，直接 `restyleConfig`（换 theme → 重新渲染），工程师消息"已切换为「X」"。按钮路径连 PM 也不调用、不计入限流，瞬间出新版本（`source=config_edit`）。
- 自由生成 / 已脱离模板的应用：新建时把 `styleSpec(style)`（`src/lib/agent/design-spec.ts`）拼进 §6.2 的提示词；修改时风格有变化，就把"换成 X 风格 + 风格说明"追加到 `changes`，交给 patch 步骤。
- 风格存在版本的 `plan_json`（`style` / `customTheme`）和模板配置的 `theme` 里，`styleOfVersion` 从这两处读回当前风格。

## 3. PM 步骤

### 3.1 输出 schema（`src/lib/agent/schemas.ts`）

```ts
import { z } from "zod";
import { TEMPLATE_IDS, THEME_COLORS } from "@/lib/templates/registry";

export const PmOutput = z.object({
  intent: z.enum(["new_app", "config_edit", "code_patch", "regenerate"]),
  templateId: z.enum(TEMPLATE_IDS).nullable(),     // null = 自由生成
  appName: z.string().min(1).max(20),
  versionLabel: z.string().min(1).max(16),
  reply: z.string().min(1).max(120),               // 对用户说的一句话
  features: z.array(z.string().max(40)).min(1).max(6),
  changes: z.array(z.string().max(80)).max(8),     // 修改类 intent 必填：给工程师的具体改动清单
  unsupported: z.array(z.string().max(60)).max(8).default([]), // 所选模板做不到的功能；不为空则改走自由生成
  language: z.enum(["zh-CN", "en"]),
  themeColor: z.enum(THEME_COLORS),
  // 风格（§2.1）。都可选，写错时 .catch(undefined) 丢弃而不是让整次输出失败，由服务端补齐
  style: z.enum(["paper", "pixel", "bright", "custom"]).optional().catch(undefined),
  customTheme: CustomThemeSchema.optional().catch(undefined),   // 见 08 §2.3
  styleOnly: z.boolean().optional().catch(undefined),           // 这次只换风格
});
export type PmOutput = z.infer<typeof PmOutput>;
```

`TEMPLATE_IDS = ["todo","ledger","form","kanban","landing","dashboard","game","crud"] as const`；
`THEME_COLORS = ["indigo","blue","sky","teal","emerald","amber","orange","rose","violet","slate"] as const`。

### 3.2 System 提示词（`src/lib/agent/prompts/pm.ts`）

`{{TEMPLATE_CATALOG}}` 由 registry 生成（每个模板一行：`- <id>：<名称>。适合：<适合>。不适合：<不适合>`，内容见 [08-templates.md](08-templates.md) §3 的"选择规则"列）。

```text
你是 Mia，一个 AI 应用开发团队里的产品经理。用户会用一句话描述想要的小型网页应用，或者对已有应用提出修改意见。你的任务是理解需求，做出决策，并以 JSON 格式输出给工程师。

## 团队能力边界
- 团队交付的是"单个 HTML 文件"的前端小应用，数据保存在浏览器 localStorage。
- 不能做：后端服务、用户登录、支付、调用外部 API、实时多人协作、上传文件到服务器。用户提到这些时，用本地模拟的方式实现核心体验，并在 reply 里用一句话说明。

## 可用模板
模板做出来的应用质量最稳定，但模板只能做"能做"里列出的东西。选模板前，把用户提到的每个功能和界面要求逐条对照"能做 / 做不到"：
- 全部都在"能做"范围内，才选这个模板；
- 只要有一条模板做不到（例如 2048、日历视图、计时器、数值累计统计），templateId 必须填 null（自由生成），并把做不到的功能写进 unsupported。
不要为了套模板删掉或替换用户要的功能。
{{TEMPLATE_CATALOG}}

## 判断 intent
- new_app：项目还没有应用（"当前应用"为空）。
- config_edit：当前应用基于模板，并且这次修改只涉及该模板配置能表达的内容（标题、文案、颜色、字段、分类、列、示例数据、开关项等）。
- code_patch：修改超出模板配置能力（新增按钮功能、改交互逻辑、改布局细节），或者当前应用已经不是模板应用。
- regenerate：用户想要的是一个完全不同的应用。

## 风格
所有模板都支持三种内置风格：
{{STYLE_CATALOG}}
- 新建应用时，style 使用"用户选择的风格"。
- 用户在需求文字里明确要了别的风格（例如"赛博朋克""森系""极简黑白""复古报纸色"），style 填 custom，并在 customTheme 里给出一套颜色：name 风格名（不超过 12 字）、base 形状基底（paper 柔和圆角 / pixel 硬边框像素 / bright 大圆角）、bg 页面背景、surface 卡片背景、text 主要文字、accent 强调色，颜色都写 #RRGGBB；可选 font（sans / serif / mono / pixel）。文字和背景要有足够对比度。
- 修改应用时保持当前风格，除非用户要求换风格。如果这次只是换风格、不改其他内容，styleOnly 填 true（模板应用 intent 用 config_edit）。
- 用户要的风格必须改变页面结构才能做到（例如"报纸式多栏排版""3D 立体场景"），颜色和字体表达不了时，新建应用的 templateId 填 null，并把风格要求写进 features。

## 输出要求
只输出一个 JSON 对象，不要输出任何其他文字。字段：
- intent：上面四种之一
- templateId：模板 id 或 null。config_edit 时必须等于当前模板；code_patch 时填当前模板或 null
- unsupported：new_app / regenerate 时，用户要求里所选模板做不到的功能，没有则为空数组；不为空时 templateId 必须是 null
- appName：应用名，不超过 20 个字，和用户语言一致
- versionLabel：这一版的简短名称，不超过 16 个字，例如"初版习惯打卡""主色改为绿色"
- reply：你对用户说的一句话，不超过 120 字，说明你理解的需求和团队打算怎么做，语气友好专业
- features：这个应用的核心功能点，1 到 6 条，每条不超过 40 字
- changes：修改类 intent 时，给工程师的具体改动清单，每条一个可执行的改动；new_app 时为空数组
- language：用户使用的语言，zh-CN 或 en
- themeColor：主色，从 indigo, blue, sky, teal, emerald, amber, orange, rose, violet, slate 中选，按应用气质选择；修改时保持当前主色，除非用户要求改色
- style：paper、pixel、bright 或 custom，规则见"风格"
- customTheme：只有 style 为 custom 时填写，否则省略
- styleOnly：这次只换风格时为 true，否则省略或 false

## JSON 示例
{"intent":"new_app","templateId":"todo","appName":"每日习惯打卡","versionLabel":"初版习惯打卡","reply":"好的，我会做一个习惯打卡应用：添加习惯、每天打卡、显示连续天数和近 7 天完成情况。","features":["添加和删除习惯","每天一键打卡","连续打卡天数","最近 7 天完成情况"],"changes":[],"unsupported":[],"language":"zh-CN","themeColor":"emerald","style":"paper"}

用户要求自定义风格时 customTheme 的示例：
{"name":"赛博朋克","base":"bright","bg":"#0b0b1a","surface":"#15152e","text":"#e6f1ff","accent":"#ff2bd6","font":"mono"}
```

`{{STYLE_CATALOG}}` 由 `STYLE_META` 生成（每种风格一行：`- <id>：<名称>，<描述>`）。

### 3.3 User 提示词

```text
## 当前应用
{{CURRENT_APP}}

## 最近对话
{{RECENT_MESSAGES}}

## 用户这次的需求
{{PROMPT}}

## 用户选择的风格        ← 仅新建时用户选了风格卡片，或工作台风格按钮（自由生成应用）时出现
{{PICKED_STYLE}}         （如 "pixel（像素风）"）

请输出 JSON。
```

- `{{CURRENT_APP}}`：无当前版本时为"（空）"。有时为：
  ```
  应用名：<project.title>
  模板：<templateId 或 "无（自由生成或已脱离模板）">
  功能：<plan.features 用 "；" 连接>
  当前配置（JSON）：<config_json，最多 3000 字符，超出截断并注明>   ← 仅模板版本
  当前风格：<"bright（明亮卡片）" 或 "custom：赛博朋克">                ← 能读出风格时
  ```
- `{{RECENT_MESSAGES}}`：最近 6 条 user 消息和 pm 消息的 content，格式 `用户：…` / `Mia：…`，每条最多 200 字。无则"（无）"。

### 3.4 PM 之后服务端做的事

1. 按 §2 修正 intent。
2. 若为 `new_app`/`regenerate` 且 `templateId` 非 null，但需求里出现明显的自由生成信号（模型可能误选），**不做额外判断**，信任模型。
3. 更新 PM 消息：`status=done`，`content=reply`，`meta=PmOutput`。
4. 首轮且 `title_locked=0`：`projects.title = appName`，发 `project` 事件。

## 4. `callJson`：结构化输出的统一封装（`src/lib/llm/call.ts`）

```ts
async function callJson<T>(opts: {
  step: "pm" | "config";
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
  signal: AbortSignal;            // 请求的 abort signal
  ctx: { projectId: string; turnId: string };
}): Promise<T>
```

算法：
1. `signal = AbortSignal.any([opts.signal, AbortSignal.timeout(timeoutMs)])`。
2. 调用 `generateObject({ model, schema, system, prompt, temperature, maxOutputTokens, abortSignal: signal, maxRetries: 2 })`。（`maxRetries` 处理网络错误、429、5xx，SDK 自带指数退避。）
3. 成功 → 记录 `llm_calls`（usage 从结果读取）→ 返回。
4. 捕获 `NoObjectGeneratedError` 或 zod 错误：取原始文本 `err.text`，用 `extractJson(text)` 提取（去掉 ```json 围栏，取第一个 `{` 到与之匹配的最后一个 `}`），`JSON.parse` 后 `schema.safeParse`。成功则返回。
5. 仍失败 → 第 2 次尝试：在 prompt 末尾追加
   ```text
   
   你上一次的输出没有通过校验，错误如下：
   {{ZOD_ISSUES}}（最多 5 条，格式 "path: message"）
   请只输出修正后的完整 JSON 对象。
   ```
6. 再失败 → 抛出 `AppError("LLM_BAD_OUTPUT")`。
7. 超时 → `AppError("LLM_TIMEOUT")`；用户取消 → `AppError("ABORTED")`（内部码，不发 error 事件，按"已停止"处理）；其他 API 错误 → `AppError("LLM_ERROR")`。

> 实现说明：实际代码用 `generateText` + `response_format: json_object`（`deepseekFetch` 对非流式请求补上）+ `extractJson` + zod 校验实现上述算法，没有用 `generateObject`（模板 schema 含 refine/default，转 JSON Schema 不可靠）。重试语义不变，见 README"设计说明"。

实现时第一次联调需打印一次实际请求体，确认 `response_format` 为 `{"type":"json_object"}` 且含 `thinking: {type: "disabled"}`。若 SDK 未发送 `response_format`，在 `deepseekFetch` 中对没有 `stream: true` 且没有 `response_format` 的请求补上 `response_format: { type: "json_object" }`。

## 5. 模板配置步骤（`config`）

### 5.1 System 提示词（`src/lib/agent/prompts/config.ts`）

`{{CONTRACT}}` 是该模板的配置说明（[08-templates.md](08-templates.md) §4 中对应模板的 TypeScript 类型定义原文，存放在 `templates/<id>/contract.ts.txt`）；`{{EXAMPLE}}` 是 `templates/<id>/example.json` 的内容。

```text
你是 Leo，AI 应用开发团队里的前端工程师。你正在使用团队的"{{TEMPLATE_NAME}}"模板制作应用。模板的页面代码已经写好，你只需要输出一份 JSON 配置 APP_CONFIG，模板会根据它渲染出完整应用。

## APP_CONFIG 的类型定义
{{CONTRACT}}

## 一个完整的 JSON 示例（仅供参考格式，内容要按需求重写）
{{EXAMPLE}}

## 规则
1. 只输出一个 JSON 对象，不要输出任何其他文字或代码块标记。
2. 严格遵守类型定义：字段名、枚举值、数组长度、字符串长度都不能超出限制。
3. 所有界面文案使用 {{LANGUAGE}}，文案要具体、贴合用户场景，不要出现"示例""Lorem ipsum"之类的占位词。
4. 新建应用时，seed 开头的字段一律输出空数组 []：应用从空白状态开始，由用户自己添加数据；空状态文案（如 emptyText）要写清楚下一步该做什么。
5. theme.primary 使用 {{THEME_COLOR}}。
6. 字段 key 只用小写英文字母开头的 camelCase，例如 dueDate、amount。
7. theme.style 和 theme.custom（风格）由系统根据用户选择填写：新建时省略，修改时照抄当前值。
```

### 5.2 User 提示词

新建（`new_app`/`regenerate`）：

```text
## 应用需求
应用名：{{APP_NAME}}
用户原话：{{PROMPT}}
功能要点：
{{FEATURES}}  （每行 "- " 开头）

请输出 APP_CONFIG JSON。
```

修改（`config_edit`）：

```text
## 当前 APP_CONFIG
{{CURRENT_CONFIG}}

## 需要做的修改
{{CHANGES}}  （每行 "- " 开头）
用户原话：{{PROMPT}}

请在当前配置的基础上完成以上修改，没提到的部分保持不变（包括示例数据），输出修改后的完整 APP_CONFIG JSON。
```

### 5.3 之后

`schema` 用该模板的 zod schema（`src/lib/templates/schemas.ts`）。校验通过 → `applyStyle(config, style)`（§2.1）→ `renderTemplate(templateId, config)` → 静态检查（§9）→ 入库。工程师消息 `kind=engineer_config`，`meta={templateId, config}`。

## 6. 自由生成步骤（`free`）

### 6.1 System 提示词（`src/lib/agent/prompts/free.ts`）

`{{DESIGN_SPEC}}` 和 `{{SNIPPETS}}` 来自 `src/lib/agent/design-spec.ts`，原文见 [08-templates.md](08-templates.md) §2。`{{TAILWIND_CDN}}`、`{{CHARTJS_CDN}}` 来自 `src/lib/vendor.ts`。

```text
你是 Leo，AI 应用开发团队里的资深前端工程师。请根据需求写一个完整、可直接运行的单文件网页应用。

## 技术约束（必须全部遵守）
1. 输出一个完整的 HTML 文档，从 <!DOCTYPE html> 开始，到 </html> 结束。
2. 样式只用 Tailwind CSS，通过 <script src="{{TAILWIND_CDN}}"></script> 引入，放在 <head> 里。需要自定义样式时写在 <style type="text/tailwindcss"> 里。
3. 需要图表时只能用 Chart.js：<script src="{{CHARTJS_CDN}}"></script>。除这两个以外，不要引用任何外部脚本、样式、字体或图片。
4. 逻辑使用原生 JavaScript，写在 <body> 末尾的一个 <script> 标签里。不要用 type="module"、import、JSX、React、Vue 或 jQuery。
5. 数据用 localStorage 持久化，键名统一以 "app:" 开头。读写都要用 try/catch 包裹，JSON 解析失败时回退到默认数据。
6. 不要调用 fetch、XMLHttpRequest 或任何网络接口。用户自己录入的数据（任务、记录、打卡等）初始为空，不要预置示例数据，用友好的空状态提示引导用户添加第一条。
7. 图标使用 emoji 或内联 SVG。
8. 必须包含 <meta name="viewport" content="width=device-width, initial-scale=1">，布局在 375px 宽的手机上也要可用。
9. 代码总长度控制在 30000 字符以内。不要写注释性的大段说明。
10. 所有 DOM 操作在脚本执行时元素已经存在（脚本放在 body 末尾），不要依赖 DOMContentLoaded 之外的时机。
11. 不要使用 alert 作为主要交互反馈，用页面内的提示条。

## 设计规范
{{DESIGN_SPEC}}

## 组件片段（可直接复用并按需修改）
{{SNIPPETS}}

## 输出格式
只输出 HTML 代码本身，不要输出解释，不要使用 ``` 代码块标记。
```

### 6.2 User 提示词

新建：

```text
## 应用需求
应用名：{{APP_NAME}}
界面语言：{{LANGUAGE}}
主色：Tailwind 的 {{THEME_COLOR}} 色系（主按钮用 {{THEME_COLOR}}-600，浅色背景用 {{THEME_COLOR}}-50）
用户原话：{{PROMPT}}
功能要点：
{{FEATURES}}

## 风格（优先于设计规范里的颜色、字体、圆角和阴影）
{{STYLE_SPEC}}

请输出完整 HTML。
```

`{{STYLE_SPEC}}` 由 `styleSpec(style)`（`src/lib/agent/design-spec.ts`）生成，内容与 [08-templates.md](08-templates.md) §2.3 的主题变量一致（像素风会给出唯一允许的像素字体样式表地址）。System 提示词技术约束第 3 条相应写为"除这两个以外（以及"风格"里给出的像素字体样式表），不要引用任何外部脚本、样式、字体或图片"。

整页重写（补丁失败后的降级，或 `code_patch` 回退）：

```text
## 当前代码
{{CURRENT_HTML}}

## 需要做的修改
{{CHANGES}}
用户原话：{{PROMPT}}

请在当前代码基础上完成以上修改，保留其他所有功能、数据结构和 localStorage 键名不变，输出修改后的完整 HTML。
```

### 6.3 流式与截断处理（`streamCode`）

1. `streamText({ model, system, prompt, temperature, maxOutputTokens, abortSignal })`。
2. 每收到增量：累加到 `buffer`；节流（每 100ms 合并一次）发送 `code_delta` 事件；每 1 秒更新一次工程师消息的 `content`（"正在编写代码… 已写 3.2k 字符"，只发 SSE，不写库）。
3. 结束后 `extractHtml(buffer)`：
   - 去掉开头的 ```html / ``` 和结尾的 ```。
   - 起点：第一个 `<!DOCTYPE`（不区分大小写），没有则第一个 `<html`。没有起点 → `LLM_BAD_OUTPUT`。
   - 终点：最后一个 `</html>`（含）。
4. 没有 `</html>` 且 `finishReason === "length"`：续写 1 次。新请求同一 system，user 为：
   ```text
   你上一次输出的 HTML 在中途被截断了，截断前的最后一部分是：
   <<<
   {{LAST_1500_CHARS}}
   >>>
   请从截断处紧接着继续输出剩余代码，直到 </html>。不要重复已经输出的内容，不要输出任何解释。
   ```
   拼接时若续写开头与 buffer 末尾有重叠（续写的前 N 个字符等于 buffer 的后 N 个字符，N 从 200 往下试到 10），去掉重叠部分。续写后仍无 `</html>` → `LLM_TRUNCATED`。
5. 没有 `</html>` 但 `finishReason !== "length"`：在末尾补 `</body></html>` 中缺失的部分后交给静态检查。

## 7. 补丁步骤（`patch`）

### 7.1 补丁格式

```
<<<<<<< SEARCH
（从当前代码中逐字复制的连续若干行）
=======
（替换后的内容）
>>>>>>> REPLACE
```

### 7.2 System 提示词（`src/lib/agent/prompts/patch.ts`）

```text
你是 Leo，AI 应用开发团队里的前端工程师。你要对一个已有的单文件网页应用做局部修改。不要重写整个文件，而是输出若干个 SEARCH/REPLACE 修改块。

## 修改块格式
<<<<<<< SEARCH
要被替换的原代码
=======
替换后的新代码
>>>>>>> REPLACE

## 规则
1. SEARCH 部分必须从当前代码中逐字复制，包括缩进和空格，必须是连续的完整行。
2. SEARCH 部分要足够短但在整个文件中唯一，一般 3 到 15 行。不要包含与本次修改无关的大段代码。
3. 一个修改点一个块，块之间按代码中出现的顺序排列。多个块的 SEARCH 不能重叠。
4. 要在某处插入新代码时，SEARCH 选取插入位置附近的几行，REPLACE 中原样保留这几行并加上新代码。
5. 要删除代码时，REPLACE 部分留空。
6. 保持原有技术约束：只用 Tailwind 和原生 JavaScript，数据用 localStorage（键名以 "app:" 开头，已有键名不要改），不要引入新的外部依赖（Chart.js 除外，地址必须是 {{CHARTJS_CDN}}）。
7. 只输出修改块，不要输出任何解释或代码块标记。
```

### 7.3 User 提示词

```text
## 当前代码
{{CURRENT_HTML}}

## 需要做的修改
{{CHANGES}}
用户原话：{{PROMPT}}

请输出 SEARCH/REPLACE 修改块。
```

### 7.4 补丁解析与应用（`src/lib/agent/patch.ts`）

```ts
type Patch = { search: string; replace: string };
type ApplyResult =
  | { ok: true; html: string; applied: number }
  | { ok: false; failures: { index: number; reason: "not_found" | "ambiguous" | "parse" }[] };

export function parsePatches(text: string): Patch[];
export function applyPatches(html: string, patches: Patch[]): ApplyResult;
```

- 解析正则：`/<<<<<<< SEARCH\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n?>>>>>>> REPLACE/g`。一个块都解析不出 → `failures=[{index:0, reason:"parse"}]`。
- 逐块按顺序应用到不断更新的文档上：
  1. **精确匹配**：`search` 在文档中出现次数。=1 → 替换；>1 → `ambiguous`。
  2. **宽松匹配**（精确为 0 次时）：把文档和 search 都按行切分，每行 `trim()` 后比较，寻找连续窗口。唯一 → 用原文档中对应的行区间替换；>1 → `ambiguous`；0 → `not_found`。
- 任一块失败 → 整体失败（不部分应用）。
- 必须有单元测试覆盖：精确、宽松（缩进不同、行尾空格）、不唯一、找不到、空 replace（删除）、多个块顺序依赖、CRLF。

### 7.5 失败处理

1. 第 1 次失败：重试 `patch` 一次，user 提示词末尾追加：
   ```text
   
   你上一次输出的修改块无法应用：
   {{FAILURES}}  （每行 "- 第 N 个块：SEARCH 内容在代码中找不到" 或 "…出现了多次，请多包含几行使其唯一" 或 "格式无法解析"）
   请重新输出全部修改块，确保 SEARCH 部分逐字复制自当前代码。
   ```
2. 第 2 次仍失败：走 §6 的"整页重写"，工程师消息 `meta.fallback = "rewrite"`，content 末尾加"（局部修改未成功，已整页重写）"。
3. 补丁成功后的 HTML 同样经过静态检查。

## 8. 修复步骤（`fix`）

### 8.1 System 提示词（`src/lib/agent/prompts/fix.ts`）

与 §7.2 相同的格式规则，开头换成：

```text
你是 Leo，AI 应用开发团队里的前端工程师。测试员 Iris 在运行应用时发现了报错，你需要用最小的修改修复它们。不要重写整个文件，而是输出若干个 SEARCH/REPLACE 修改块。修复时不要删除功能，不要改变界面设计。
```

### 8.2 User 提示词

```text
## 当前代码
{{CURRENT_HTML}}

## 测试员发现的问题
{{ERRORS}}

## 报错位置附近的代码（带行号，仅供定位，SEARCH 中不要包含行号）
{{EXCERPTS}}

请输出 SEARCH/REPLACE 修改块来修复以上问题。
```

- `{{ERRORS}}`：每条 `- [type] message（第 line 行，第 col 列）`，最多 5 条，去重（按 message）。
- `{{EXCERPTS}}`：对每个带 `line` 的报错，取 `line-8` 到 `line+8` 行，每行格式 `  123 | 代码`；多个区间重叠时合并。没有行号时为"（无行号信息）"。
- 行号可靠的前提：注入的 runtime 脚本插入在 `<head>` 同一行内且不含换行（见 [09-preview-runtime.md](09-preview-runtime.md) §3），因此 iframe 报告的行号与存储的 HTML 行号一致。

### 8.3 修复失败

补丁应用失败重试 1 次（同 §7.5 第 1 步）；仍失败则本轮修复失败，发 `error`（`PATCH_FAILED`），客户端视为该轮已用，按预算决定下一轮或放弃。**修复不走整页重写**（整页重写容易引入新问题）。

## 9. 静态检查（`src/lib/agent/qa-static.ts`）

```ts
export function staticCheck(html: string): RuntimeError[]   // 空数组 = 通过
```

检查项（每项失败产生一条 `type: "static"` 的错误，message 用中文，供修复提示词使用）：

1. 包含 `<html`、`<body`、`</html>`（不区分大小写）。
2. 长度 ≤ 80000 字符。
3. 所有 `<script src="…">` 的地址都在 `vendor.ts` 的白名单（精确等于 CDN 地址）。不在白名单 → "不允许引用外部脚本：<src>"。
4. 不存在 `<link rel="stylesheet" href="http…">` 外链样式。
5. 不存在 `type="module"` 的脚本。
6. 每个内联脚本（无 `type` 或 `type="text/javascript"`）：`new vm.Script(code, { filename: "inline.js" })`。`SyntaxError` → message "脚本语法错误：<err.message>"，line = 该脚本在文档中的起始行 + 报错行 - 1（报错行从 `err.stack` 中 `inline.js:(\d+)` 解析）。
7. `type="text/tailwindcss"` 和 `type="application/json"` 的脚本跳过；`application/json` 内容需 `JSON.parse` 成功。

静态检查失败的处理：若本 turn 修复预算有剩余，服务端立即执行一轮 `fix`（错误列表即静态错误），`fixRoundsUsed += 1`，修复后再检查；预算用尽仍失败 → 版本以 `status=error` 入库，QA 消息 outcome=`failed`（若存在 ok 版本则回退，同 `give_up` 逻辑）。

## 10. 服务端 turn 编排（`src/lib/agent/pipeline.ts`）

伪代码（`emit` 发 SSE 事件；`msg.*` 写库并同时发 `message`/`message_update`）：

```ts
export async function runTurn(ctx: TurnCtx, emit: Emit) {
  const { project, current, prompt, signal } = ctx;
  let fixRoundsUsed = 0;

  // 0. 工作台风格按钮 + 模板应用：不调用模型，直接换 theme 出新版本（§2.1）
  if (ctx.styleOnly && ctx.style && canRestyle) return restyleTurn(...);

  // 1. PM
  const pmMsg = msg.start("pm", "pm_plan", "正在分析需求…");
  const pm = await callJson({ step: "pm", schema: PmOutput, ... });
  const intent = normalizeIntent(pm, current);           // §2
  const style = decideStyle({ pm, picked: ctx.style, current: styleOfVersion(...), isNew });   // §2.1
  if ((pm.styleOnly || ctx.styleOnly) && intent === "config_edit" && canRestyle && styleChanged) return restyle(...);
  msg.done(pmMsg, { content: pm.reply, meta: { ...pm, intent } });
  if (isFirstTurn && !project.titleLocked) updateTitle(pm.appName) && emit project;

  // 2. Engineer
  let html: string, source: Source, templateId: string | null = null, config: unknown = null;
  if ((intent === "new_app" || intent === "regenerate") && pm.templateId) {
    const m = msg.start("engineer", "engineer_config", "正在填写应用配置…");
    config = await callJson({ step: "config", schema: templateSchemas[pm.templateId], ... });
    html = renderTemplate(pm.templateId, config); templateId = pm.templateId; source = "template";
    msg.done(m, { content: "已生成应用配置", meta: { templateId, config } });
  } else if (intent === "config_edit") {
    // 同上，提示词用"修改"版本，source = "config_edit"
  } else if (intent === "code_patch") {
    const m = msg.start("engineer", "engineer_patch", "正在修改代码…");
    const r = await patchWithRetry(current.html, pm, prompt);   // §7.5，内部可能降级为整页重写
    html = r.html; source = r.rewritten ? "free" : "patch";
    msg.done(m, { content: r.rewritten ? "…（局部修改未成功，已整页重写）" : `修改了 ${r.applied} 处`, meta: {...} });
  } else {
    const m = msg.start("engineer", "engineer_code", "正在编写代码…");
    html = await streamCode({ step: "free", ... , onDelta: (t) => emit({ type: "code_delta", text: t }) });
    source = "free";
    msg.done(m, { content: `已完成代码编写（${fmtK(html.length)} 字符）`, meta: { chars: html.length } });
  }

  // 3. 静态检查（Iris）
  let errors = staticCheck(html);
  while (errors.length && fixRoundsUsed < 2) {
    const qa = msg.start("qa", "qa_report", `发现 ${errors.length} 个问题，正在修复（第 ${fixRoundsUsed + 1}/${FIX_BUDGET} 轮）`,
                         { phase: "static", errors, round: fixRoundsUsed + 1, outcome: "fixing" });
    html = await fixOnce(html, errors);      // 失败抛错 → 本轮记为已用并跳出
    fixRoundsUsed++; msg.done(qa);
    errors = staticCheck(html);
  }

  // 4. 入库
  const version = createVersion({ html, source, templateId, config, plan: pm, label: pm.versionLabel,
                                  status: errors.length ? "error" : "pending", errors });
  emit({ type: "version", version, message: msg.system("version", ...) });
  msg.start("qa", "qa_report", "正在检查运行情况…", { phase: "runtime", errors: [], round: fixRoundsUsed, outcome: "fixing" },
            { versionId: version.id });     // 客户端 QA 完成后通过 /status 更新这条消息
  emit({ type: "done", turnId, versionId: version.id, fixRoundsUsed });
}
```

异常处理（`runTurn` 外层 try/catch）：
- `ABORTED`：所有 running 消息置 `stopped`；插入 system notice "已停止"；不发 error，直接结束流。
- `AppError`：当前 running 的智能体消息置 `error`，content 为错误文案；插入 system `error` 消息（meta `{code, retryable}`）；发 `error` 事件。
- 未知异常：记日志，按 `INTERNAL` 处理。
- `finally`：释放锁。

## 11. 客户端 QA 与自动修复（`src/hooks/useAutoFix.ts`）

状态：`{ turnId, versionId, roundsUsed, phase: "idle" | "checking" | "fixing" | "done" }`。

1. 收到 `done` 事件且 `versionId` 非空：`roundsUsed = fixRoundsUsed`，`phase = "checking"`，预览切换到新版本。
2. 等待 iframe 的 `atoms:ready` 消息（[09-preview-runtime.md](09-preview-runtime.md) §4），最长 25 秒。超时视为一条错误 `{type:"error", message:"页面加载超时（25 秒内没有完成渲染）"}`。
3. 合并 ready 中带的 `errors` 和此前收到的 `atoms:error`，过滤噪声（message 包含 `ResizeObserver loop`、`Script error.` 且无行号的条目丢弃）。
4. ready 中 `blank === true`（页面几乎为空）也算一条错误 "页面渲染后内容为空"。
5. 无错误 → `POST /api/versions/:id/status { status: "ok", qa: { turnId, outcome: "pass", round: roundsUsed } }` → `phase="done"`。
6. 有错误且 `roundsUsed < 2` → `phase="fixing"` → 调用 `POST /api/fix { round: roundsUsed + 1, ... }`（走同一个 `useGeneration` SSE 处理逻辑）→ 收到新 `done` 后回到第 1 步。
7. 有错误且 `roundsUsed >= 2`，或 fix 接口返回 error → `POST /api/versions/:id/status { status: "error", errors, qa: { outcome: "give_up", round } }`；若响应带 `currentVersion`，切换预览到它，toast "已回退到 v{seq}"。

`turn` 结束（第 5 或第 7 步完成）前输入框保持禁用。

## 12. LLM_MOCK 模式（`src/lib/llm/mock.ts`）

`LLM_MOCK=1` 时：
- `callJson("pm")`：根据 prompt 关键词返回固定 `PmOutput`：含"看板"→ kanban；"记账"→ ledger；"游戏/翻牌"→ game；"改成绿色/改色"→ config_edit（themeColor=emerald）；"导出"→ code_patch；其他 → todo。风格：新建时回显用户选择的风格；已有应用且提示词含"换成/风格"和"像素/明亮/纸墨"→ `styleOnly` 的 config_edit；含"赛博朋克"→ `style: "custom"` 加一套示例颜色。
- `callJson("config")`：返回 `templates/<id>/example.json`（config_edit 时把 theme.primary 改成 PM 的 themeColor）。
- `streamCode("free")`：分 20 段、每段间隔 50ms 输出 `tests/fixtures/llm/free.html`。
- `streamCode("patch")`：返回 `tests/fixtures/llm/patch.txt`（在 `</body>` 前插入一个"导出"按钮的补丁；针对模板渲染结果设计，SEARCH 为 `</body>` 那一行）。
- `streamCode("fix")`：返回一个删除 `tests/fixtures/llm/broken.html` 中错误行的补丁。
- 提示词中含 `#broken`（仅 mock 模式）时：PM 返回 `templateId: null`（自由生成；已有版本时 intent 为 `regenerate`），工程师输出 `tests/fixtures/llm/broken.html`。该文件能通过静态检查，但脚本中有一行 `undefinedFunctionCall();`（单独一行）会在运行时抛 `ReferenceError`。mock 的 fix 返回删除这一行的补丁。
- 提示词中含 `#broken-hard` 时：同上，但 mock 的 fix 返回 SEARCH 内容不存在的补丁（必然失败），用于测试"修复失败 → 回退"。判断时先匹配 `#broken-hard` 再匹配 `#broken`。
- 每次 mock 调用人为延迟 300ms，便于看清卡片状态。

## 13. 成本估算（写入 README）

以模板路径为例：PM 输入约 1.5k token、输出约 0.2k；配置输入约 2.5k、输出约 1k。合计约 4k 输入 + 1.2k 输出 ≈ $0.0006 + $0.0007 ≈ **$0.0013/次**（非高峰价）。自由生成约 3k 输入 + 8k 输出 ≈ **$0.005/次**。`scripts/usage-report.ts` 从 `llm_calls` 汇总实际用量与费用。
