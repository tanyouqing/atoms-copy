import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atoms Demo",
  description: "用一句话描述应用，AI 团队帮你生成并实时预览",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">{children}</body>
    </html>
  );
}
