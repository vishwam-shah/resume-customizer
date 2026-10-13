"use client";

import { Key, WarningOctagon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { authClient, describeAuthError } from "@/lib/authClient";
import { cn } from "@/lib/format";
import { CodeField } from "./CodeField";
import { useCooldown } from "./useCooldown";

const minPasswordLength = 8;

export function ForgotPasswordForm({ next }: { next: string }) {
  const id = useId();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown();
  const alertRef = useRef<HTMLDivElement>(null);

  function fail(message: string) {
    setError(message);
    setBusy(false);
    requestAnimationFrame(() => alertRef.current?.focus());
  }

  async function requestCode(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      fail("Enter the email address you signed up with.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: apiError } = await authClient.emailOtp.requestPasswordReset({ email: trimmed });
    setBusy(false);
    if (apiError) {
      fail(describeAuthError(apiError.code, apiError.message));
      return;
    }
    // Same response whether or not the account exists, so nobody can probe emails.
    cooldown.start(60);
    setStep("reset");
  }

  async function reset(event: FormEvent) {
    event.preventDefault();
    if (code.length !== 6) return fail("Enter all 6 digits from the email.");
    if (password.length < minPasswordLength)
      return fail(`Use at least ${minPasswordLength} characters for your new password.`);
    setBusy(true);
    setError(null);
    const { error: apiError } = await authClient.emailOtp.resetPassword({
      email: email.trim(),
      otp: code,
      password,
    });
    if (apiError) return fail(describeAuthError(apiError.code, apiError.message));
    const { error: signInError } = await authClient.signIn.email({ email: email.trim(), password });
    if (signInError) {
      router.push(`/sign-in?next=${encodeURIComponent(next)}`);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  const input =
    "mt-1.5 block min-h-11 w-full rounded-[var(--radius-control)] border border-border-strong bg-bg px-3.5 text-base hover:border-fg";

  return (
    <div className="mx-auto w-full max-w-md px-4 py-14 sm:py-20">
      <Key aria-hidden weight="duotone" className="size-12 text-muted" />
      <h1 className="mt-4 font-semibold text-3xl tracking-tight">Reset your password</h1>
      <p className="mt-2 text-muted">
        {step === "email"
          ? "We'll email you a 6-digit code to choose a new password."
          : `If an account exists for ${email.trim()}, a code is on its way. It expires in 10 minutes.`}
      </p>

      {error ? (
        <div
          ref={alertRef}
          tabIndex={-1}
          role="alert"
          className="mt-6 flex items-start gap-2 rounded-[var(--radius-card)] bg-danger-solid p-4 text-on-danger outline-none"
        >
          <WarningOctagon aria-hidden weight="fill" className="mt-0.5 size-5 shrink-0" />
          {error}
        </div>
      ) : null}

      {step === "email" ? (
        <form onSubmit={requestCode} noValidate className="mt-8 space-y-5">
          <div>
            <label htmlFor={`${id}-email`} className="font-medium text-sm">
              Email
            </label>
            <input
              id={`${id}-email`}
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={input}
            />
          </div>
          <Button type="submit" size="lg" className="w-full" busy={busy} busyLabel="Sending…">
            Send code
          </Button>
        </form>
      ) : (
        <form onSubmit={reset} noValidate className="mt-8 space-y-5">
          <CodeField id={`${id}-code`} value={code} onChange={setCode} />
          <div>
            <label htmlFor={`${id}-password`} className="font-medium text-sm">
              New password
            </label>
            <input
              id={`${id}-password`}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={`${id}-password-hint`}
              className={cn(input)}
            />
            <p id={`${id}-password-hint`} className="mt-1.5 text-muted text-sm">
              At least {minPasswordLength} characters.
            </p>
          </div>
          <Button type="submit" size="lg" className="w-full" busy={busy} busyLabel="Saving…">
            Set new password
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={cooldown.seconds > 0}
            onClick={() => void requestCode()}
          >
            {cooldown.seconds > 0 ? `Resend code in ${cooldown.seconds}s` : "Resend code"}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-muted text-sm">
        <Link
          href={`/sign-in?next=${encodeURIComponent(next)}`}
          className="underline underline-offset-4 hover:text-fg"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
