import { describe, expect, it } from "vitest";
import { normalizeIntent, templateFitsPrompt } from "@/lib/agent/intent";

const tpl = { configJson: "{}" };
const detached = { configJson: null };

describe("normalizeIntent", () => {
  it("没有当前版本 → new_app（忽略模型输出）", () => {
    expect(normalizeIntent({ intent: "code_patch" }, null)).toBe("new_app");
    expect(normalizeIntent({ intent: "regenerate" }, null)).toBe("new_app");
  });
  it("config_edit 但已脱离模板 → code_patch", () => expect(normalizeIntent({ intent: "config_edit" }, detached)).toBe("code_patch"));
  it("new_app 但已有版本 → regenerate", () => expect(normalizeIntent({ intent: "new_app" }, tpl)).toBe("regenerate"));
  it("其他采用模型输出", () => {
    expect(normalizeIntent({ intent: "config_edit" }, tpl)).toBe("config_edit");
    expect(normalizeIntent({ intent: "code_patch" }, tpl)).toBe("code_patch");
    expect(normalizeIntent({ intent: "regenerate" }, detached)).toBe("regenerate");
  });
});

describe("templateFitsPrompt", () => {
  it("game 模板只接受四种玩法", () => {
    expect(templateFitsPrompt("game", "做一个 2048 小游戏")).toBe(false);
    expect(templateFitsPrompt("game", "俄罗斯方块")).toBe(false);
    expect(templateFitsPrompt("game", "做个贪吃蛇")).toBe(true);
    expect(templateFitsPrompt("game", "记忆翻牌游戏")).toBe(true);
    expect(templateFitsPrompt("game", "Python 知识问答")).toBe(true);
    expect(templateFitsPrompt("game", "猜数字")).toBe(true);
  });
  it("其他模板不受影响", () => {
    expect(templateFitsPrompt("todo", "做一个 2048 小游戏")).toBe(true);
  });
});
