import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="text-4xl">🧭</div>
      <h1 className="text-lg font-semibold">页面不存在</h1>
      <p className="text-[var(--muted)]">这个应用不存在、未公开，或者不属于你。</p>
      <Link href="/" className="rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white hover:bg-black">
        返回首页
      </Link>
    </main>
  );
}
