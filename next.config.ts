import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
  // templates/ 与 drizzle/ 在运行时用 fs 读取，standalone 打包时一并带上（Dockerfile 也会显式复制）
  outputFileTracingIncludes: { "/**": ["./templates/**/*", "./drizzle/**/*", "./tests/fixtures/llm/**/*"] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
