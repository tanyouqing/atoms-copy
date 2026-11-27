import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atoms Demo",
  description: "用一句话描述你的应用，AI 团队几十秒内交付一个可交互、可分享的单页应用",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">
        {children}
        <Toaster position="bottom-right" duration={3000} richColors />
      </body>
    </html>
  );
}
