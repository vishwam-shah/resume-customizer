import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccountPanel } from "@/features/account/AccountPanel";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "Account" };

async function Account() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in?next=/account");
  const since = new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(session.user.createdAt);
  return <AccountPanel name={session.user.name} email={session.user.email} since={since} />;
}

export default function AccountPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-semibold text-3xl tracking-tight sm:text-4xl">Account</h1>
      <Suspense
        fallback={
          <div className="mt-8 h-96 animate-pulse rounded-[var(--radius-card)] bg-surface-2" />
        }
      >
        <Account />
      </Suspense>
    </div>
  );
}
