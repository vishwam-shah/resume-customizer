"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { DownloadSimple, SignOut, Trash, WarningOctagon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { exportMyData } from "@/features/history/actions";
import { saveBlob } from "@/features/results/DownloadMenu";
import { authClient, signOut } from "@/lib/authClient";

const confirmWord = "delete";

export function AccountPanel({
  name,
  email,
  since,
}: {
  name: string;
  email: string;
  since: string;
}) {
  const id = useId();
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function download() {
    setExporting(true);
    try {
      const json = await exportMyData();
      saveBlob(new Blob([json], { type: "application/json" }), "tailor-my-data.json");
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    const { error } = await authClient.deleteUser();
    if (error) {
      setDeleting(false);
      setDeleteError(
        error.code === "SESSION_EXPIRED"
          ? "For your security, sign out and sign in again, then delete your account."
          : (error.message ?? "We couldn't delete your account. Try again."),
      );
      return;
    }
    router.push("/");
    router.refresh();
  }

  const section = "rounded-[var(--radius-card)] border border-border p-5 sm:p-6";

  return (
    <div className="mt-8 grid gap-6">
      <section aria-labelledby={`${id}-profile`} className={section}>
        <h2 id={`${id}-profile`} className="font-semibold text-lg">
          Profile
        </h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-muted text-sm">Name</dt>
            <dd className="font-medium">{name}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted text-sm">Email</dt>
            <dd className="truncate font-medium">{email}</dd>
          </div>
          <div>
            <dt className="text-muted text-sm">Member since</dt>
            <dd className="font-medium">{since}</dd>
          </div>
        </dl>
        <Button
          variant="secondary"
          className="mt-5"
          icon={<SignOut aria-hidden className="size-4" />}
          onClick={async () => {
            await signOut();
            router.push("/");
            router.refresh();
          }}
        >
          Sign out
        </Button>
      </section>

      <section aria-labelledby={`${id}-data`} className={section}>
        <h2 id={`${id}-data`} className="font-semibold text-lg">
          Your data
        </h2>
        <p className="mt-1 text-muted">
          We store your account and the runs in your history: job descriptions, resume text and
          tailored versions. Nothing else, and nothing is shared.
        </p>
        <Button
          variant="secondary"
          className="mt-5"
          busy={exporting}
          busyLabel="Preparing…"
          icon={<DownloadSimple aria-hidden className="size-4" />}
          onClick={download}
        >
          Download my data
        </Button>
      </section>

      <section aria-labelledby={`${id}-danger`} className={`${section} border-removed`}>
        <h2 id={`${id}-danger`} className="font-semibold text-lg text-removed">
          Delete account
        </h2>
        <p className="mt-1 text-muted">
          Permanently deletes your account and your entire history. This can't be undone.
        </p>
        {deleteError ? (
          <p role="alert" className="mt-3 flex items-start gap-2 text-removed text-sm">
            <WarningOctagon aria-hidden weight="fill" className="mt-0.5 size-4 shrink-0" />
            {deleteError}
          </p>
        ) : null}
        <AlertDialog.Root onOpenChange={(open) => !open && setConfirmText("")}>
          <AlertDialog.Trigger className={buttonClasses({ variant: "danger", className: "mt-5" })}>
            <Trash aria-hidden className="size-4" />
            Delete account
          </AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
            <AlertDialog.Popup
              data-surface
              className="fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-card)] border border-border bg-bg p-6 shadow-card outline-none transition-all duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
            >
              <AlertDialog.Title className="font-semibold text-lg">
                Delete your account?
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-2 text-muted">
                Your account and every saved run will be deleted immediately and permanently.
              </AlertDialog.Description>
              <label htmlFor={`${id}-confirm`} className="mt-5 block font-medium text-sm">
                Type <span className="font-mono">{confirmWord}</span> to confirm
              </label>
              <input
                id={`${id}-confirm`}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="mt-1.5 block min-h-11 w-full rounded-[var(--radius-control)] border border-border-strong bg-bg px-3.5 text-base"
              />
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <AlertDialog.Close className={buttonClasses({ variant: "ghost" })}>
                  Cancel
                </AlertDialog.Close>
                <Button
                  disabled={confirmText.trim().toLowerCase() !== confirmWord}
                  busy={deleting}
                  busyLabel="Deleting…"
                  onClick={deleteAccount}
                  className="bg-danger-solid text-on-danger"
                >
                  Delete everything
                </Button>
              </div>
            </AlertDialog.Popup>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </section>
    </div>
  );
}
