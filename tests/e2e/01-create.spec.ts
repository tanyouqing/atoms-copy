import { expect, test } from "@playwright/test";
import { preview } from "./helpers";

test("首页点示例 → 三个角色依次工作 → 预览出现应用 → 检查通过", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "一句话，交付一个能用的应用" })).toBeVisible();
  await page.getByRole("button", { name: /习惯打卡/ }).click();
  await page.waitForURL(/\/p\/[\w-]+$/);
  await expect(page.getByTestId("agent-card-pm")).toBeVisible();
  await expect(page.getByTestId("agent-card-engineer")).toBeVisible();
  await expect(page.getByTestId("agent-card-qa")).toBeVisible();
  await expect(preview(page).getByText("每日习惯打卡").first()).toBeVisible();
  await expect(page.getByText("检查通过")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("agent-card-pm")).toContainText("模板：待办清单");
});
