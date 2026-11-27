import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TemplatePreview } from "@/components/dev/TemplatePreview";
import { TEMPLATES, isTemplateId, type TemplateId } from "@/lib/templates/registry";
import { loadExample, renderTemplate } from "@/lib/templates/render";

export const dynamic = "force-dynamic";

interface Case { name: string; id: TemplateId; label: string; config: () => unknown }

function listCases(): Case[] {
  const dir = path.join(process.cwd(), "tests/fixtures/templates");
  const fixtures: Case[] = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .flatMap((f) => {
          const id = f.split("-")[0];
          if (!isTemplateId(id)) return [];
          const name = f.replace(/\.json$/, "");
          return [{ name, id, label: name.slice(id.length + 1), config: () => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as unknown }];
        })
    : [];
  return TEMPLATES.flatMap((t) => [{ name: t.id, id: t.id, label: "example", config: () => loadExample(t.id) }, ...fixtures.filter((c) => c.id === t.id)]);
}

/** 仅开发环境：模板画廊，逐个渲染 example.json 与 tests/fixtures/templates 中的变体。 */
export default async function TemplatesGallery({ searchParams }: { searchParams: Promise<{ id?: string; case?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const cases = listCases();
  const current = cases.find((c) => c.name === (sp.case ?? sp.id)) ?? cases[0];
  if (!current) notFound();

  let html = "";
  let error = "";
  try {
    html = renderTemplate(current.id, current.config());
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="shrink-0 border-b border-zinc-200 bg-white p-4 md:w-60 md:border-r md:border-b-0">
        <h1 className="mb-3 text-sm font-semibold">模板画廊（dev）</h1>
        <nav className="flex flex-wrap gap-1 md:flex-col">
          {TEMPLATES.map((t) => (
            <div key={t.id} className="md:mb-2">
              <div className="px-2 py-1 text-xs text-zinc-400">
                {t.name} · {t.id}
              </div>
              {cases
                .filter((c) => c.id === t.id)
                .map((c) => (
                  <Link
                    key={c.name}
                    href={`/dev/templates?case=${c.name}`}
                    className={`block rounded-lg px-2 py-1 text-sm ${c.name === current.name ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}
                  >
                    {c.label}
                  </Link>
                ))}
            </div>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-4">
        {error ? <pre className="rounded-xl bg-rose-50 p-4 text-xs text-rose-700">{error}</pre> : <TemplatePreview key={current.name} caseName={current.name} html={html} />}
      </main>
    </div>
  );
}
