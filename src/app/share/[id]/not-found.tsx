import Link from "next/link";

export default function ShareNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="text-4xl">🔒</div>
      <h1 className="text-lg font-semibold">这个应用不存在或未公开</h1>
      <Link href="/" className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white">
        去 Atoms Demo 做一个
      </Link>
    </main>
  );
}
