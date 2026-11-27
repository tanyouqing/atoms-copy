import { expect, test } from "@playwright/test";
import { preview } from "./helpers";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test("手机宽度：分段控件切换对话 / 预览", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /习惯打卡/ }).click();
  await page.waitForURL(/\/p\//);
  await expect(page.getByTestId("agent-card-qa")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("tab", { name: "预览" }).click();
  await expect(preview(page).getByText("每日习惯打卡").first()).toBeVisible();
  await page.getByRole("tab", { name: "对话" }).click();
  await expect(page.getByText("检查通过")).toBeVisible({ timeout: 30_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
