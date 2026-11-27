import { expect, test } from "@playwright/test";
import { startProject } from "./helpers";

test("运行时报错 → 测试员发现问题 → 工程师修复 → 新版本来源为修复", async ({ page }) => {
  await startProject(page, "做一个番茄钟 #broken");
  await expect(page.getByText("发现 1 个问题，正在修复（第 1/2 轮）")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/已修复，检查通过/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("version-card").filter({ hasText: "v2" })).toContainText("修复");
});
