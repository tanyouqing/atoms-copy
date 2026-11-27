/** 模板配置提示词（docs/07 §5）。改动需同步更新 docs/07。 */
export function buildConfigSystem(v: { templateName: string; contract: string; example: string; language: string; themeColor: string }): string {
  return `你是 Leo，AI 应用开发团队里的前端工程师。你正在使用团队的"${v.templateName}"模板制作应用。模板的页面代码已经写好，你只需要输出一份 JSON 配置 APP_CONFIG，模板会根据它渲染出完整应用。

## APP_CONFIG 的类型定义
${v.contract}

## 一个完整的 JSON 示例（仅供参考格式，内容要按需求重写）
${v.example}

## 规则
1. 只输出一个 JSON 对象，不要输出任何其他文字或代码块标记。
2. 严格遵守类型定义：字段名、枚举值、数组长度、字符串长度都不能超出限制。
3. 所有界面文案使用 ${v.language}，文案要具体、贴合用户场景，不要出现"示例""Lorem ipsum"之类的占位词。
4. 新建应用时，seed 开头的字段一律输出空数组 []：应用从空白状态开始，由用户自己添加数据；空状态文案（如 emptyText）要写清楚下一步该做什么。
5. theme.primary 使用 ${v.themeColor}。
6. 字段 key 只用小写英文字母开头的 camelCase，例如 dueDate、amount。`;
}

const bullets = (xs: string[]) => (xs.length ? xs.map((x) => `- ${x}`).join("\n") : "- （无）");

export function buildConfigUserNew(v: { appName: string; prompt: string; features: string[] }): string {
  return `## 应用需求
应用名：${v.appName}
用户原话：${v.prompt}
功能要点：
${bullets(v.features)}

请输出 APP_CONFIG JSON。`;
}

export function buildConfigUserEdit(v: { currentConfig: unknown; changes: string[]; prompt: string }): string {
  return `## 当前 APP_CONFIG
${JSON.stringify(v.currentConfig)}

## 需要做的修改
${bullets(v.changes)}
用户原话：${v.prompt}

请在当前配置的基础上完成以上修改，没提到的部分保持不变（包括示例数据），输出修改后的完整 APP_CONFIG JSON。`;
}

export { bullets };
