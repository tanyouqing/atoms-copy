/**
 * 模板浏览器自检（docs/08 §5.4）：在与工作台相同的沙箱 iframe（无 allow-same-origin，
 * runtime 注入 + localStorage 垫片 + 父页面存储桥接）中逐个渲染模板，检查：
 *   1. 控制台 / runtime 无报错，页面非空白；
 *   2. 375px 宽度无横向溢出（kanban 列区域除外）；
 *   3. 典型交互后刷新，数据仍在；清空父页面存储后回到 seed 数据；
 *   4. 输出 375px 与 1280px 截图到 .verify/ 供人工查看。
 *
 * 用法：npm run verify:templates [-- <case 名称过滤>]
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { chromium, type FrameLocator, type Page } from "playwright";
import { buildSrcdoc } from "@/lib/preview/build-srcdoc";
import { TEMPLATE_IDS, type TemplateId } from "@/lib/templates/registry";
import { loadExample, renderTemplate } from "@/lib/templates/render";

const ROOT = process.cwd();
const OUT = path.join(ROOT, ".verify");
const FIXTURES = path.join(ROOT, "tests/fixtures/templates");

interface Case { name: string; id: TemplateId; html: string }

function collectCases(): Case[] {
  const cases: Case[] = TEMPLATE_IDS.map((id) => ({ name: id, id, html: renderTemplate(id, loadExample(id)) }));
  for (const file of fs.readdirSync(FIXTURES).filter((f) => f.endsWith(".json")).sort()) {
    const id = file.split("-")[0] as TemplateId;
    const config: unknown = JSON.parse(fs.readFileSync(path.join(FIXTURES, file), "utf8"));
    cases.push({ name: file.replace(/\.json$/, ""), id, html: renderTemplate(id, config) });
  }
  return cases;
}

const HOST_PAGE = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%;display:block}</style></head><body>
<iframe id="f" sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads" referrerpolicy="no-referrer"></iframe>
<script>
(async function () {
  var name = new URLSearchParams(location.search).get("case");
  var storageKey = "atoms:data:" + name;
  var snap = {};
  try { snap = JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch (e) {}
  var channel = Math.random().toString(36).slice(2);
  window.__errors = []; window.__ready = null;
  window.addEventListener("message", function (e) {
    var f = document.getElementById("f");
    if (e.source !== f.contentWindow || !e.data || e.data.channel !== channel) return;
    var d = e.data;
    if (d.type === "atoms:error") window.__errors.push(d.error);
    if (d.type === "atoms:ready") window.__ready = d;
    if (d.type === "atoms:storage") {
      var cur = {}; try { cur = JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch (e2) {}
      if (d.op === "set") cur[d.key] = d.value;
      if (d.op === "remove") delete cur[d.key];
      if (d.op === "clear") cur = {};
      localStorage.setItem(storageKey, JSON.stringify(cur));
    }
  });
  var res = await fetch("/build?case=" + encodeURIComponent(name) + "&channel=" + channel, { method: "POST", body: JSON.stringify(snap) });
  document.getElementById("f").srcdoc = await res.text();
})();
</script></body></html>`;

function startServer(cases: Map<string, Case>): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    if (url.pathname.startsWith("/vendor/")) {
      const file = path.join(ROOT, "public", url.pathname);
      if (!fs.existsSync(file)) return void res.writeHead(404).end();
      res.writeHead(200, { "content-type": "text/javascript" });
      return void fs.createReadStream(file).pipe(res);
    }
    if (url.pathname === "/host") return void res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(HOST_PAGE);
    if (url.pathname === "/build") {
      let body = "";
      req.on("data", (c: Buffer) => (body += c.toString()));
      req.on("end", () => {
        const c = cases.get(url.searchParams.get("case") ?? "");
        if (!c) return void res.writeHead(404).end();
        const storage = JSON.parse(body || "{}") as Record<string, string>;
        const origin = `http://${req.headers.host}`;
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(buildSrcdoc({ html: c.html, channel: url.searchParams.get("channel") ?? "", storage, origin }));
      });
      return;
    }
    res.writeHead(404).end();
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

type Ctx = { page: Page; app: FrameLocator };
/** 每个模板的典型交互：写入一条数据，返回刷新后应能看到的文本。 */
const INTERACTIONS: Record<string, (ctx: Ctx) => Promise<string>> = {
  todo: async ({ app }) => {
    await app.locator("#new-title").fill("自检条目 42");
    await app.locator("#new-title").press("Enter");
    // 打卡详情：5 周热力图里补打昨天的卡
    await app.locator("[data-act=habit]").last().click();
    const cells = app.locator("#modal [data-act=checkin]:not([disabled])");
    await cells.nth((await cells.count()) - 2).click();
    if (!(await app.locator("#modal").innerText()).includes("1 次")) throw new Error("todo: 热力图补打卡失败");
    await app.locator("#modal [data-act=modal-close]").last().click();
    return "自检条目 42";
  },
  ledger: async ({ app }) => {
    await app.locator("#f-amount").fill("77.7");
    await app.locator("#f-note").fill("自检记账");
    await app.locator("#entry-form button[type=submit]").click();
    return "自检记账";
  },
  form: async ({ app }) => {
    await app.locator("#main-form button[type=submit]").click();
    if ((await app.locator("[data-err]:visible").count()) === 0) throw new Error("form: 空表单提交没有显示校验错误");
    await app.locator("#f-name").fill("自检报名");
    await app.locator("#f-phone").fill("123");
    await app.locator("#main-form button[type=submit]").click();
    if (!(await app.locator("[data-err=phone]").isVisible())) throw new Error("form: 手机号校验没有生效");
    await app.locator("#f-phone").fill("13800000000");
    await app.locator("#f-session").selectOption({ index: 1 });
    await app.locator("#main-form button[type=submit]").click();
    await app.locator("h2", { hasText: "报名成功" }).waitFor({ timeout: 5000 });
    await app.locator("[data-act=view][data-v=admin]").click();
    return "自检报名";
  },
  kanban: async ({ app }) => {
    await app.locator("[data-act=start-add][data-col=applied]").click();
    await app.locator("#quick-applied").fill("自检候选人");
    await app.locator("#quick-applied").press("Enter");
    const card = app.locator("[data-card]", { hasText: "自检候选人" });
    await card.locator("[data-act=menu]").click();
    await app.locator("[data-act=move][data-col=offer]").click();
    if ((await app.locator("[data-col=offer] [data-card]", { hasText: "自检候选人" }).count()) !== 1) throw new Error("kanban: 菜单移动失败");
    await app.locator("[data-card]", { hasText: "王思远" }).dragTo(app.locator("[data-drop=screening]"));
    if ((await app.locator("section[data-col=screening] [data-card]", { hasText: "王思远" }).count()) !== 1) throw new Error("kanban: 拖拽换列失败");
    return "自检候选人";
  },
  landing: async ({ app }) => {
    await app.locator("#email").fill("selfcheck@example.com");
    await app.locator("#email").press("Enter");
    await app.locator("[data-act=again]").click();
    await app.locator("#email").fill("SelfCheck@example.com");
    await app.locator("#email").press("Enter");
    const text = await app.locator("body").innerText();
    if (!text.includes("已有 1 人")) throw new Error("landing: 邮箱去重失败");
    return "已有 1 人";
  },
  dashboard: async ({ app }) => {
    await app.locator("[data-act=sort][data-key=revenue]").click();
    const first = await app.locator("tbody tr").first().innerText();
    if (!first.includes("国贸店")) throw new Error("dashboard: 表格排序失败");
    await app.locator("[data-act=edit-data]").click();
    // 表格编辑器：改一个指标值，非法输入要报错
    await app.locator("[data-act=g-add]").first().click();
    await app.locator("[data-input=g][data-m='0'][data-f=value]").fill("abc");
    await app.locator("#modal button[type=submit]").click();
    if (!(await app.locator("#grid-err").isVisible())) throw new Error("dashboard: 表格编辑器非法数值未报错");
    await app.locator("[data-input=g][data-m='0'][data-f=value]").fill("123456");
    await app.locator("#modal button[type=submit]").click();
    if (!(await app.locator("body").innerText()).includes("123,456")) throw new Error("dashboard: 表格编辑器保存失败");
    await app.locator("[data-act=edit-data]").click();
    await app.locator("[data-act=edit-json]").click();
    const text = await app.locator("#json").inputValue();
    await app.locator("#json").fill("{ bad json");
    await app.locator("#modal button[type=submit]").click();
    if (!(await app.locator("#json-err").isVisible())) throw new Error("dashboard: 非法 JSON 未报错");
    await app.locator("#json").fill(text.replace('"销售额"', '"自检销售额"'));
    await app.locator("#modal button[type=submit]").click();
    return "自检销售额";
  },
  game: async ({ page, app }) => {
    await app.locator("[data-act=start]").click();
    await app.locator("[data-act=flip]").first().click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, "game-play.png") });
    await page.waitForTimeout(900);
    // 读出牌面，按图案配对后逐对翻开
    const faces = await app.locator("[data-act=flip] [data-face]").allInnerTexts();
    const byFace = new Map<string, number[]>();
    faces.forEach((f, i) => byFace.set(f, [...(byFace.get(f) ?? []), i]));
    for (const [, [a, b]] of byFace) {
      await app.locator(`[data-act=flip][data-i="${a}"]`).click();
      await app.locator(`[data-act=flip][data-i="${b}"]`).click();
    }
    await app.locator("h2", { hasText: "全部配对成功" }).waitFor({ timeout: 5000 });
    return "最好成绩：8 步";
  },
  crud: async ({ app }) => {
    await app.locator("[data-act=new]").first().click();
    await app.locator("#modal button[type=submit]").click();
    if (!(await app.locator("#modal [data-err=title]").isVisible())) throw new Error("crud: 必填校验未生效");
    await app.locator("#e-title").fill("自检之书");
    await app.locator("#e-status").selectOption("在读");
    await app.locator("#modal button[type=submit]").click();
    await app.locator("#q").fill("自检");
    if ((await app.locator("[data-act=open]").count()) !== 1) throw new Error("crud: 搜索结果不对");
    await app.locator("#q").fill("");
    await app.locator("[data-act=view][data-v=table]").click();
    await app.locator("[data-act=chip][data-v=读完]").click();
    if ((await app.locator("tbody tr").count()) !== 3) throw new Error("crud: 筛选结果不对");
    await app.locator("[data-act=chip][data-v='']").click();
    // 导入 CSV：两条有效、一条缺必填
    await app.locator("#csv-file").setInputFiles({ name: "b.csv", mimeType: "text/csv", buffer: Buffer.from("书名,作者,阅读状态,评分\n导入之书,某人,想读,★★★\n\"带,逗号\",某人,读完,4\n,缺书名,读完,\n") });
    const text = await app.locator("body").innerText();
    if (!text.includes("导入之书") || !text.includes("带,逗号")) throw new Error("crud: CSV 导入失败");
    return "自检之书";
  },
  "form-stepped": async ({ app }) => {
    // 一题一页：必填拦截 → 逐题前进 → 上一题保留答案 → 提交 → 统计页
    await app.locator("#main-form button[type=submit]").click();
    if (!(await app.locator("[data-err=score]").isVisible())) throw new Error("form-stepped: 必填未拦截");
    await app.locator("[data-act=rate][data-v='4']").click();
    await app.locator("#main-form button[type=submit]").click();
    await app.locator("#f-pace").selectOption("刚好");
    await app.locator("[data-act=step-back]").click();
    if ((await app.locator("#f-score").inputValue()) !== "4") throw new Error("form-stepped: 上一题答案丢失");
    await app.locator("#main-form button[type=submit]").click();
    if ((await app.locator("#f-pace").inputValue()) !== "刚好") throw new Error("form-stepped: 草稿未保留");
    for (let i = 0; i < 4; i++) await app.locator("#main-form button[type=submit]").click();
    await app.locator("h2", { hasText: "感谢你的反馈" }).waitFor({ timeout: 3000 });
    await app.locator("[data-act=view][data-v=admin]").click();
    await app.locator("[data-act=tab][data-v=stats]").click();
    const text = await app.locator("body").innerText();
    if (!text.includes("4 人作答") || !text.includes("最近 7 天提交")) throw new Error("form-stepped: 统计页不对");
    return "4 人作答";
  },
  "todo-task-en-dark": async ({ app }) => {
    // 搜索、详情编辑、撤销删除
    await app.locator("#q").fill("dentist");
    if ((await app.locator("[data-act=toggle]").count()) !== 1) throw new Error("todo: 搜索结果不对");
    await app.locator("[data-act=open]").first().click();
    await app.locator("#d-note").fill("Bring insurance card");
    await app.locator("#modal button[type=submit]").click();
    await app.locator("#q").fill("");
    await app.locator("[data-act=del]").first().click();
    await app.locator("#toast-undo").click();
    if ((await app.locator("[data-act=toggle]").count()) !== 4) throw new Error("todo: 撤销删除失败");
    return "Bring insurance card";
  },
  "game-guess-en-dark": async ({ app }) => {
    await app.locator("[data-act=start]").click();
    // 二分查找必然在 7 次内猜中
    let lo = 1, hi = 100;
    for (let i = 0; i < 7; i++) {
      const mid = Math.floor((lo + hi) / 2);
      await app.locator("#guess").fill(String(mid));
      await app.locator("#guess").press("Enter");
      if (await app.locator("h2", { hasText: "You got it" }).count()) break;
      const last = await app.locator("li").first().innerText();
      if (last.includes("Too high")) hi = mid - 1; else lo = mid + 1;
    }
    await app.locator("h2", { hasText: "You got it" }).waitFor({ timeout: 3000 });
    return "1 games played";
  },
  "game-snake": async ({ page, app }) => {
    await app.locator("[data-act=start]").click();
    await page.waitForTimeout(400);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, "game-snake-play.png") });
    await page.keyboard.press(" ");
    if (!(await app.locator("#pause-mask").isVisible())) throw new Error("snake: 空格暂停失败");
    await page.keyboard.press(" ");
    await app.locator("h2", { hasText: "撞到了" }).waitFor({ timeout: 8000 });
    return "已玩 1 局";
  },
  "game-quiz-en": async ({ app }) => {
    await app.locator("[data-act=start]").click();
    for (const k of [1, 0, 2]) {
      await app.locator(`[data-act=answer][data-k="${k}"]`).click();
      await app.locator("[data-act=next-q]").click();
    }
    const text = await app.locator("body").innerText();
    if (!text.includes("Review") || !text.includes("8 minutes")) throw new Error("quiz: 错题回顾缺失");
    return "1 games played";
  },
};

