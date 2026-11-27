# 10 · 部署手册（自有云服务器 + Docker Compose + Nginx，IP 访问）

> 不使用 Vercel。站点通过 `http://<服务器公网 IP>` 访问，没有域名和 HTTPS。

## 1. 前提与假设

| 项 | 要求 / 假设 |
|---|---|
| 服务器 | Linux x86_64（Ubuntu 22.04/24.04 或同类），公网 IP |
| 内存 | **假设 ≥ 2 GB**（Next.js 构建峰值约 1.5–2 GB）。小于 2 GB 时见 §6 的两种方案 |
| 磁盘 | ≥ 10 GB 可用 |
| 软件 | Docker 24+、Docker Compose v2（`docker compose` 子命令）、git |
| 网络 | 安全组 / 防火墙放行 TCP 80（入站）；服务器能访问 `api.deepseek.com:443`。3000 端口不对外 |
| 账号 | DeepSeek 开放平台 API Key，并在控制台设置用量上限 / 低余额充值（防止被刷） |

## 2. 环境变量（`.env.example`，提交到仓库）

```dotenv
# ---- 必填 ----
DEEPSEEK_API_KEY=sk-xxxxxxxx

# ---- 模型（一般不用改）----
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-flash

# ---- 数据 ----
DATABASE_PATH=./data/app.db

# ---- 限流（滚动 24 小时）----
RATE_LIMIT_VISITOR_PER_DAY=40
RATE_LIMIT_IP_PER_DAY=80
RATE_LIMIT_GLOBAL_PER_DAY=1000

# ---- 成本估算（美元 / 每百万 token，默认非高峰价）----
LLM_PRICE_INPUT_PER_M=0.15
LLM_PRICE_OUTPUT_PER_M=0.6

# ---- 开发 / 测试 ----
# 设为 1 时不调用真实模型，返回固定样例（E2E 测试、无 Key 演示）
LLM_MOCK=0
```

`src/lib/env.ts` 用 zod 校验：`LLM_MOCK != 1` 时 `DEEPSEEK_API_KEY` 必填；数字类变量 `z.coerce.number().int().positive()`。校验失败时启动即报错退出，错误信息列出缺失项。

## 3. 构建产物

### 3.1 `next.config.ts`

```ts
import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ]}];
  },
};
export default config;
```

### 3.2 `Dockerfile`

```dockerfile
# ---------- deps ----------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ---------- build ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- runtime ----------
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 DATABASE_PATH=/app/data/app.db
RUN useradd -m -u 1001 app && mkdir -p /app/data && chown app:app /app/data
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/templates ./templates
COPY --from=build /app/drizzle ./drizzle
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
```

要点：
- `templates/` 和 `drizzle/` 是运行时用 `fs` 读取的目录，standalone 不会自动包含，必须显式复制。
- standalone 产物会包含 `better-sqlite3` 的原生 `.node` 文件（因为在 `serverExternalPackages` 中，Next 会把整个包复制到 `.next/standalone/node_modules`）。构建后在镜像里验证：`docker run --rm atoms-demo ls node_modules/better-sqlite3/build/Release`。
- `.dockerignore`：`node_modules`、`.next`、`data`、`.env*`（保留 `.env.example`）、`tests/e2e/.output`、`.git`。

### 3.3 `docker-compose.yml`

```yaml
services:
  app:
    build: .
    image: atoms-demo:latest
    env_file: .env
    environment:
      DATABASE_PATH: /app/data/app.db
    volumes:
      - ./data:/app/data
    restart: unless-stopped
    expose:
      - "3000"
  nginx:
    image: nginx:1.27-alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - app
    restart: unless-stopped
```

注意 `./data` 目录需要容器内 uid 1001 可写：首次部署执行 `mkdir -p data && sudo chown 1001:1001 data`。

### 3.4 `nginx/default.conf`

