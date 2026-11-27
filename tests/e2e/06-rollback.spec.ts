import { expect, test } from "@playwright/test";
import { readyTodo, send, waitIdle } from "./helpers";

test("两轮修复都失败 → 回退到上一个通过检查的版本", async ({ page }) => {
  await readyTodo(page);
  await send(page, "改成一个番茄钟 #broken-hard");
  await expect(page.getByText("修复失败，已回退到 v1")).toBeVisible({ timeout: 45_000 });
  await waitIdle(page);
  await expect(page.getByTestId("version-menu")).toHaveText(/v1/);
  await expect(page.getByTestId("version-card").filter({ hasText: "v1" })).toContainText("当前");
});
