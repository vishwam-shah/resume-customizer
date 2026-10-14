"use client";

import { Info, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/Button";
import { ApiError, describeFit, exportDocument, type FitInfo, isAbort } from "@/lib/api/client";
import type { ResumeDoc } from "@/lib/api/types";
import { ResumePreview } from "./ResumePreview";

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
        // The page renderer is unavailable: show the text version, never a dead end.
        <div>
          <p role="status" className="mb-3 flex items-start gap-2 text-muted text-sm">
            <WarningCircle aria-hidden weight="fill" className="mt-0.5 size-4 shrink-0" />
            The page preview isn't available right now, so here is the text version. Downloads still
            work.
          </p>
          <ResumePreview resume={resume} />
        </div>
      ) : null}

      <div
        hidden={Boolean(error && !image)}
        className="mx-auto max-w-[52rem] overflow-hidden rounded-[var(--radius-card)] border border-border bg-white shadow-card"
      >
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
