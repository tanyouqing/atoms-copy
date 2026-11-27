import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { readyTodo } from "./helpers";

test("下载得到 .html，保留 CDN 地址且不含 runtime", async ({ page }) => {
  await readyTodo(page);
  const link = page.getByTestId("download-link");
  await expect(link).toHaveAttribute("download", /-v1\.html$/);
  const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
  const html = fs.readFileSync(await download.path(), "utf8");
  expect(html).toContain("https://cdn.jsdelivr.net/npm/@tailwindcss/browser@");
  expect(html).not.toContain("__ATOMS__");
  // 文件名由响应头决定（无头 Chromium 的 suggestedFilename 取 URL 末段，这里直接校验响应头）
  const res = await page.request.get(download.url());
  expect(res.headers()["content-disposition"]).toMatch(/^attachment; filename="app-v1\.html"; filename\*=UTF-8''.+-v1\.html$/);
});
