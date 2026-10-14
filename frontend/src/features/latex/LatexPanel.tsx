"use client";

import { ArrowCounterClockwise, Copy, DownloadSimple, Info, Leaf } from "@phosphor-icons/react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Button, Spinner } from "@/components/ui/Button";
import { ApiError, applyLatex, isAbort } from "@/lib/api/client";
import type { LatexApplyResult, ResumeDoc } from "@/lib/api/types";
import { pluralize } from "@/lib/format";
import { saveBlob } from "../results/DownloadMenu";
import { CompiledPreview } from "./CompiledPreview";

type Props = {
  source: string;
  original: ResumeDoc;
  tailored: ResumeDoc;
  /** The user's own edits, or null to show the generated source. */
  edited: string | null;
  onEdit: (text: string | null) => void;
  fileStem: string;
};

/** Overleaf's documented "open a document" endpoint: a form POST with the source. */
function openInOverleaf(source: string, name: string) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "https://www.overleaf.com/docs";
  form.target = "_blank";
  for (const [key, value] of [
    ["encoded_snip", encodeURIComponent(source)],
    ["snip_name", name],
    ["engine", "pdflatex"],
  ]) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.append(input);
  }
  document.body.append(form);
  form.submit();
  form.remove();
}

export function LatexPanel({ source, original, tailored, edited, onEdit, fileStem }: Props) {
  const id = useId();
  const [result, setResult] = useState<LatexApplyResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  // Re-apply whenever kept/reverted changes alter the tailored resume.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        setResult(await applyLatex({ source, original, tailored }, controller.signal));
        setError(null);
      } catch (caught) {
        if (!isAbort(caught)) setError(ApiError.fromUnknown(caught));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [source, original, tailored]);

  const text = edited ?? result?.source ?? "";
  const fileName = `${fileStem}-Resume.tex`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("LaTeX copied to clipboard");
    } catch {
      toast.error("Couldn't access the clipboard", { description: "Use Download .tex instead." });
    }
  }

  if (error && !result) {
    return (
      <div
        role="alert"
        className="rounded-[var(--radius-card)] border border-removed bg-removed-bg p-4"
      >
        <p className="font-medium text-removed">{error.message}</p>
        <p className="mt-0.5 text-sm">{error.hint}</p>
      </div>
    );
  }

  const updated = result
    ? [
        result.bulletsUpdated && pluralize(result.bulletsUpdated, "bullet"),
        result.summaryUpdated && "the summary",
        result.skillsUpdated && pluralize(result.skillsUpdated, "skill line"),
      ].filter(Boolean)
    : [];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl text-sm" role="status" aria-live="polite">
          {loading && !result ? (
            <p className="flex items-center gap-2 text-muted">
              <Spinner /> Writing your changes into the template and fitting it on one page…
            </p>
          ) : result ? (
            <p>
              <span className="font-medium">
                {updated.length ? `Updated ${updated.join(", ")}` : "No text changes to write"}
              </span>
              <span className="text-muted">
                {" "}
                in your own template. Preamble, macros and layout are unchanged.
              </span>
              {result.bulletsRemoved > 0 ? (
                <span className="mt-1 block text-muted">
                  To keep it on one page,{" "}
                  {pluralize(result.bulletsRemoved, "lower-priority bullet")}{" "}
                  {result.bulletsRemoved === 1 ? "was" : "were"} left out. They're still in the
                  Changes tab if you'd rather shorten something else.
                </span>
              ) : null}
            </p>
          ) : null}
          {result?.unmatched.length ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-warn">
              <Info aria-hidden weight="fill" className="mt-0.5 size-4 shrink-0" />
              Couldn't place {result.unmatched.join("; ")}. Edit those lines below, or keep them as
              they are.
            </p>
          ) : null}
          {edited !== null ? (
            <p className="mt-1.5 text-muted">
              You're viewing your own edits. Reset to see the latest tailored version.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {edited !== null ? (
            <Button
              variant="ghost"
              icon={<ArrowCounterClockwise aria-hidden className="size-4" />}
              onClick={() => onEdit(null)}
            >
              Reset to tailored
            </Button>
          ) : null}
          <Button
            variant="secondary"
            icon={<Copy aria-hidden className="size-4" />}
            onClick={copy}
            disabled={!text}
          >
            Copy
          </Button>
          <Button
            variant="secondary"
            icon={<DownloadSimple aria-hidden className="size-4" />}
            disabled={!text}
            onClick={() => {
              saveBlob(new Blob([text], { type: "application/x-tex" }), fileName);
              toast.success("Downloaded", { description: fileName });
            }}
          >
            Download .tex
          </Button>
          <Button
            icon={<Leaf aria-hidden className="size-4" />}
            disabled={!text}
            onClick={() => openInOverleaf(text, fileName)}
          >
            Open in Overleaf
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col">
          <label htmlFor={`${id}-source`} className="font-medium text-sm">
            Tailored LaTeX, editable
          </label>
          <textarea
            id={`${id}-source`}
            value={text}
            onChange={(e) => onEdit(e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            rows={30}
            aria-busy={loading || undefined}
            className="mt-2 min-h-[32rem] w-full flex-1 resize-y rounded-[var(--radius-card)] border border-border-strong bg-surface px-4 py-3 font-mono text-[0.8125rem] leading-relaxed hover:border-fg"
          />
        </div>
        {text ? (
          <CompiledPreview source={text} edited={edited !== null} fileName={fileName} />
        ) : null}
      </div>
    </div>
  );
}