async function waitReady(page: Page) {
  await page.waitForFunction(() => (window as unknown as { __ready: unknown }).__ready !== null, null, { timeout: 15_000 });
  return page.evaluate(() => {
    const w = window as unknown as { __ready: { blank: boolean; errors: unknown[] }; __errors: unknown[] };
    return { blank: w.__ready.blank, errors: w.__errors };
  });
}

async function main() {
  const filter = process.argv[2];
  const all = collectCases().filter((c) => !filter || c.name.includes(filter));
  const server = await startServer(new Map(all.map((c) => [c.name, c])));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const failures: string[] = [];

  for (const c of all) {
    const problems: string[] = [];
    for (const width of [375, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: Number(process.env.VERIFY_HEIGHT ?? 900) } });
      const page = await context.newPage();
      page.on("pageerror", (e) => problems.push(`host pageerror: ${e.message}`));
      const app = page.frameLocator("#f");
      await page.goto(`${base}/host?case=${c.name}`);
      const r = await waitReady(page);
      if (r.blank) problems.push(`${width}px: 页面空白`);
      for (const e of r.errors) problems.push(`${width}px: runtime 报错 ${JSON.stringify(e)}`);

      const frame = page.frames().find((f) => f !== page.mainFrame());
      if (frame && width === 375 && c.id !== "kanban") {
        const overflow = await frame.evaluate(() => {
          const w = document.documentElement.clientWidth;
          const px = document.documentElement.scrollWidth - w;
          const culprits = Array.from(document.querySelectorAll("body *"))
            .filter((el) => el.getBoundingClientRect().right > w + 1 && el.children.length === 0)
            .slice(0, 3)
            .map((el) => `<${el.tagName.toLowerCase()} class="${(el.getAttribute("class") ?? "").slice(0, 60)}">`);
          return { px, culprits };
        });
        if (overflow.px > 1) problems.push(`375px: 横向溢出 ${overflow.px}px ${overflow.culprits.join(" ")}`);
      }
      await page.screenshot({ path: path.join(OUT, `${c.name}-${width}.png`), fullPage: false });

      const act = INTERACTIONS[c.name];
      if (act && width === 1280) {
        let expected: string;
        try {
          expected = await act({ page, app });
        } catch (e) {
          await page.screenshot({ path: path.join(OUT, `${c.name}-fail.png`) });
          problems.push(`交互失败：${(e as Error).message.split("\n")[0]}`);
          await context.close();
          continue;
        }
        await page.waitForTimeout(300);
        await page.reload();
        await waitReady(page);
        const text = await app.locator("body").innerText();
        if (!text.includes(expected)) problems.push(`刷新后数据丢失：未找到「${expected}」`);
        await page.screenshot({ path: path.join(OUT, `${c.name}-after.png`) });
        await page.evaluate((k) => localStorage.removeItem(k), `atoms:data:${c.name}`);
        await page.reload();
        await waitReady(page);
        const text2 = await app.locator("body").innerText();
        if (text2.includes(expected)) problems.push("清空存储后没有回到 seed 数据");
      }
      const late = await page.evaluate(() => (window as unknown as { __errors: unknown[] }).__errors);
      for (const e of late.slice(r.errors.length)) problems.push(`${width}px: 交互后报错 ${JSON.stringify(e)}`);
      await context.close();
    }
    console.log(`${problems.length ? "✗" : "✓"} ${c.name}${problems.length ? "\n    " + problems.join("\n    ") : ""}`);
    if (problems.length) failures.push(c.name);
  }

  await browser.close();
  server.close();
  console.log(failures.length ? `\n${failures.length} 个用例未通过：${failures.join(", ")}` : `\n全部 ${all.length} 个用例通过，截图在 .verify/`);
  process.exit(failures.length ? 1 : 0);
}

void main();
