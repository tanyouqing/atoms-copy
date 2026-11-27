import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-[var(--ink)] text-white hover:bg-black disabled:bg-zinc-300 disabled:text-zinc-50",
  secondary: "border border-[var(--border)] bg-[var(--panel)] text-zinc-800 hover:bg-zinc-50 disabled:text-zinc-400",
  ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:text-zinc-300",
  danger: "bg-[var(--danger)] text-white hover:bg-red-700 disabled:bg-red-300",
};
const SIZES: Record<Size, string> = { sm: "h-8 px-3 text-sm", md: "h-9 px-4 text-sm", icon: "h-8 w-8 justify-center" };

export function Button({ variant = "secondary", size = "md", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1 disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
