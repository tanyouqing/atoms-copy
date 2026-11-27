import { z } from "zod";
import { createProject, listProjects, projectSummary } from "@/lib/db/queries";
import { readJson, withApi } from "@/lib/http";
import { PROMPT_MAX } from "@/lib/examples";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ prompt: z.string().trim().min(1, "请描述你想要的应用").max(PROMPT_MAX, "需求描述请控制在 2000 字以内") });

export const GET = withApi((_req, { visitorId }) => Response.json({ projects: listProjects(visitorId) }));

export const POST = withApi(async (req, { visitorId }) => {
  const { prompt } = Body.parse(await readJson(req));
  const project = createProject({ visitorId, prompt });
  return Response.json({ project: projectSummary(project) }, { status: 201 });
});
