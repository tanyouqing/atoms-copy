import { expect, test } from "@playwright/test";
import { startProject } from "./helpers";

test("生成中点停止：卡片显示已停止，没有新版本，输入框恢复", async ({ page }) => {
  await startProject(page, "做一个番茄钟 #broken");
  await expect(page.getByTestId("agent-card-engineer")).toBeVisible();
  await page.getByRole("button", { name: "停止" }).click();
  await expect(page.getByTestId("system-notice").filter({ hasText: "已停止" })).toBeVisible();
  await expect(page.locator("[data-status=stopped]").first()).toBeVisible();
  await expect(page.getByTestId("version-card")).toHaveCount(0);
  await expect(page.getByLabel("继续描述修改")).toBeEnabled();
});
