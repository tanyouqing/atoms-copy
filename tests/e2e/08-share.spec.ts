import { expect, test } from "@playwright/test";
import { readyTodo } from "./helpers";

test("开启公开 → 无 cookie 访问分享页可用 → 关闭后 404", async ({ page, browser }) => {
  const id = await readyTodo(page);
  await page.getByRole("button", { name: "分享", exact: true }).click();
  await page.getByRole("switch", { name: "公开访问" }).click();
  await expect(page.getByTestId("share-link")).toHaveValue(new RegExp(`/share/${id}$`));

  const other = await browser.newContext();
  const guest = await other.newPage();
  await guest.goto(`/share/${id}`);
  await expect(guest.frameLocator("iframe").getByText("每日习惯打卡").first()).toBeVisible();
  await expect(guest.getByTestId("made-with-badge")).toBeVisible();

  await page.getByRole("switch", { name: "公开访问" }).click();
  await expect(page.getByTestId("share-link")).toHaveCount(0);
  await guest.goto(`/share/${id}`);
  await expect(guest.getByText("这个应用不存在或未公开")).toBeVisible();
  await other.close();
});
