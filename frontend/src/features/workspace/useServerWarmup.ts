"use client";

import { useEffect, useState } from "react";
import { getMeta } from "@/lib/api/client";

export type ServerStatus = "checking" | "waking" | "ready" | "unreachable";

/**
 * The free backend host sleeps when idle and takes ~30-50 s to wake. Ping it
 * as soon as the page opens, so it is warm by the time the user submits, and
 * report "waking" if it is slow, so a long first request doesn't look broken.
 */
export function useServerWarmup(): ServerStatus {
  const [status, setStatus] = useState<ServerStatus>("checking");

  useEffect(() => {
    const controller = new AbortController();
    const slow = window.setTimeout(() => setStatus("waking"), 2500);
    const attempt = async (triesLeft: number): Promise<void> => {
      try {
        await getMeta(controller.signal);
        setStatus("ready");
      } catch {
        if (controller.signal.aborted) return;
        if (triesLeft > 0) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          return attempt(triesLeft - 1);
        }
        setStatus("unreachable");
      }
    };
    void attempt(12).finally(() => window.clearTimeout(slow));
    return () => {
      controller.abort();
      window.clearTimeout(slow);
    };
  }, []);

  return status;
}
