import type { ButtonHTMLAttributes } from "react";

import { cx } from "@/lib/cx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-sage text-white hover:bg-sage-dark",
  secondary: "border border-line bg-surface hover:bg-sage-soft",
  ghost: "text-muted hover:bg-mist hover:text-pine",
  danger: "border border-line bg-surface text-rose hover:bg-rose-soft",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-2.5 text-xs",
  md: "h-9 gap-2 px-3.5 text-sm",
};

/** Classes for anything that should look like a button (also links). */
export function buttonClass(
  variant: Variant = "secondary",
  size: Size = "md",
  className?: string,
): string {
  return cx(
    "inline-flex shrink-0 items-center justify-center rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      {...props}
    />
  );
}
