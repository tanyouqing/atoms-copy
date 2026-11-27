/** 首页其他区块（模板墙等）把一条需求填进输入框，不直接提交，给用户留改的机会。 */
export const FILL_EVENT = "atoms:fill-prompt";

export function fillPrompt(text: string) {
  window.dispatchEvent(new CustomEvent<string>(FILL_EVENT, { detail: text }));
}
