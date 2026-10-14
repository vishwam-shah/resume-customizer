"use client";

import { Info, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/Button";
import { ApiError, describeFit, exportDocument, type FitInfo, isAbort } from "@/lib/api/client";
import type { ResumeDoc } from "@/lib/api/types";

/**
 * The downloaded PDF's page, rendered on the server as an image: exactly what
 * the download will look like, and it displays on every device (embedded PDFs
 * don't on mobile browsers). Screen-reader users get the text view instead.
 */
export function PagePreview({ resume }: { resume: ResumeDoc }) {
  const [image, setImage] = useState<string | null>(null);
  const [fit, setFit] = useState<FitInfo | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let url: string | null = null;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await exportDocument(
          { kind: "resume", format: "png", resume },
          controller.signal,
        );
        url = URL.createObjectURL(result.blob);
        setImage(url);
        setFit(result.fit);
        setError(null);
      } catch (caught) {
        if (!isAbort(caught)) setError(ApiError.fromUnknown(caught));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [resume]);

  const note = describeFit(fit);

  return (
    <div>
      <p
        className="mb-3 flex items-start gap-2 text-muted text-sm"
        role="status"
        aria-live="polite"
      >
        {loading ? (
          <>
            <Spinner className="mt-0.5" /> Laying out your page…
          </>
        ) : note ? (
          <>
            <Info aria-hidden weight="fill" className="mt-0.5 size-4 shrink-0" />
            <span>
              {note}. This is exactly what the PDF download looks like.
              {fit?.trimmed.length
                ? " Trimmed items stay in the Text view and the Changes tab; nothing is deleted from your version."
                : ""}
            </span>
          </>
        ) : null}
      </p>

      {error && !image ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-card)] border border-removed bg-removed-bg p-4 text-sm"
        >
          <WarningCircle
            aria-hidden
            weight="fill"
            className="mt-0.5 size-4 shrink-0 text-removed"
          />
          <span>
            {error.message} {error.hint} The Text view below still shows your resume.
          </span>
        </div>
      ) : null}

      <div className="mx-auto max-w-[52rem] overflow-hidden rounded-[var(--radius-card)] border border-border bg-white shadow-card">
        {image ? (
          // biome-ignore lint/performance/noImgElement: a blob: URL from the API; next/image can't optimize it
          <img
            src={image}
            alt="Your tailored resume as a one-page document. Switch to Text view to read it with a screen reader."
            className={
              loading ? "w-full opacity-60 transition-opacity" : "w-full transition-opacity"
            }
          />
        ) : (
          <div className="aspect-[1/1.414] w-full animate-pulse bg-surface-2" />
        )}
      </div>
    </div>
  );
}
