"use client";

import { WifiSlash } from "@phosphor-icons/react";
import { useOffline } from "next/offline";

/** Visible everywhere while the connection is down; announced once politely. */
export function OfflineBanner() {
  const offline = useOffline();
  return (
    <div role="status" aria-live="polite">
      {offline ? (
        <p className="flex items-center justify-center gap-2 bg-warn-bg px-4 py-2 text-center text-sm text-warn">
          <WifiSlash aria-hidden weight="bold" className="size-4 shrink-0" />
          You're offline. Your work is saved here; tailoring resumes when you reconnect.
        </p>
      ) : null}
    </div>
  );
}
