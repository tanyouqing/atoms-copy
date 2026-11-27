import Link from "next/link";
import { LogoMark } from "@/components/ui/logo";
import { RecoveryMenu } from "./RecoveryMenu";

export function Logo({ dark }: { dark?: boolean }) {
  return (
    <Link href="/" className={dark ? "flex items-center gap-2 font-semibold tracking-tight text-white" : "flex items-center gap-2 font-semibold tracking-tight"}>
      <LogoMark />
      <span>
        Atoms <span className={dark ? "font-display font-normal italic text-zinc-400" : "font-display font-normal italic text-[var(--muted)]"}>Demo</span>
      </span>
    </Link>
  );
}

export function HomeHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[var(--night)]/75 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo dark />
        <nav className="flex items-center gap-1">
          <a href="#team" className="hidden rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-white/10 hover:text-white md:inline-block">
            团队
          </a>
          <a href="#templates" className="hidden rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-white/10 hover:text-white md:inline-block">
            模板
          </a>
          <a href="#projects" className="hidden rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-white/10 hover:text-white md:inline-block">
            我的项目
          </a>
          <RecoveryMenu dark />
        </nav>
      </div>
    </header>
  );
}
