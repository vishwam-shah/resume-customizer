"use client";

import { createContext, type ReactNode, use, useCallback, useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PwaContextValue = {
  /** True when the browser offers installation and the app isn't installed yet. */
  canInstall: boolean;
  install: () => Promise<void>;
};

const PwaContext = createContext<PwaContextValue>({ canInstall: false, install: async () => {} });

export const usePwa = () => use(PwaContext);

export function PwaProvider({ children }: { children: ReactNode }) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    // The service worker would cache dev bundles and fight hot reload.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    }
    const onPrompt = (event: Event) => {
      event.preventDefault(); // show our own button instead of the mini-infobar
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => setPromptEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  }, [promptEvent]);

  return <PwaContext value={{ canInstall: promptEvent !== null, install }}>{children}</PwaContext>;
}
