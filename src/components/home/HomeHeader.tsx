import Link from "next/link";
import { LogoMark } from "@/components/ui/logo";
import { RecoveryMenu } from "./RecoveryMenu";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <LogoMark />
      <span>
        Atoms <span className="font-display font-normal italic text-[var(--muted)]">Demo</span>
      </span>
    </Link>
  );
}

export function HomeHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1">
          <a href="#team" className="hidden rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 md:inline-block">
            团队
          </a>
          <a href="#templates" className="hidden rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 md:inline-block">
            模板
          </a>
          <a href="#projects" className="hidden rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 md:inline-block">
            我的项目
          </a>
          <RecoveryMenu />
        </nav>
      </div>
    </header>
  );
}
