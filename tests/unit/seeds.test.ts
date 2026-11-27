import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TEMPLATE_IDS } from "@/lib/templates/registry";
import { TEMPLATE_SCHEMAS } from "@/lib/templates/schemas";
import { stripSeedData, USER_DATA_SEEDS } from "@/lib/templates/seeds";

describe("stripSeedData", () => {
  it.each(TEMPLATE_IDS)("%s：去掉用户数据后仍通过 schema", (id) => {
    const example: unknown = JSON.parse(readFileSync(`templates/${id}/example.json`, "utf8"));
    const stripped = stripSeedData(id, example) as Record<string, unknown>;
    const key = USER_DATA_SEEDS[id];
    if (key) expect(stripped[key]).toEqual([]);
    else expect(stripped).toBe(example);
    expect(TEMPLATE_SCHEMAS[id].safeParse(stripped).success).toBe(true);
  });

  it("不修改原对象", () => {
    const c = { seedItems: [{ title: "a" }] };
    stripSeedData("todo", c);
    expect(c.seedItems).toHaveLength(1);
  });
});
