"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ApiError, parseLatex } from "@/lib/api/client";
import type { ParsedFile } from "@/lib/api/types";
import { cn } from "@/lib/format";

type Props = {
  initialSource: string;
  onParsed: (file: ParsedFile, source: string) => void;
  requiredError: string | null;
};

export function LatexPasteField({ initialSource, onParsed, requiredError }: Props) {
  const id = useId();
  const [source, setSource] = useState(initialSource);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; hint: string } | null>(null);
  const shown = error ?? (requiredError ? { message: requiredError, hint: "" } : null);

  async function use() {
    if (!source.trim()) {
      setError({ message: "Paste your LaTeX source first.", hint: "" });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onParsed(await parseLatex(source), source);
    } catch (caught) {
      const apiError = ApiError.fromUnknown(caught);
      setError({ message: apiError.message, hint: apiError.hint });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-2">
      <label htmlFor={id} className="sr-only">
        LaTeX source
      </label>
      <textarea
        id={id}
        value={source}
        onChange={(e) => setSource(e.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        rows={12}
        placeholder={"\\documentclass{article}\n...\n\\begin{document}\n...\n\\end{document}"}
        aria-describedby={cn(`${id}-hint`, shown && `${id}-error`)}
        aria-invalid={shown ? true : undefined}
        className={cn(
          "min-h-60 w-full flex-1 resize-y rounded-[var(--radius-control)] border bg-bg px-4 py-3 font-mono text-sm leading-relaxed placeholder:text-subtle hover:border-fg",
          shown ? "border-removed" : "border-border-strong",
        )}
      />
      <p id={`${id}-hint`} className="text-muted text-sm">
        Paste the whole .tex file. Your layout is kept: only the text is tailored, and you get the
        LaTeX back to compile in Overleaf.
      </p>
      {shown ? (
        <div id={`${id}-error`} className="flex items-start gap-1.5 text-removed text-sm">
          <WarningCircle aria-hidden weight="fill" className="mt-0.5 size-4 shrink-0" />
          <p>
            {shown.message}
            {shown.hint ? <span className="block text-muted">{shown.hint}</span> : null}
          </p>
        </div>
      ) : null}
      <div>
        <Button variant="secondary" onClick={use} busy={busy} busyLabel="Reading LaTeX…">
          Use this LaTeX
        </Button>
      </div>
    </div>
  );
}
