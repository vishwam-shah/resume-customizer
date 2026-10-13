"use client";

import { EnvelopeSimple } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { authClient, describeAuthError } from "@/lib/authClient";
import { CodeField } from "./CodeField";
import { useCooldown } from "./useCooldown";

export function VerifyEmailForm({ email, next }: { email: string; next: string }) {
  const id = useId();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown(60); // a code was just sent

  useEffect(() => inputRef.current?.focus(), []);

  async function verify(otp: string) {
    if (otp.length !== 6) {
      setError("Enter all 6 digits from the email.");
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    const { error: apiError } = await authClient.emailOtp.verifyEmail({ email, otp });
    if (apiError) {
      setBusy(false);
      setError(describeAuthError(apiError.code, apiError.message));
      setCode("");
      inputRef.current?.focus();
      return;
    }
    setStatus("Email verified. Signing you in…");
    router.replace(next);
    router.refresh();
  }

  async function resend() {
    setError(null);
    const { error: apiError } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });
    if (apiError) {
      setError(describeAuthError(apiError.code, apiError.message));
      return;
    }
    cooldown.start(60);
    setCode("");
    setStatus(`New code sent to ${email}.`);
    inputRef.current?.focus();
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-14 sm:py-20">
      <EnvelopeSimple aria-hidden weight="duotone" className="size-12 text-muted" />
      <h1 className="mt-4 font-semibold text-3xl tracking-tight">Check your email</h1>
      <p id={`${id}-hint`} className="mt-2 text-muted">
        We sent a 6-digit code to <span className="font-medium text-fg">{email}</span>. It expires
        in 10 minutes. Can't find it? Check spam.
      </p>
      <p role="status" className="sr-only">
        {status}
      </p>

      <form
        className="mt-8 space-y-5"
        noValidate
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void verify(code);
        }}
      >
        <CodeField
          ref={inputRef}
          id={`${id}-code`}
          value={code}
          onChange={setCode}
          onComplete={(value) => void verify(value)}
          error={error}
          describedBy={`${id}-hint`}
        />
        <Button type="submit" size="lg" className="w-full" busy={busy} busyLabel="Verifying…">
          Verify email
        </Button>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
        <Button variant="ghost" size="sm" disabled={cooldown.seconds > 0} onClick={resend}>
          {cooldown.seconds > 0 ? `Resend code in ${cooldown.seconds}s` : "Resend code"}
        </Button>
        <Link href="/sign-up" className="text-muted underline underline-offset-4 hover:text-fg">
          Use a different email
        </Link>
      </div>
    </div>
  );
}
