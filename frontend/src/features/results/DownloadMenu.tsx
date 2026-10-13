"use client";

import { Menu } from "@base-ui/react/menu";
import { Toast } from "@base-ui/react/toast";
import { CaretDown, DownloadSimple, FileDoc, FilePdf, FileText } from "@phosphor-icons/react";
import { useState } from "react";
import { buttonClasses, Spinner } from "@/components/ui/Button";
import { ApiError, exportDocument } from "@/lib/api/client";
import type { ExportFormat, ExportRequest } from "@/lib/api/types";

const formats: Array<{
  format: ExportFormat;
  label: string;
  hint: string;
  icon: typeof FilePdf;
}> = [
  { format: "pdf", label: "PDF", hint: "Best for applying", icon: FilePdf },
  { format: "docx", label: "Word", hint: "Edit before sending", icon: FileDoc },
  {
    format: "txt",
    label: "Plain text",
    hint: "Paste into forms",
    icon: FileText,
  },
];

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
  const toasts = Toast.useToastManager();
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  async function download(format: ExportFormat) {
    setBusy(format);
    try {
      const { blob, fileName } = await exportDocument(build(format));
      saveBlob(blob, fileName);
      toasts.add({
        title: "Downloaded",
        description: fileName,
        type: "success",
      });
    } catch (error) {
      const apiError = ApiError.fromUnknown(error);
      toasts.add({
        title: apiError.message,
        description: apiError.hint,
        type: "error",
        priority: "high",
        timeout: 0,
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
            className="min-w-56 origin-[var(--transform-origin)] rounded-[var(--radius-control)] border border-border bg-bg p-1 shadow-card outline-none transition-[opacity,transform] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
          >
            {formats.map(({ format, label: name, hint, icon: Icon }) => (
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
