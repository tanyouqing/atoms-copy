import { expect, test } from "@playwright/test";

test("访客 B 访问访客 A 的项目返回 404", async ({ page, browser }) => {
  const res = await page.request.post("/api/projects", { data: { prompt: "做一个待办" } });
  const { project } = (await res.json()) as { project: { id: string } };

  const other = await browser.newContext();
  const b = await other.newPage();
  await b.goto(`/p/${project.id}`);
  await expect(b.getByText("页面不存在")).toBeVisible();
  const api = await b.request.get(`/api/projects/${project.id}`);
  expect(api.status()).toBe(404);
  await other.close();
});
