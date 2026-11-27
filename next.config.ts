import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // templates/*.html 在运行时用 fs 读取，standalone 打包时需要一并带上
  outputFileTracingIncludes: { "/**": ["./templates/**/*"] },
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
