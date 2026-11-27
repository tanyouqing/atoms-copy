import { readableVersion } from "@/lib/access";
import { withApi } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 下载存储的 HTML（保留 CDN 地址，不注入 runtime）。 */
export const GET = withApi<{ id: string }>((_req, { params, visitorId }) => {
  const { version, project } = readableVersion(params.id, visitorId);
  const filename = encodeURIComponent(`${project.title}-v${version.seq}.html`);
  return new Response(version.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="app-v${version.seq}.html"; filename*=UTF-8''${filename}`,
      "Cache-Control": "no-store",
    },
  });
});
