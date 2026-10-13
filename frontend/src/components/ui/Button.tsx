import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/format";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg" | "sm";

const variants: Record<Variant, string> = {
  primary: "bg-fg text-inverse-fg hover:opacity-90 disabled:opacity-40",
  secondary:
    "border border-border-strong bg-bg text-fg hover:bg-surface-2 disabled:text-subtle disabled:border-border",
  ghost: "text-fg hover:bg-surface-2 disabled:text-subtle",
  danger: "border border-border-strong text-removed hover:bg-removed-bg",
};

// Every size meets the 24px minimum target (WCAG 2.5.8); md and lg meet 44px.
const sizes: Record<Size, string> = {
  sm: "min-h-9 gap-1.5 px-3 text-sm",
  md: "min-h-11 gap-2 px-4 text-[0.9375rem]",
  lg: "min-h-13 gap-2.5 px-6 text-base",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
}) {
  return cn(
    "inline-flex select-none items-center justify-center rounded-[var(--radius-control)] font-medium",
    "transition-[background-color,opacity,transform] duration-150 active:scale-[0.98]",
    "disabled:cursor-not-allowed disabled:active:scale-100",
    variants[variant],
    sizes[size],
    className,
  );
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  /** Shown instead of children while busy; also sets aria-busy. */
  busyLabel?: string;
  busy?: boolean;
};

export function Button({
  variant,
  size,
  icon,
  busy = false,
  busyLabel,
  className,
  children,
  type = "button",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...props}
    >
      {busy ? <Spinner /> : icon}
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent",
        className,
      )}
    />
  );
}
