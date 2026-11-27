import { expect, type Page } from "@playwright/test";

export const preview = (page: Page) => page.frameLocator('iframe[title="应用预览"]');

/** 通过接口创建项目并进入工作台自动开始生成。 */
export async function startProject(page: Page, prompt: string) {
  const res = await page.request.post("/api/projects", { data: { prompt } });
  expect(res.status()).toBe(201);
  const { project } = (await res.json()) as { project: { id: string } };
  await page.goto(`/p/${project.id}?start=1`);
  return project.id;
}

/** 等到测试员给出结论（输入框重新可用）。 */
export async function waitIdle(page: Page) {
  await expect(page.getByRole("button", { name: "停止" })).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByLabel("继续描述修改")).toBeEnabled();
}

export async function send(page: Page, text: string) {
  const box = page.getByLabel("继续描述修改");
  await box.fill(text);
  await box.press("Enter");
}

/** 新建一个已通过检查的待办项目（v1）。 */
export async function readyTodo(page: Page) {
  const id = await startProject(page, "做一个每日习惯打卡应用");
  await expect(page.getByText("检查通过")).toBeVisible({ timeout: 30_000 });
  await waitIdle(page);
  return id;
}
