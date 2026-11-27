import { expect, test } from "@playwright/test";
import { preview, readyTodo } from "./helpers";

test("预览中添加数据后刷新，对话与数据都还在", async ({ page }) => {
  await readyTodo(page);
  const app = preview(page);
  await app.getByPlaceholder(/添加习惯/).fill("E2E 持久化测试");
  await app.getByPlaceholder(/添加习惯/).press("Enter");
  await expect(app.getByText("E2E 持久化测试")).toBeVisible();
  const cards = await page.locator("[data-testid^=agent-card-]").count();
  await page.reload();
  await expect(page.locator("[data-testid^=agent-card-]")).toHaveCount(cards);
  await expect(preview(page).getByText("E2E 持久化测试")).toBeVisible();
});
