import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { VerifyEmailForm } from "@/features/auth/VerifyEmailForm";
import { safeNext } from "@/lib/safeNext";

export const metadata: Metadata = { title: "Verify your email" };

async function Form({ searchParams }: PageProps<"/verify-email">) {
  const { email, next } = await searchParams;
  const address = Array.isArray(email) ? email[0] : email;
  if (!address) redirect("/sign-up");
  return <VerifyEmailForm email={address} next={safeNext(next)} />;
}

export default function Page(props: PageProps<"/verify-email">) {
  return (
    <Suspense>
      <Form {...props} />
    </Suspense>
  );
}
