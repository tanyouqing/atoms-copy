import Link from "next/link";
import { RecoveryMenu } from "./RecoveryMenu";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold">
      <span className="text-[var(--brand)]">◆</span>
      <span>Atoms Demo</span>
    </Link>
  );
}

export function HomeHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Logo />
        <RecoveryMenu />
      </div>
    </header>
  );
}
