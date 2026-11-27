import { expect, test } from "@playwright/test";
import { readyTodo, send, waitIdle } from "./helpers";

test("改主色走配置修改，产生 v2，配置 JSON 中 primary 为 emerald", async ({ page }) => {
  await readyTodo(page);
  await send(page, "把主色改成绿色");
  const v2 = page.getByTestId("version-card").filter({ hasText: "v2" });
  await expect(v2).toBeVisible();
  await expect(v2).toContainText("配置");
  await waitIdle(page);
  await page.getByRole("tab", { name: "代码" }).click();
  await page.getByRole("button", { name: "配置 JSON" }).click();
  await expect(page.getByTestId("code-view")).toContainText('"primary": "emerald"');
});
