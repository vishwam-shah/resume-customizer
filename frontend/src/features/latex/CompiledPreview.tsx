"use client";

import { ArrowsClockwise, CheckCircle, FilePdf, WarningCircle } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, Spinner } from "@/components/ui/Button";
import { ApiError, compileLatex, isAbort } from "@/lib/api/client";
import { pluralize } from "@/lib/format";
import { saveBlob } from "../results/DownloadMenu";

type Props = {
  source: string;
  /** True while the user is typing in the editor: wait before recompiling. */
  edited: boolean;
  fileName: string;
};

/**
 * Compiles the LaTeX on the server and shows page 1 as it will print: proof
 * that the tailored source still compiles, before anyone opens Overleaf.
 */
export function CompiledPreview({ source, edited, fileName }: Props) {
  const [image, setImage] = useState<string | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const controller = useRef<AbortController | null>(null);

  const compile = useCallback(async (latex: string) => {
    if (!latex.trim()) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setCompiling(true);
    try {
      const result = await compileLatex(latex, "png", abort.signal);
      setImage((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(result.blob);
      });
      setPages(result.pages);
      setError(null);
    } catch (caught) {
      if (!isAbort(caught)) setError(ApiError.fromUnknown(caught));
    } finally {
      if (controller.current === abort) setCompiling(false);
    }
  }, []);

  // Generated source: compile right away. While editing: after a pause.
  useEffect(() => {
    const timer = window.setTimeout(() => void compile(source), edited ? 1500 : 200);
    return () => window.clearTimeout(timer);
  }, [source, edited, compile]);

  useEffect(() => () => controller.current?.abort(), []);

  async function downloadPdf() {
    setDownloading(true);
    try {
      const { blob, pages: count } = await compileLatex(source, "pdf");
      const name = fileName.replace(/\.tex$/, ".pdf");
      saveBlob(blob, name);
      toast.success("Downloaded", {
        description: `${name} · compiled from your LaTeX · ${pluralize(count, "page")}`,
      });
    } catch (caught) {
      const apiError = ApiError.fromUnknown(caught);
      toast.error(apiError.message, { description: apiError.hint });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section aria-labelledby="compiled-heading" className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="compiled-heading" className="font-medium text-sm">
          Compiled preview
        </h3>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowsClockwise aria-hidden className="size-4" />}
            onClick={() => void compile(source)}
            disabled={compiling}
          >
            Recompile
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<FilePdf aria-hidden className="size-4" />}
            onClick={downloadPdf}
            busy={downloading}
            busyLabel="Compiling…"
            disabled={Boolean(error) || !image}
          >
            Download PDF
          </Button>
        </div>
      </div>

      <p className="mt-2 flex items-start gap-1.5 text-sm" role="status" aria-live="polite">
        {compiling ? (
          <span className="flex items-center gap-2 text-muted">
            <Spinner /> Compiling with XeLaTeX…
          </span>
        ) : error ? (
          <span className="flex items-start gap-1.5 text-removed">
            <WarningCircle aria-hidden weight="fill" className="mt-0.5 size-4 shrink-0" />
            <span>
              {error.message} <span className="text-muted">{error.hint}</span>
            </span>
          </span>
        ) : pages !== null ? (
          <span className="flex items-center gap-1.5 text-added">
            <CheckCircle aria-hidden weight="fill" className="size-4" />
            Compiles cleanly · {pluralize(pages, "page")}
            {pages > 1 ? (
              <span className="text-warn">: over one page, shorten a few bullets</span>
            ) : null}
          </span>
        ) : null}
      </p>

      <div className="mt-3 overflow-hidden rounded-[var(--radius-card)] border border-border bg-white shadow-card">
        {image ? (
          // biome-ignore lint/performance/noImgElement: a blob: URL from the API; next/image can't optimize it
          <img
            src={image}
            alt="Page 1 of your compiled LaTeX resume"
            className={
              compiling ? "w-full opacity-60 transition-opacity" : "w-full transition-opacity"
            }
          />
        ) : (
          <div className="aspect-[1/1.294] w-full animate-pulse bg-surface-2" />
        )}
      </div>
    </section>
  );
}
