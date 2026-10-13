"use client";

import { CheckCircle, CloudSlash, Laptop } from "@phosphor-icons/react";
import Link from "next/link";
import { Spinner } from "@/components/ui/Button";
import type { SaveStatus } from "../workspace/WorkspaceProvider";

export function SaveIndicator({ status }: { status: SaveStatus }) {
  return (
    <p role="status" className="flex items-center gap-1.5 text-muted text-sm">
      {status === "local" ? (
        <>
          <Laptop aria-hidden className="size-4" />
          Kept in this browser.{" "}
          <Link href="/sign-in?next=/" className="font-medium text-fg underline underline-offset-4">
            Sign in to save it to your history
          </Link>
        </>
      ) : status === "saving" ? (
        <>
          <Spinner className="size-3.5" />
          Saving…
        </>
      ) : status === "saved" ? (
        <>
          <CheckCircle aria-hidden weight="fill" className="size-4 text-added" />
          Saved to{" "}
          <Link href="/history" className="font-medium text-fg underline underline-offset-4">
            your history
          </Link>
        </>
      ) : (
        <>
          <CloudSlash aria-hidden className="size-4 text-removed" />
          Couldn't save. It will retry on your next change.
        </>
      )}
    </p>
  );
}
