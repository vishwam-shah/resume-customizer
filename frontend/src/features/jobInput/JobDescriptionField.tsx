"use client";

import { ClipboardText, WarningCircle } from "@phosphor-icons/react";
import { type KeyboardEvent, useId } from "react";
import { cn } from "@/lib/format";
import { limits } from "@/lib/limits";

type Props = {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  onSubmitShortcut: () => void;
};

export function JobDescriptionField({ value, onChange, error, onSubmitShortcut }: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  const countId = `${id}-count`;
  const errorId = `${id}-error`;
  const length = value.trim().length;
  const enough = length >= limits.minJobDescriptionChars;

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) onChange(text);
    } catch {
      // Permission denied or unsupported: the textarea's own paste still works.
      document.getElementById(id)?.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onSubmitShortcut();
    }
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <label htmlFor={id} className="font-medium">
          Job description
        </label>
        <button
          type="button"
          onClick={pasteFromClipboard}
          className="-mr-2 inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-muted text-sm hover:bg-surface-2 hover:text-fg"
        >
          <ClipboardText aria-hidden className="size-4" />
          Paste
        </button>
      </div>
      <p id={hintId} className="text-muted text-sm">
        Paste the full posting, including requirements and responsibilities.
      </p>
      <textarea
        id={id}
        name="jobDescription"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={14}
        spellCheck={false}
        placeholder={
          "e.g. Full Stack Engineer\n\nWhat you'll do\n- Build features in React and FastAPI…"
        }
        aria-describedby={cn(hintId, countId, error && errorId)}
        aria-invalid={error ? true : undefined}
        className={cn(
          "min-h-72 w-full flex-1 resize-y rounded-[var(--radius-control)] border bg-bg px-4 py-3 text-base leading-relaxed",
          "placeholder:text-subtle hover:border-fg",
          error ? "border-removed" : "border-border-strong",
        )}
      />
      <div className="flex items-start justify-between gap-3 text-sm">
        {error ? (
          <p id={errorId} className="flex items-start gap-1.5 text-removed">
            <WarningCircle aria-hidden weight="fill" className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        ) : (
          <span />
        )}
        <p id={countId} className={cn("tabular shrink-0", enough ? "text-muted" : "text-subtle")}>
          {length.toLocaleString()}
          <span className="sr-only"> characters entered</span>
          {!enough && <span aria-hidden> / {limits.minJobDescriptionChars} min</span>}
        </p>
      </div>
    </div>
  );
}
