import Link from "next/link";

// 首页在 T2.1 实现；当前只提供模板画廊入口
export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-6 py-24 text-center">
      <h1 className="text-3xl font-bold">Atoms Demo</h1>
      <p className="text-zinc-500">工作台开发中。当前可在开发环境查看 8 个应用模板。</p>
      {process.env.NODE_ENV !== "production" && (
        <Link href="/dev/templates" className="inline-block rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
          打开模板画廊
        </Link>
      )}
    </main>
  );
}
