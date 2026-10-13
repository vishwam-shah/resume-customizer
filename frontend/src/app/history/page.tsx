import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { listRuns } from "@/features/history/actions";
import { HistoryList } from "@/features/history/HistoryList";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "History" };

async function Runs() {
  // The proxy only checks that a cookie exists; confirm the session is real.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in?next=/history");
  const runs = await listRuns();
  return <HistoryList runs={runs} />;
}

function RunsSkeleton() {
  return (
    <div className="mt-8 grid gap-4 md:grid-cols-2" aria-busy="true">
      <p className="sr-only" role="status">
        Loading your history…
      </p>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-52 animate-pulse rounded-[var(--radius-card)] bg-surface-2" />
      ))}
    </div>
  );
}

export default function HistoryPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-semibold text-3xl tracking-tight sm:text-4xl">History</h1>
      <p className="mt-2 text-muted">Every resume you tailored while signed in, newest first.</p>
      <Suspense fallback={<RunsSkeleton />}>
        <Runs />
      </Suspense>
    </div>
  );
}
