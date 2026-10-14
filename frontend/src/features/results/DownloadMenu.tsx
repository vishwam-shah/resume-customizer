"use client";

import { Menu } from "@base-ui/react/menu";
import {
  CaretDown,
  DownloadSimple,
  FileCode,
  FileDoc,
  FilePdf,
  FileText,
} from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";
import { buttonClasses, Spinner } from "@/components/ui/Button";
import { ApiError, describeFit, exportDocument } from "@/lib/api/client";
import type { ExportFormat, ExportRequest } from "@/lib/api/types";

type FormatOption = { format: ExportFormat; label: string; hint: string; icon: typeof FilePdf };

const resumeFormats: FormatOption[] = [
  { format: "pdf", label: "PDF", hint: "One page, best for applying", icon: FilePdf },
  { format: "docx", label: "Word", hint: "Edit before sending", icon: FileDoc },
  { format: "tex", label: "LaTeX", hint: "Jake's template, for Overleaf", icon: FileCode },
  { format: "txt", label: "Plain text", hint: "Paste into forms", icon: FileText },
];

// A cover letter isn't a resume template: no LaTeX for it.
const letterFormats = resumeFormats.filter((option) => option.format !== "tex");

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Props = {
  label?: string;
  build: (format: ExportFormat) => ExportRequest;
  variant?: "primary" | "secondary";
  disabled?: boolean;
};

export function DownloadMenu({ label = "Download", build, variant = "primary", disabled }: Props) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const options = build("pdf").kind === "coverLetter" ? letterFormats : resumeFormats;

  async function download(format: ExportFormat) {
    setBusy(format);
    try {
      const { blob, fileName, fit } = await exportDocument(build(format));
      saveBlob(blob, fileName);
      const fitNote = describeFit(fit);
      toast.success("Downloaded", {
        description: fitNote ? `${fileName} · ${fitNote}` : fileName,
      });
    } catch (error) {
      const apiError = ApiError.fromUnknown(error);
      toast.error(apiError.message, {
        description: apiError.hint,
        action: { label: "Try again", onClick: () => void download(format) },
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        disabled={disabled || busy !== null}
        aria-busy={busy !== null || undefined}
        className={buttonClasses({ variant })}
      >
        {busy ? <Spinner /> : <DownloadSimple aria-hidden className="size-4" />}
        {busy ? `Preparing ${busy.toUpperCase()}…` : label}
        <CaretDown aria-hidden className="size-3.5 opacity-70" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={6}>
          <Menu.Popup
            data-surface
            className="min-w-64 origin-[var(--transform-origin)] rounded-[var(--radius-control)] border border-border bg-bg p-1 shadow-card outline-none transition-[opacity,transform] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
          >
            {options.map(({ format, label: name, hint, icon: Icon }) => (
              <Menu.Item
                key={format}
                onClick={() => void download(format)}
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-3 outline-none data-[highlighted]:bg-surface-2"
              >
                <Icon aria-hidden weight="duotone" className="size-5 text-muted" />
                <span className="flex flex-col">
                  <span className="font-medium text-sm">{name}</span>
                  <span className="text-muted text-xs">{hint}</span>
                </span>
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
