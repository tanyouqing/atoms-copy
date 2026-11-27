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

    it("模板 JS 不超过 600 行，契约文件存在", () => {
      const tpl = fs.readFileSync(path.join(process.cwd(), "templates", id, "template.html"), "utf8");
      const js = tpl.slice(tpl.indexOf("<script>\n"), tpl.lastIndexOf("</script>"));
      expect(js.split("\n").length).toBeLessThanOrEqual(600);
      expect(loadContract(id)).toContain("interface BaseConfig");
    });
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
