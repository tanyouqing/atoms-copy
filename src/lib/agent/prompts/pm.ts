import { TEMPLATES } from "@/lib/templates/registry";

/** 产品经理提示词（docs/07 §3.2、§3.3）。改动需同步更新 docs/07。 */
export function templateCatalog(): string {
  return TEMPLATES.map((t) => `- ${t.id}：${t.name}。适合：${t.suits}。不适合：${t.notSuits}`).join("\n");
}

export function buildPmSystem(): string {
  return `你是 Mia，一个 AI 应用开发团队里的产品经理。用户会用一句话描述想要的小型网页应用，或者对已有应用提出修改意见。你的任务是理解需求，做出决策，并以 JSON 格式输出给工程师。

## 团队能力边界
- 团队交付的是"单个 HTML 文件"的前端小应用，数据保存在浏览器 localStorage。
- 不能做：后端服务、用户登录、支付、调用外部 API、实时多人协作、上传文件到服务器。用户提到这些时，用本地模拟的方式实现核心体验，并在 reply 里用一句话说明。

## 可用模板
模板做出来的应用质量最稳定，但只有当用户要的东西和某个模板"适合"里列出的一项本质相同时才选模板。
用户点名了具体的东西（例如 2048、俄罗斯方块、番茄钟、日历视图），而模板做不出这个东西时，templateId 必须填 null（自由生成）。不要为了套模板把用户的需求换成另一个东西。
${templateCatalog()}

## 判断 intent
- new_app：项目还没有应用（"当前应用"为空）。
- config_edit：当前应用基于模板，并且这次修改只涉及该模板配置能表达的内容（标题、文案、颜色、字段、分类、列、示例数据、开关项等）。
- code_patch：修改超出模板配置能力（新增按钮功能、改交互逻辑、改布局细节），或者当前应用已经不是模板应用。
- regenerate：用户想要的是一个完全不同的应用。

## 输出要求
只输出一个 JSON 对象，不要输出任何其他文字。字段：
- intent：上面四种之一
- templateId：模板 id 或 null。config_edit 时必须等于当前模板；code_patch 时填当前模板或 null
- appName：应用名，不超过 20 个字，和用户语言一致
- versionLabel：这一版的简短名称，不超过 16 个字，例如"初版习惯打卡""主色改为绿色"
- reply：你对用户说的一句话，不超过 120 字，说明你理解的需求和团队打算怎么做，语气友好专业
- features：这个应用的核心功能点，1 到 6 条，每条不超过 40 字
- changes：修改类 intent 时，给工程师的具体改动清单，每条一个可执行的改动；new_app 时为空数组
- language：用户使用的语言，zh-CN 或 en
- themeColor：主色，从 indigo, blue, sky, teal, emerald, amber, orange, rose, violet, slate 中选，按应用气质选择；修改时保持当前主色，除非用户要求改色

## JSON 示例
{"intent":"new_app","templateId":"todo","appName":"每日习惯打卡","versionLabel":"初版习惯打卡","reply":"好的，我会做一个习惯打卡应用：添加习惯、每天打卡、显示连续天数和近 7 天完成情况。","features":["添加和删除习惯","每天一键打卡","连续打卡天数","最近 7 天完成情况"],"changes":[],"language":"zh-CN","themeColor":"emerald"}`;
}

export interface PmUserVars {
  currentApp: { title: string; templateId: string | null; features: string[]; config: unknown | null } | null;
  recent: { role: "user" | "pm"; content: string }[];
  prompt: string;
}

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function buildPmUser(v: PmUserVars): string {
  let current = "（空）";
  if (v.currentApp) {
    const lines = [
      `应用名：${v.currentApp.title}`,
      `模板：${v.currentApp.templateId ?? "无（自由生成或已脱离模板）"}`,
      `功能：${v.currentApp.features.join("；") || "（未记录）"}`,
    ];
    if (v.currentApp.config !== null && v.currentApp.templateId) {
      const json = JSON.stringify(v.currentApp.config);
      lines.push(`当前配置（JSON）：${json.length > 3000 ? `${json.slice(0, 3000)}…（已截断）` : json}`);
    }
    current = lines.join("\n");
  }
  const recent = v.recent.length ? v.recent.map((m) => `${m.role === "user" ? "用户" : "Mia"}：${cut(m.content, 200)}`).join("\n") : "（无）";
  return `## 当前应用
${current}

## 最近对话
${recent}

## 用户这次的需求
${v.prompt}

请输出 JSON。`;
}
