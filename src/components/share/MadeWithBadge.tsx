export function MadeWithBadge() {
  return (
    <a
      href="/"
      target="_blank"
      rel="noopener"
      className="fixed bottom-3 right-3 z-50 rounded-full border border-zinc-200 bg-white/85 px-3 py-1 text-xs text-zinc-700 shadow-sm backdrop-blur hover:bg-white"
      data-testid="made-with-badge"
    >
      <span className="text-[var(--brand)]">◆</span> 由 Atoms Demo 生成
    </a>
  );
}
