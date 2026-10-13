"use client";

import { Eye, EyeSlash, WarningOctagon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { authClient, describeAuthError } from "@/lib/authClient";
import { cn } from "@/lib/format";

type Mode = "signIn" | "signUp";
type Errors = Partial<Record<"name" | "email" | "password" | "form", string>>;

const minPasswordLength = 8;

const copy: Record<
  Mode,
  {
    title: string;
    submit: string;
    busy: string;
    switchText: string;
    switchLink: string;
    switchHref: string;
  }
> = {
  signIn: {
    title: "Sign in",
    submit: "Sign in",
    busy: "Signing in…",
    switchText: "New here?",
    switchLink: "Create an account",
    switchHref: "/sign-up",
  },
  signUp: {
    title: "Create your account",
    submit: "Create account",
    busy: "Creating account…",
    switchText: "Already have an account?",
    switchLink: "Sign in",
    switchHref: "/sign-in",
  },
};

export function AuthForm({ mode, next }: { mode: Mode; next: string }) {
  const id = useId();
  const router = useRouter();
  const summaryRef = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const text = copy[mode];

  function validate(form: FormData): Errors {
    const found: Errors = {};
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (mode === "signUp" && !name) found.name = "Enter your name.";
    if (!email) found.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      found.email = "Enter a valid email address, like name@example.com.";
    if (!password) found.password = "Enter your password.";
    else if (mode === "signUp" && password.length < minPasswordLength)
      found.password = `Use at least ${minPasswordLength} characters.`;
    return found;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setBusy(true);
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));
    const { data, error } =
      mode === "signUp"
        ? await authClient.signUp.email({ name: String(form.get("name")).trim(), email, password })
        : await authClient.signIn.email({ email, password });
    const verifyUrl = `/verify-email?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`;
    if (error?.code === "EMAIL_NOT_VERIFIED") {
      // Signed up earlier but never entered the code: send a fresh one.
      await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
      router.push(`${verifyUrl}&resent=1`);
      return;
    }
    if (error) {
      setBusy(false);
      setErrors({ form: describeAuthError(error.code, error.message) });
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    if (mode === "signUp" && !(data && "token" in data && data.token)) {
      // No session yet: a code is on its way; the account is usable once it's entered.
      router.push(verifyUrl);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  const fieldErrors = (["name", "email", "password"] as const).filter((k) => errors[k]);
  const hasSummary = Boolean(errors.form) || fieldErrors.length > 0;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-14 sm:py-20">
      <h1 className="font-semibold text-3xl tracking-tight">{text.title}</h1>
      <p className="mt-2 text-muted">
        Save your tailored resumes and come back to them on any device.
      </p>

      {hasSummary ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="mt-6 rounded-[var(--radius-card)] bg-danger-solid p-4 text-on-danger outline-none"
        >
          <p className="flex items-center gap-2 font-semibold">
            <WarningOctagon aria-hidden weight="fill" className="size-5 shrink-0" />
            {errors.form ?? "Fix these to continue"}
          </p>
          {fieldErrors.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-12">
              {fieldErrors.map((field) => (
                <li key={field}>
                  <a href={`#${id}-${field}`} className="underline decoration-2 underline-offset-4">
                    {errors[field]}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={submit} noValidate className="mt-8 space-y-5">
        {mode === "signUp" ? (
          <TextField
            id={`${id}-name`}
            name="name"
            label="Name"
            autoComplete="name"
            error={errors.name}
          />
        ) : null}
        <TextField
          id={`${id}-email`}
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          inputMode="email"
          error={errors.email}
        />
        <div className="relative">
          <TextField
            id={`${id}-password`}
            name="password"
            type={showPassword ? "text" : "password"}
            label="Password"
            autoComplete={mode === "signUp" ? "new-password" : "current-password"}
            hint={mode === "signUp" ? `At least ${minPasswordLength} characters.` : undefined}
            error={errors.password}
            inputClassName="pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-pressed={showPassword}
            aria-label="Show password"
            className="absolute top-8 right-1 grid size-11 place-items-center rounded-md text-muted hover:text-fg"
          >
            {showPassword ? (
              <EyeSlash aria-hidden className="size-5" />
            ) : (
              <Eye aria-hidden className="size-5" />
            )}
          </button>
        </div>
        {mode === "signIn" ? (
          <p className="-mt-2 text-right text-sm">
            <Link
              href={`/forgot-password?next=${encodeURIComponent(next)}`}
              className="font-medium underline underline-offset-4"
            >
              Forgot password?
            </Link>
          </p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" busy={busy} busyLabel={text.busy}>
          {text.submit}
        </Button>
      </form>

      <p className="mt-6 text-center text-muted text-sm">
        {text.switchText}{" "}
        <Link
          href={`${text.switchHref}?next=${encodeURIComponent(next)}`}
          className="font-medium text-fg underline underline-offset-4"
        >
          {text.switchLink}
        </Link>
      </p>
      <p className="mt-3 text-center text-muted text-sm">
        <Link href="/" className="underline underline-offset-4 hover:text-fg">
          Continue without an account
        </Link>
      </p>
    </div>
  );
}

function TextField({
  id,
  label,
  error,
  hint,
  inputClassName,
  ...input
}: React.ComponentProps<"input"> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  inputClassName?: string;
}) {
  const describedBy = [hint && !error && `${id}-hint`, error && `${id}-error`]
    .filter(Boolean)
    .join(" ");
  return (
    <div>
      <label htmlFor={id} className="font-medium text-sm">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          "mt-1.5 block min-h-11 w-full rounded-[var(--radius-control)] border bg-bg px-3.5 text-base hover:border-fg",
          error ? "border-removed" : "border-border-strong",
          inputClassName,
        )}
        {...input}
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="mt-1.5 text-muted text-sm">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-removed text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
