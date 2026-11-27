import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { staticCheck } from "@/lib/agent/qa-static";
import { TEMPLATE_IDS, TEMPLATES, type TemplateId } from "@/lib/templates/registry";
import { loadContract, loadExample, renderTemplate, shiftLedgerDates } from "@/lib/templates/render";
import { LedgerConfigSchema, TEMPLATE_SCHEMAS } from "@/lib/templates/schemas";

const FIXTURES = path.join(process.cwd(), "tests/fixtures/templates");
const fixtures = fs
  .readdirSync(FIXTURES)
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({ name: f, id: f.split("-")[0] as TemplateId, config: JSON.parse(fs.readFileSync(path.join(FIXTURES, f), "utf8")) as unknown }));

describe("templates", () => {
  it("registry 与目录一致，共 8 个模板", () => {
    expect(TEMPLATE_IDS).toHaveLength(8);
    expect(TEMPLATES.map((t) => t.id)).toEqual(Object.keys(TEMPLATE_SCHEMAS));
  });

  describe.each(TEMPLATE_IDS)("%s", (id) => {
    it("example.json 通过 schema", () => {
      const r = TEMPLATE_SCHEMAS[id].safeParse(loadExample(id));
      expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    });

    it("渲染结果通过静态检查且不残留占位符", () => {
      const html = renderTemplate(id, loadExample(id));
      expect(staticCheck(html)).toEqual([]);
      expect(html).not.toContain("__APP_CONFIG__");
      expect(html).not.toContain("__APP_TITLE__");
      expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    });

    it("模板 JS 不超过 700 行，契约文件存在", () => {
      const tpl = fs.readFileSync(path.join(process.cwd(), "templates", id, "template.html"), "utf8");
      const js = tpl.slice(tpl.indexOf("<script>\n"), tpl.lastIndexOf("</script>"));
      expect(js.split("\n").length).toBeLessThanOrEqual(700);
      expect(loadContract(id)).toContain("interface BaseConfig");
    });
  });

  describe.each(TEMPLATE_IDS)("%s 共享交互件", (id) => {
    const tpl = fs.readFileSync(path.join(process.cwd(), "templates", id, "template.html"), "utf8");
    it("风格主题占位、可撤销提示与快捷键都在", () => {
      // 颜色、圆角、阴影来自主题变量（docs/08 §2.3），模板里不再写死纸张色
      expect(tpl).toContain("\n__APP_THEME__\n");
      expect(tpl).toContain("bg-[var(--surface)]");
      expect(tpl).toContain("box-shadow: var(--card-shadow)");
      expect(tpl).not.toMatch(/#fffdf9"?\]|--color-slate-50: #/);
      expect(tpl).toContain('id="toast-undo"');
      expect(tpl).toMatch(/const toast = \(msg, onUndo\)/);
      expect(tpl).toContain("const shortcut = (key, label, fn)");
      // 注册了快捷键的模板，页面上要有入口
      if (/shortcut\("/.test(tpl)) expect(tpl).toMatch(/\+ keysHint\(\)/);
      // 两种语言都要有撤销和快捷键文案
      expect(tpl.match(/undo: "/g)).toHaveLength(2);
      expect(tpl.match(/shortcuts: "/g)).toHaveLength(2);
    });
    it("只用白名单里的外部脚本，不引入新的网络资源", () => {
      const srcs = [...tpl.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]);
      for (const s of srcs) expect(s).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/npm\/(@tailwindcss\/browser|chart\.js)@/);
      expect(tpl).not.toMatch(/fetch\(|XMLHttpRequest|<link[^>]+href="http/);
    });
  });

  it("form.stepByStep 可选：缺省通过，非布尔值被拒绝", () => {
    const c = loadExample("form") as Record<string, unknown>;
    expect("stepByStep" in c).toBe(false);
    expect(TEMPLATE_SCHEMAS.form.safeParse(c).success).toBe(true);
    expect(TEMPLATE_SCHEMAS.form.safeParse({ ...c, stepByStep: true }).success).toBe(true);
    expect(TEMPLATE_SCHEMAS.form.safeParse({ ...c, stepByStep: "yes" }).success).toBe(false);
    expect(loadContract("form")).toContain("stepByStep?: boolean");
  });

  it("能力清单与新功能一致（PM 据此判断是否走模板）", () => {
    const can = Object.fromEntries(TEMPLATES.map((t) => [t.id, t.can + "｜" + t.cannot]));
    expect(can.form).toContain("一题一页");
    expect(can.form).not.toContain("多步骤/分页表单");
    expect(can.todo).toContain("5 周打卡热力图");
    expect(can.crud).toContain("批量");
    expect(can.game).toContain("难度");
  });

  describe.each(fixtures)("fixture $name", ({ id, config }) => {
    it("通过 schema 并通过静态检查", () => {
      expect(staticCheck(renderTemplate(id, config))).toEqual([]);
    });
  });

  it("title 与配置中的 </script> 被转义，不会提前闭合脚本", () => {
    const config = { ...(loadExample("todo") as Record<string, unknown>), title: "</script><b>x" };
    const html = renderTemplate("todo", config);
    expect(html).toContain("<title>&lt;/script&gt;&lt;b&gt;x</title>");
    expect(html).toContain("\\u003c/script>\\u003cb>x");
    expect(staticCheck(html)).toEqual([]);
  });

  it("schema 拒绝引用不存在的列 / 分类", () => {
    const kanban = loadExample("kanban") as { seedCards: { column: string }[] };
    kanban.seedCards[0]!.column = "nope";
    expect(TEMPLATE_SCHEMAS.kanban.safeParse(kanban).success).toBe(false);
    const todo = loadExample("todo") as { seedItems: { category?: string }[] };
    todo.seedItems[0]!.category = "nope";
    expect(TEMPLATE_SCHEMAS.todo.safeParse(todo).success).toBe(false);
  });

  it("theme.mode 缺省为 light", () => {
    const c = loadExample("form") as { theme: { primary: string; mode?: string } };
    delete c.theme.mode;
    const parsed = TEMPLATE_SCHEMAS.form.parse(c);
    expect(parsed.theme.mode).toBe("light");
  });

  it("ledger 早于 60 天的日期平移到最近 30 天，其余不变", () => {
    const base = LedgerConfigSchema.parse(loadExample("ledger"));
    const now = new Date(2027, 5, 15);
    const shifted = shiftLedgerDates(base, now);
    for (const e of shifted.seedEntries) {
      const age = (now.getTime() - new Date(e.date + "T00:00:00").getTime()) / 86_400_000;
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(30);
    }
    const recent = shiftLedgerDates(base, new Date(2026, 10, 27));
    expect(recent.seedEntries.map((e) => e.date)).toEqual(base.seedEntries.map((e) => e.date));
  });
});
