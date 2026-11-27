import { useId, type CSSProperties } from "react";
import { AGENTS, type AgentRole } from "@/lib/agents";
import { cn } from "@/lib/utils";

const SKIN = "#F3CDAE";
const SKIN_SHADE = "#E2B08C";
const INK = "#2A2118";

function Face({ cheeks = true }: { cheeks?: boolean }) {
  return (
    <>
      <circle cx="20.6" cy="22.4" r="1.15" fill={INK} />
      <circle cx="27.4" cy="22.4" r="1.15" fill={INK} />
      <path d="M21.8 25.9 Q24 27.6 26.2 25.9" stroke={INK} strokeWidth="1.1" fill="none" strokeLinecap="round" />
      {cheeks && (
        <>
          <circle cx="18.6" cy="25" r="1.5" fill="#EE8F7A" opacity="0.35" />
          <circle cx="29.4" cy="25" r="1.5" fill="#EE8F7A" opacity="0.35" />
        </>
      )}
    </>
  );
}

function Base({ shirt }: { shirt: string }) {
  return (
    <>
      <path d="M7 49 C7 38.5 14.5 34 24 34 C33.5 34 41 38.5 41 49 Z" fill={shirt} />
      <path d="M21 28 h6 v6.5 c0 1.6 -6 1.6 -6 0 Z" fill={SKIN_SHADE} />
      <circle cx="24" cy="21.5" r="9" fill={SKIN} />
    </>
  );
}

/** Mia · 产品经理：齐肩短发、圆框眼镜、手里一块写字板。 */
function Mia() {
  const hair = "#5A3A26";
  return (
    <>
      <path d="M13.6 29 C12.4 19 15.6 11 24 11 C32.4 11 35.6 19 34.4 29 C33 30 31.6 29.6 31.4 28 L31.6 19.5 C27.4 19.4 22.6 17.6 19.8 15.2 C19 17.4 17.6 19 16.4 19.8 L16.6 28 C16.4 29.6 15 30 13.6 29 Z" fill={hair} />
      <Base shirt="#D4932A" />
      <path d="M15 20.5 C15.4 14 19 11.8 24 11.8 C29 11.8 32.6 14 33 20.5 C29 20.2 23.6 18.4 20.4 15.6 C19.4 18 17.4 19.8 15 20.5 Z" fill={hair} />
      <Face cheeks={false} />
      <g stroke={INK} strokeWidth="0.9" fill="none">
        <circle cx="20.6" cy="22.4" r="2.6" />
        <circle cx="27.4" cy="22.4" r="2.6" />
        <path d="M23.2 22.2 h1.6" />
      </g>
      <rect x="29.5" y="35" width="10" height="12.5" rx="1.6" fill="#FFF8EC" stroke="#8A5A16" strokeWidth="1" transform="rotate(-8 34.5 41)" />
      <rect x="32" y="34" width="5" height="2.2" rx="0.8" fill="#8A5A16" transform="rotate(-8 34.5 41)" />
      <g stroke="#C9A36A" strokeWidth="0.9" strokeLinecap="round" transform="rotate(-8 34.5 41)">
        <path d="M31.5 39 h6" />
        <path d="M31.5 41.4 h6" />
        <path d="M31.5 43.8 h4" />
      </g>
    </>
  );
}

/** Leo · 工程师：短发、头戴耳机、连帽衫。 */
function Leo() {
  const hair = "#2B2620";
  return (
    <>
      <Base shirt="#2F6DB5" />
      <path d="M17 36.2 C19 39.4 29 39.4 31 36.2" stroke="#245892" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M15.2 19.6 C14.6 13.4 18.4 10.6 23.6 10.6 C28.2 10.6 32.6 12.6 32.8 19 C31.2 17 29.4 16.4 27.6 16.6 C26.6 15.4 25 15 23.4 15.8 C21.4 15 18.2 16 15.2 19.6 Z" fill={hair} />
      <path d="M22 11 L24.6 8.8 L25 11.2 Z" fill={hair} />
      <Face />
      <path d="M14.2 22 C14.2 10.6 33.8 10.6 33.8 22" stroke="#1E3F66" strokeWidth="1.8" fill="none" />
      <rect x="12" y="19.4" width="4" height="7" rx="1.8" fill="#1E3F66" />
      <rect x="32" y="19.4" width="4" height="7" rx="1.8" fill="#1E3F66" />
      <g transform="translate(29.6 38.6)">
        <rect width="10" height="7.4" rx="1.6" fill="#16212E" />
        <path d="M3.2 2.2 L1.6 3.7 L3.2 5.2 M6.8 2.2 L8.4 3.7 L6.8 5.2" stroke="#8FD0FF" strokeWidth="0.9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </>
  );
}

/** Iris · 测试员：头顶丸子头、手持放大镜。 */
function Iris() {
  const hair = "#7A3B23";
  return (
    <>
      <circle cx="24" cy="10.2" r="3.8" fill={hair} />
      <Base shirt="#2F8A57" />
      <path d="M14.9 22.4 C14.4 15 18.6 12.2 24 12.2 C29.4 12.2 33.6 15 33.1 22.4 C31.8 19 28.4 16.8 25.2 16.6 C23.4 17.8 21 18.2 18.6 17.8 C16.8 18.8 15.6 20.4 14.9 22.4 Z" fill={hair} />
      <Face />
      <path d="M21 34.6 L24 37.6 L27 34.6" stroke="#22683F" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
      <path d="M29.4 44.6 L26.2 47.8" stroke="#5B3A1E" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="33.2" cy="40.6" r="5" fill="#EAF7FF" fillOpacity="0.85" stroke="#2A2118" strokeWidth="1.5" />
      <path d="M31 39 Q32 37.8 33.4 37.6" stroke="#FFFFFF" strokeWidth="1" fill="none" strokeLinecap="round" />
    </>
  );
}

const FIGURES: Record<AgentRole, () => React.ReactElement> = {
  pm: Mia,
  engineer: Leo,
  qa: Iris,
};

/**
 * 智能体头像：每个角色一张手绘风格的小插画（纯 SVG，无外部资源）。
 * active 时外圈缓慢呼吸，表示这个角色正在工作。
 */
export function AgentAvatar({ role, className, active }: { role: AgentRole; className?: string; active?: boolean }) {
  const a = AGENTS[role];
  const clip = useId();
  const Figure = FIGURES[role];
  return (
    <span aria-hidden data-role={role} className={cn("inline-flex h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-black/5", active && "atoms-ring", className)} style={{ background: a.tint, "--ring": a.color } as CSSProperties}>
      <svg viewBox="0 0 48 48" className="h-full w-full">
        <clipPath id={clip}>
          <circle cx="24" cy="24" r="24" />
        </clipPath>
        <g clipPath={`url(#${clip})`}>
          <Figure />
        </g>
      </svg>
    </span>
  );
}
