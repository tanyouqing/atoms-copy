import { expect, test, type Page } from "@playwright/test";
import { preview, readyTodo, send, startProject, waitIdle } from "./helpers";

/** 预览 iframe 里执行脚本（沙箱 iframe 没有 same-origin，只能通过 Playwright 的 frame 句柄）。 */
async function inPreview<T>(page: Page, fn: () => T): Promise<T> {
  const frame = await (await page.locator('iframe[title="应用预览"]').elementHandle())?.contentFrame();
  if (!frame) throw new Error("找不到预览 iframe");
  return frame.evaluate(fn);
}

const themeCss = (page: Page) => inPreview(page, () => document.getElementById("app-theme")?.textContent ?? "");

test("首页选择像素风：生成的应用用像素字体，工作台高亮当前风格", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("描述你想要的应用").fill("做一个每日习惯打卡应用");
  await page.getByTestId("style-pixel").click();
  await expect(page.getByTestId("style-pixel")).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "开始生成" }).click();
  await page.waitForURL(/\/p\//);
  await expect(page.getByText("检查通过")).toBeVisible({ timeout: 30_000 });
  await waitIdle(page);
  await expect(page.getByTestId("switch-pixel")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => inPreview(page, () => getComputedStyle(document.body).fontFamily)).toContain("Fusion Pixel");
});

test("风格按钮一键切换：不重新生成，只换主题，产生新版本", async ({ page }) => {
  await readyTodo(page);
  await expect(page.getByTestId("switch-paper")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("switch-bright").click();
  const v2 = page.getByTestId("version-card").filter({ hasText: "v2" });
  await expect(v2).toContainText("换成明亮卡片");
  await waitIdle(page);
  await expect(page.getByTestId("switch-bright")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => themeCss(page)).toContain("radial-gradient");
  // 数据和内容不变
  await expect(preview(page).getByText("每日习惯打卡").first()).toBeVisible();
  await page.getByRole("tab", { name: "代码" }).click();
  await page.getByRole("button", { name: "配置 JSON" }).click();
  await expect(page.getByTestId("code-view")).toContainText('"style": "bright"');
});

test("用文字描述其他风格：生成自定义颜色，深色背景自动用深色模式", async ({ page }) => {
  await readyTodo(page);
  await send(page, "整体换成赛博朋克风格");
  await expect(page.getByTestId("version-card").filter({ hasText: "v2" })).toContainText("赛博朋克");
  await waitIdle(page);
  await expect.poll(() => themeCss(page)).toContain("--accent-600:");
  await expect.poll(() => inPreview(page, () => document.documentElement.classList.contains("dark"))).toBe(true);
  await expect(page.getByTestId("style-switch")).toContainText("赛博朋克");
});

const PROMPTS: Record<string, string> = {
  todo: "做一个每日习惯打卡应用",
  ledger: "做一个家庭记账本",
  form: "做一个活动报名表",
  kanban: "做一个招聘进度看板",
  landing: "做一个咖啡馆落地页",
  dashboard: "做一个门店经营仪表盘",
  game: "做一个记忆翻牌小游戏",
  crud: "做一个管理书单的应用",
};
const MARKERS = { pixel: "Fusion Pixel", bright: "radial-gradient", paper: "Georgia" } as const;

test.describe("手机宽度", () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  for (const [id, prompt] of Object.entries(PROMPTS)) {
    test(`${id}：三种风格在 375px 下都没有横向溢出`, async ({ page }) => {
      await startProject(page, prompt);
      await expect(page.getByText("检查通过")).toBeVisible({ timeout: 30_000 });
      await waitIdle(page);
      for (const style of ["paper", "pixel", "bright"] as const) {
        if (style !== "paper") {
          await page.getByRole("tab", { name: "对话" }).click();
          await page.getByTestId(`switch-${style}`).click();
          await waitIdle(page);
        }
        await page.getByRole("tab", { name: "预览" }).click();
        await expect.poll(() => themeCss(page)).toContain(MARKERS[style]);
        const r = await inPreview(page, () => ({ width: document.documentElement.clientWidth, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
        expect(r.width).toBeLessThanOrEqual(375);
        expect(r.overflow, `${id} / ${style}`).toBeLessThanOrEqual(1);
      }
    });
  }
});
