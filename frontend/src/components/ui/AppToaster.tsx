"use client";

import { CheckCircle, Info, WarningCircle, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";

/** Follow the app's theme (data-theme on <html>), which can differ from the OS. */
function useAppTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTheme(root.dataset.theme === "dark" ? "dark" : "light");
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

/**
 * Sonner, styled with the design tokens (Sonner's own rich colors fall below
 * WCAG AA for text). Sits above the mobile tab bar on phones.
 */
export function AppToaster() {
  const theme = useAppTheme();
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      closeButton
      visibleToasts={3}
      offset={16}
      mobileOffset={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
      containerAriaLabel="Notifications"
      icons={{
        success: <CheckCircle aria-hidden weight="fill" className="size-5 text-added" />,
        error: <WarningCircle aria-hidden weight="fill" className="size-5 text-removed" />,
        info: <Info aria-hidden weight="fill" className="size-5 text-muted" />,
        close: <X aria-hidden className="size-3.5" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-[var(--radius-card)] !border !border-border !bg-bg !text-fg !shadow-card !font-sans !gap-3 !p-4",
          title: "!font-medium !text-sm",
          description: "!text-muted !text-sm",
          error: "!border-removed",
          actionButton: "!min-h-9 !rounded-md !bg-fg !px-3 !font-medium !text-inverse-fg !text-sm",
          cancelButton: "!min-h-9 !rounded-md !bg-surface-2 !px-3 !text-fg !text-sm",
          closeButton: "!border-border !bg-bg !text-muted hover:!text-fg",
        },
      }}
    />
  );
}
