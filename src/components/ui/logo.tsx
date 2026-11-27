/** 标志：三个错开的圆点，对应三位角色。 */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <circle cx="8" cy="9" r="5.2" fill="var(--pm)" />
      <circle cx="16" cy="9" r="5.2" fill="var(--engineer)" style={{ mixBlendMode: "multiply" }} />
      <circle cx="12" cy="16" r="5.2" fill="var(--qa)" style={{ mixBlendMode: "multiply" }} />
    </svg>
  );
}
