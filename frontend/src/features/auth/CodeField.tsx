"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/format";

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Called once all digits are in, so the user doesn't have to press a button. */
  onComplete?: (value: string) => void;
  error?: string | null;
  length?: number;
  describedBy?: string;
};

/**
 * One field, not six boxes: pasting works, screen readers announce one input,
 * and autocomplete="one-time-code" lets phones offer the code from the email.
 */
export const CodeField = forwardRef<HTMLInputElement, Props>(function CodeField(
  { id, value, onChange, onComplete, error, length = 6, describedBy },
  ref,
) {
  return (
    <div>
      <label htmlFor={id} className="font-medium text-sm">
        {length}-digit code
      </label>
      <input
        ref={ref}
        id={id}
        name="code"
        value={value}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, length);
          onChange(digits);
          if (digits.length === length) onComplete?.(digits);
        }}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={length}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [describedBy, error && `${id}-error`].filter(Boolean).join(" ") || undefined
        }
        className={cn(
          "mt-1.5 block min-h-14 w-full rounded-[var(--radius-control)] border bg-bg px-4 text-center font-mono text-2xl tracking-[0.5em] hover:border-fg",
          error ? "border-removed" : "border-border-strong",
        )}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-removed text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
});
