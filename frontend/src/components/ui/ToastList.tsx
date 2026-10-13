"use client";

import { Toast } from "@base-ui/react/toast";
import { CheckCircle, Info, WarningCircle, X } from "@phosphor-icons/react";

const icons = {
  success: <CheckCircle aria-hidden weight="duotone" className="size-5 shrink-0 text-added" />,
  error: <WarningCircle aria-hidden weight="duotone" className="size-5 shrink-0 text-removed" />,
  info: <Info aria-hidden weight="duotone" className="size-5 shrink-0 text-muted" />,
};

export function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((toast) => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      swipeDirection={["down", "right"]}
      data-surface
      className="rounded-[var(--radius-card)] border border-border bg-bg p-4 shadow-card transition-all duration-200 data-[ending-style]:translate-y-2 data-[ending-style]:opacity-0 data-[starting-style]:translate-y-2 data-[starting-style]:opacity-0"
    >
      <Toast.Content className="flex items-start gap-3">
        {icons[(toast.type as keyof typeof icons) ?? "info"] ?? icons.info}
        <div className="min-w-0 flex-1">
          <Toast.Title className="font-medium text-fg text-sm" />
          <Toast.Description className="mt-0.5 text-muted text-sm" />
          {toast.actionProps ? (
            <Toast.Action className="mt-2 min-h-9 rounded-md px-0 font-medium text-fg text-sm underline underline-offset-4" />
          ) : null}
        </div>
        <Toast.Close
          aria-label="Dismiss notification"
          className="-m-2 grid size-9 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
        >
          <X aria-hidden className="size-4" />
        </Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ));
}
