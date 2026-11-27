import { expect, test } from "@playwright/test";
import { readyTodo, send, waitIdle } from "./helpers";

test("查看旧版本并恢复", async ({ page }) => {
  await readyTodo(page);
  await send(page, "把主色改成绿色");
  await expect(page.getByTestId("version-card").filter({ hasText: "v2" })).toBeVisible();
  await waitIdle(page);
  await page.getByTestId("version-card").filter({ hasText: "v1" }).click();
  await expect(page.getByTestId("viewing-banner")).toContainText("正在查看 v1");
  await page.getByRole("button", { name: "恢复此版本" }).click();
  await expect(page.getByTestId("system-notice").filter({ hasText: "已恢复到 v1" })).toBeVisible();
  await expect(page.getByTestId("viewing-banner")).toHaveCount(0);
  await page.getByTestId("version-menu").click();
  await expect(page.getByRole("button", { name: /v1.*·.*当前/ })).toBeVisible();
});
