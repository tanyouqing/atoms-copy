import { expect, test } from "@playwright/test";
import { preview, readyTodo, send, waitIdle } from "./helpers";

test("加导出按钮走代码补丁，预览出现导出按钮", async ({ page }) => {
  await readyTodo(page);
  await send(page, "加一个导出按钮");
  const v2 = page.getByTestId("version-card").filter({ hasText: "v2" });
  await expect(v2).toContainText("补丁");
  await expect(preview(page).getByRole("button", { name: "导出" })).toBeVisible();
  await waitIdle(page);
  await expect(page.getByTestId("agent-card-engineer").last()).toContainText("修改了 1 处");
});
