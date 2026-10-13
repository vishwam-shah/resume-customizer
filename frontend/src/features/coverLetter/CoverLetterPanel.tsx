"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Toast } from "@base-ui/react/toast";
import { ArrowsClockwise, Copy, Envelope, Stop } from "@phosphor-icons/react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ApiError, isAbort } from "@/lib/api/client";
import { streamEvents } from "@/lib/api/sse";
import type { JobAnalysis, LetterLength, ResumeDoc } from "@/lib/api/types";
import { DownloadMenu } from "../results/DownloadMenu";

const RadioRoot = Radio.Root;

type Props = {
  jobDescription: string;
  resume: ResumeDoc;
  analysis: JobAnalysis;
  text: string;
  onChange: (text: string) => void;
};

const lengths: Array<{ value: LetterLength; label: string }> = [
  { value: "short", label: "Short, about 150 words" },
  { value: "standard", label: "Standard, about 300 words" },
];

export function CoverLetterPanel({ jobDescription, resume, analysis, text, onChange }: Props) {
  const id = useId();
  const toasts = Toast.useToastManager();
  const [length, setLength] = useState<LetterLength>("standard");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const controller = useRef<AbortController | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  async function generate() {
    const previous = text;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setError(null);
    setStreaming(true);
    let draft = "";
    onChange("");
    try {
      const stream = streamEvents(
        "/api/v1/cover-letter",
        { jobDescription, resume, analysis, length },
        abort.signal,
      );
      for await (const { event, data } of stream) {
        if (event === "token") {
          draft += data as string;
          onChange(draft);
        }
      }
      onChange(draft.trim());
      if (previous) {
        toasts.add({
          title: "New cover letter written",
          type: "success",
          actionProps: { children: "Undo", onClick: () => onChange(previous) },
        });
      }
      requestAnimationFrame(() => editorRef.current?.focus());
    } catch (caught) {
      if (isAbort(caught)) {
        onChange(draft.trim());
        return;
      }
      setError(ApiError.fromUnknown(caught));
      onChange(previous);
    } finally {
      setStreaming(false);
      controller.current = null;
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toasts.add({ title: "Copied to clipboard", type: "success" });
    } catch {
      editorRef.current?.select();
      toasts.add({
        title: "Select the text and copy it with Ctrl+C",
        type: "info",
      });
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p id={`${id}-length`} className="font-medium text-sm">
            Length
          </p>
          <RadioGroup
            aria-labelledby={`${id}-length`}
            value={length}
            onValueChange={(value) => setLength(value as LetterLength)}
            disabled={streaming}
            className="mt-2 flex flex-wrap gap-2"
          >
            {lengths.map((option) => (
              <label
                key={option.value}
                className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[var(--radius-control)] border border-border-strong px-3 text-sm has-[[data-checked]]:border-fg has-[[data-checked]]:bg-surface-2"
              >
                <RadioRoot
                  value={option.value}
                  className="grid size-4 place-items-center rounded-full border border-border-strong data-[checked]:border-fg"
                >
                  <Radio.Indicator className="size-2 rounded-full bg-fg" />
                </RadioRoot>
                <span>{option.label}</span>
              </label>
            ))}
          </RadioGroup>
        </div>
        {streaming ? (
          <Button
            variant="secondary"
            icon={<Stop aria-hidden className="size-4" />}
            onClick={() => controller.current?.abort()}
          >
            Stop writing
          </Button>
        ) : (
          <Button
            onClick={generate}
            icon={
              text ? (
                <ArrowsClockwise aria-hidden className="size-4" />
              ) : (
                <Envelope aria-hidden className="size-4" />
              )
            }
          >
            {text ? "Write a new version" : "Write cover letter"}
          </Button>
        )}
      </div>

      <p role="status" className="sr-only">
        {streaming
          ? "Writing your cover letter."
          : text
            ? `Cover letter ready, ${words} words.`
            : ""}
      </p>

      {error ? (
        <div
          role="alert"
          className="mt-6 rounded-[var(--radius-card)] border border-removed bg-removed-bg p-4"
        >
          <p className="font-medium text-removed">{error.message}</p>
          <p className="mt-0.5 text-sm">{error.hint}</p>
        </div>
      ) : null}

      {text || streaming ? (
        <div className="mt-6">
          <label htmlFor={`${id}-editor`} className="sr-only">
            Cover letter text, editable
          </label>
          <textarea
            id={`${id}-editor`}
            ref={editorRef}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            readOnly={streaming}
            aria-busy={streaming || undefined}
            rows={18}
            className="w-full resize-y rounded-[var(--radius-card)] border border-border-strong bg-bg px-6 py-5 font-serif text-base leading-relaxed hover:border-fg"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="tabular text-subtle text-sm">
              {words} words
              {streaming ? " · writing…" : " · you can edit this text"}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={streaming || !text}
                onClick={copy}
                icon={<Copy aria-hidden className="size-4" />}
              >
                Copy
              </Button>
              <DownloadMenu
                variant="secondary"
                disabled={streaming || !text}
                build={(format) => ({
                  kind: "coverLetter",
                  format,
                  resume,
                  coverLetter: text,
                })}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-[var(--radius-card)] border border-border border-dashed p-10 text-center">
          <Envelope aria-hidden weight="duotone" className="mx-auto size-10 text-muted" />
          <p className="mt-3 font-medium">A cover letter written for this job</p>
          <p className="mx-auto mt-1 max-w-sm text-muted text-sm">
            Built only from your resume. It streams in as it's written, and you can edit it before
            downloading.
          </p>
        </div>
      )}
    </div>
  );
}
