"use client";

import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import {
  ArrowsClockwise,
  FileCode,
  FileDoc,
  FilePdf,
  Trash,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import { type DragEvent, useId, useRef, useState } from "react";
import { Spinner } from "@/components/ui/Button";
import type { ParsedFile } from "@/lib/api/types";
import { cn, formatBytes, pluralize } from "@/lib/format";
import { limits } from "@/lib/limits";
import { LatexPasteField } from "./LatexPasteField";

type Props = {
  file: ParsedFile | null;
  uploadingName: string | null;
  error: { message: string; hint: string } | null;
  /** Validation error from submitting the form without a file. */
  requiredError: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  latexSource: string | null;
  onLatex: (file: ParsedFile, source: string) => void;
};

export function ResumeDropzone({
  file,
  uploadingName,
  error,
  requiredError,
  onSelect,
  onRemove,
  latexSource,
  onLatex,
}: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<"file" | "latex">(latexSource ? "latex" : "file");
  const [editingLatex, setEditingLatex] = useState(false);
  const showFile = Boolean(file) && !editingLatex;
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const shownError = error ?? (requiredError ? { message: requiredError, hint: "" } : null);

  const choose = () => inputRef.current?.click();

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) onSelect(dropped);
  }

  const input = (
    <input
      ref={inputRef}
      id={id}
      type="file"
      accept={[...limits.acceptedExtensions, ...limits.acceptedMimeTypes].join(",")}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        const chosen = e.target.files?.[0];
        if (chosen) onSelect(chosen);
        e.target.value = ""; // allow choosing the same file again after an error
      }}
    />
  );

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <p id={labelId} className="font-medium">
          Resume
        </p>
        {!showFile && !uploadingName ? (
          <ToggleGroup
            aria-label="How to add your resume"
            value={[mode]}
            onValueChange={(value) => value[0] && setMode(value[0] as "file" | "latex")}
            className="inline-flex rounded-[var(--radius-control)] border border-border bg-surface p-0.5"
          >
            {(["file", "latex"] as const).map((value) => (
              <Toggle
                key={value}
                value={value}
                className="flex min-h-8 items-center gap-1.5 rounded-[calc(var(--radius-control)-2px)] px-2.5 text-muted text-sm hover:text-fg data-[pressed]:bg-bg data-[pressed]:text-fg data-[pressed]:shadow-card"
              >
                {value === "file" ? (
                  <UploadSimple aria-hidden className="size-4" />
                ) : (
                  <FileCode aria-hidden className="size-4" />
                )}
                {value === "file" ? "Upload file" : "Paste LaTeX"}
              </Toggle>
            ))}
          </ToggleGroup>
        ) : null}
      </div>
      <p id={hintId} className="text-muted text-sm">
        {mode === "latex" && !showFile
          ? "Your .tex source. The tailored version keeps your template."
          : `PDF or Word (.docx), up to ${formatBytes(limits.maxUploadBytes)}.`}
      </p>
      {input}

      {uploadingName ? (
        <div
          role="status"
          className="flex min-h-72 flex-1 flex-col items-center justify-center gap-3 rounded-[var(--radius-control)] border border-border-strong border-dashed bg-surface px-6 text-center"
        >
          <Spinner className="size-6 text-muted" />
          <p className="font-medium">Reading {uploadingName}…</p>
          <p className="text-muted text-sm">Extracting text. This takes a second.</p>
        </div>
      ) : showFile && file ? (
        <FileCard
          file={file}
          onReplace={file.fileType === "tex" ? () => setEditingLatex(true) : choose}
          onRemove={onRemove}
        />
      ) : mode === "latex" ? (
        <LatexPasteField
          initialSource={latexSource ?? ""}
          requiredError={requiredError}
          onParsed={(parsed, source) => {
            setEditingLatex(false);
            onLatex(parsed, source);
          }}
        />
      ) : (
        // biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop is a pointer enhancement; the Choose file button is the accessible path (WCAG 2.5.7)
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "flex min-h-72 flex-1 flex-col items-center justify-center gap-4 rounded-[var(--radius-control)] border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragging ? "border-fg bg-surface-2" : "border-border-strong bg-surface",
            shownError && !dragging && "border-removed",
          )}
        >
          <UploadSimple aria-hidden weight="duotone" className="size-10 text-muted" />
          <div className="space-y-1">
            <p className="font-medium">{dragging ? "Drop to upload" : "Drag your resume here"}</p>
            <p className="text-muted text-sm">or</p>
          </div>
          {/* The button is the accessible path; dragging is an enhancement (WCAG 2.5.7). */}
          <button
            type="button"
            onClick={choose}
            aria-labelledby={`${labelId} ${id}-choose`}
            aria-describedby={cn(hintId, shownError && errorId)}
            aria-invalid={shownError ? true : undefined}
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-border-strong bg-bg px-4 font-medium hover:bg-surface-2"
          >
            <span id={`${id}-choose`}>Choose file</span>
          </button>
        </div>
      )}

      {shownError && !uploadingName ? (
        <div id={errorId} className="flex items-start gap-1.5 text-removed text-sm">
          <WarningCircle aria-hidden weight="fill" className="mt-0.5 size-4 shrink-0" />
          <p>
            {shownError.message}
            {shownError.hint ? <span className="block text-muted">{shownError.hint}</span> : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function FileCard({
  file,
  onReplace,
  onRemove,
}: {
  file: ParsedFile;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const Icon = file.fileType === "pdf" ? FilePdf : file.fileType === "tex" ? FileCode : FileDoc;
  const details = [
    formatBytes(file.sizeBytes),
    file.fileType === "pdf"
      ? pluralize(file.pageCount, "page")
      : file.fileType === "tex"
        ? "LaTeX source"
        : "Word document",
    `${file.wordCount.toLocaleString()} words`,
  ];

  return (
    <div className="flex min-h-72 flex-1 flex-col rounded-[var(--radius-control)] border border-border-strong bg-bg">
      <div className="flex items-start gap-4 p-5">
        <Icon aria-hidden weight="duotone" className="size-11 shrink-0 text-fg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium" title={file.fileName}>
            {file.fileName}
          </p>
          <p className="mt-0.5 text-muted text-sm">{details.join(" · ")}</p>
        </div>
      </div>

      <div className="mx-5 flex-1 overflow-hidden rounded-md border border-border bg-surface">
        <p className="sr-only">Text we extracted from your resume, first lines:</p>
        <pre className="max-h-44 overflow-hidden whitespace-pre-wrap p-3 font-mono text-muted text-xs leading-relaxed [mask-image:linear-gradient(to_bottom,black_60%,transparent)]">
          {file.text.slice(0, 600)}
        </pre>
      </div>

      {file.warnings.length > 0 && (
        <ul className="mx-5 mt-3 space-y-1.5">
          {file.warnings.map((warning) => (
            <li
              key={warning}
              className="flex items-start gap-2 rounded-md bg-warn-bg px-3 py-2 text-sm text-warn"
            >
              <WarningCircle aria-hidden weight="fill" className="mt-0.5 size-4 shrink-0" />
              {warning}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 p-5 pt-4">
        <button
          type="button"
          onClick={onReplace}
          className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-border-strong px-4 font-medium text-sm hover:bg-surface-2"
        >
          <ArrowsClockwise aria-hidden className="size-4" />
          {file.fileType === "tex" ? "Edit LaTeX" : "Replace"}
          <span className="sr-only"> {file.fileName}</span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-4 font-medium text-muted text-sm hover:bg-surface-2 hover:text-fg"
        >
          <Trash aria-hidden className="size-4" />
          Remove<span className="sr-only"> {file.fileName}</span>
        </button>
      </div>
    </div>
  );
}