```nginx
server {
  listen 80 default_server;
  server_name _;
  client_max_body_size 2m;

  gzip on;
  gzip_types text/plain text/css application/javascript application/json image/svg+xml;
  gzip_min_length 1024;

  # SSE 与 API：关闭缓冲，延长超时
  location /api/ {
    proxy_pass http://app:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    gzip off;
  }

  # 静态资源长缓存
  location /_next/static/ {
    proxy_pass http://app:3000;
    proxy_set_header Host $host;
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  location / {
    proxy_pass http://app:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 60s;
  }
}
```

## 4. 首次上线步骤

```bash
# 1. 安装 Docker（Ubuntu）
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# 2. 拉代码
git clone https://github.com/<user>/atoms-demo.git && cd atoms-demo

# 3. 配置
cp .env.example .env && vi .env          # 填 DEEPSEEK_API_KEY
mkdir -p data && sudo chown 1001:1001 data

# 4. 构建并启动
docker compose up -d --build

# 5. 验证
curl -s http://127.0.0.1/api/health      # {"ok":true,...}
docker compose logs -f app
```

浏览器打开 `http://<服务器 IP>`，按 [13-test-acceptance.md](13-test-acceptance.md) §5 做线上冒烟。

## 5. 更新发布

```bash
cd atoms-demo && git pull && docker compose up -d --build && docker image prune -f
```

数据库迁移在应用启动时自动执行，无需手动操作。

可选（时间富余）：GitHub Actions 在 push 到 main 时通过 SSH 执行上面的命令（secrets：`SSH_HOST`、`SSH_USER`、`SSH_KEY`）。

## 6. 服务器内存不足 2 GB 时

先查看：`free -h`。

**方案 A：加 swap（最简单，1 GB 内存可用）**

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

构建会变慢（几分钟），但能完成。

**方案 B：在本地或 CI 构建镜像，推到服务器（服务器只运行，不构建）**

本地（需要与服务器同架构，Apple Silicon 用 `--platform linux/amd64`）：

```bash
docker build --platform linux/amd64 -t atoms-demo:latest .
docker save atoms-demo:latest | gzip | ssh user@<IP> 'gunzip | docker load'
ssh user@<IP> 'cd atoms-demo && git pull && docker compose up -d --no-build'
```

或 GitHub Actions 构建并推送到 GHCR（`ghcr.io/<user>/atoms-demo:latest`），服务器上在 `docker-compose.yml` 的 `app` 中改用 `image: ghcr.io/<user>/atoms-demo:latest` 并 `docker compose pull && docker compose up -d`。

运行时内存：应用约 150–250 MB，Nginx 约 10 MB，512 MB 内存即可运行。

## 7. 备份

```bash
# crontab -e，每天 4 点备份，保留 7 天
0 4 * * * cd /home/<user>/atoms-demo && mkdir -p backups && sqlite3 data/app.db ".backup 'backups/app-$(date +\%F).db'" && find backups -name '*.db' -mtime +7 -delete
```

服务器没有 `sqlite3` 命令时：`sudo apt install sqlite3`。（WAL 模式下不要直接 `cp` 数据库文件。）

## 8. 运维排查

| 现象 | 排查 |
|---|---|
| 生成卡在"正在编写代码"不动，最后一次性出现 | Nginx 缓冲未关闭：检查 `/api/` 的 `proxy_buffering off`；响应头有 `X-Accel-Buffering: no` |
| 生成到一半断开 | `proxy_read_timeout`；服务端是否每 15s 发 ping |
| 502 | `docker compose ps` 看 app 是否健康；`docker compose logs app` |
| `SQLITE_CANTOPEN` / 权限错误 | `data/` 目录属主需为 1001 |
| 模型报 401 | `.env` 中 Key；修改 `.env` 后需 `docker compose up -d`（重建容器） |
| 预览样式丢失 | `public/vendor/` 文件是否存在；`vendor.ts` 中 CDN 地址是否与模板一致 |
