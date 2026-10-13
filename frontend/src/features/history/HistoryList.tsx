"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Toast } from "@base-ui/react/toast";
import { ArrowRight, ClockCounterClockwise, Plus, Trash } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { pluralize } from "@/lib/format";
import { storageKey } from "../workspace/WorkspaceProvider";
import type { Version } from "../workspace/workspaceState";
import { deleteRun, getRun, type RunSummary } from "./actions";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function HistoryList({ runs: initialRuns }: { runs: RunSummary[] }) {
  const [runs, setRuns] = useState(initialRuns);

  if (runs.length === 0) {
    return (
      <div className="mt-10 rounded-[var(--radius-card)] border border-border border-dashed px-6 py-16 text-center">
        <ClockCounterClockwise
          aria-hidden
          weight="duotone"
          className="mx-auto size-12 text-muted"
        />
        <h2 className="mt-4 font-semibold text-lg">Nothing saved yet</h2>
        <p className="mx-auto mt-1 max-w-sm text-muted">
          Each resume you tailor while signed in is saved here automatically, with all its versions.
        </p>
        <Link href="/" className={buttonClasses({ className: "mt-6" })}>
          <Plus aria-hidden className="size-4" />
          Tailor a resume
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-8 grid gap-4 md:grid-cols-2">
      {runs.map((run) => (
        <RunCard
          key={run.id}
          run={run}
          onDeleted={() => setRuns((all) => all.filter((r) => r.id !== run.id))}
        />
      ))}
    </ul>
  );
}

function RunCard({ run, onDeleted }: { run: RunSummary; onDeleted: () => void }) {
  const router = useRouter();
  const toasts = Toast.useToastManager();
  const [opening, startOpening] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const headingId = `run-${run.id}`;
  const delta = run.matchBefore === null ? null : run.matchAfter - run.matchBefore;

  function open() {
    startOpening(async () => {
      const data = (await getRun(run.id)) as { versions: Version[] } | null;
      if (!data) {
        toasts.add({ title: "That run no longer exists", type: "error" });
        return;
      }
      const latest = data.versions.at(-1);
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          ...data,
          sessionId: run.id,
          activeVersionId: latest?.id ?? null,
          options: latest?.options,
          view: "results",
        }),
      );
      router.push("/");
    });
  }

  function remove() {
    startDeleting(async () => {
      await deleteRun(run.id);
      onDeleted();
      toasts.add({ title: "Deleted from history", description: run.jobTitle, type: "success" });
    });
  }

  return (
    <li
      aria-labelledby={headingId}
      className="flex flex-col rounded-[var(--radius-card)] border border-border bg-bg p-5"
      data-surface
    >
      <h2 id={headingId} className="font-semibold text-lg leading-snug">
        {run.jobTitle}
        {run.company ? <span className="font-normal text-muted"> at {run.company}</span> : null}
      </h2>
      <p className="mt-1 text-muted text-sm">
        {run.fileName} · {pluralize(run.versionCount, "version")} ·{" "}
        <time dateTime={run.updatedAt}>{dateFormat.format(new Date(run.updatedAt))}</time>
      </p>

      <dl className="mt-4 flex gap-6">
        <div>
          <dt className="text-muted text-xs">Job match</dt>
          <dd className="tabular font-semibold text-2xl">
            {run.matchAfter}%
            {delta ? (
              <span className="ml-2 align-middle font-medium text-added text-sm">
                {delta > 0 ? `+${delta}` : delta}
                <span className="sr-only"> from {run.matchBefore}%</span>
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-muted text-xs">ATS readiness</dt>
          <dd className="tabular font-semibold text-2xl">{run.atsAfter}</dd>
        </div>
      </dl>

      <div className="mt-5 flex gap-2 pt-1">
        <Button
          onClick={open}
          busy={opening}
          busyLabel="Opening…"
          icon={<ArrowRight aria-hidden className="size-4" />}
          aria-describedby={headingId}
        >
          Open
        </Button>
        <AlertDialog.Root>
          <AlertDialog.Trigger
            disabled={deleting}
            className={buttonClasses({ variant: "ghost" })}
            aria-describedby={headingId}
          >
            <Trash aria-hidden className="size-4" />
            Delete
          </AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
            <AlertDialog.Popup
              data-surface
              className="fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-card)] border border-border bg-bg p-6 shadow-card outline-none transition-all duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
            >
              <AlertDialog.Title className="font-semibold text-lg">
                Delete this run?
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-2 text-muted">
                “{run.jobTitle}” and its {pluralize(run.versionCount, "version")} will be removed
                from your history. This can't be undone.
              </AlertDialog.Description>
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <AlertDialog.Close className={buttonClasses({ variant: "ghost" })}>
                  Keep it
                </AlertDialog.Close>
                <AlertDialog.Close
                  onClick={remove}
                  className={buttonClasses({ className: "bg-danger-solid text-on-danger" })}
                >
                  Delete run
                </AlertDialog.Close>
              </div>
            </AlertDialog.Popup>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </div>
    </li>
  );
}
