// next build 之后把 public/ 与 .next/static 复制进 standalone 产物，使 `npm start`（node .next/standalone/server.js）可直接运行。
// Docker 镜像中另行复制，见 Dockerfile。
import fs from "node:fs";

const out = ".next/standalone";
if (fs.existsSync(out)) {
  fs.cpSync("public", `${out}/public`, { recursive: true });
  fs.cpSync(".next/static", `${out}/.next/static`, { recursive: true });
}
