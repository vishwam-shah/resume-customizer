import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/features/auth/ForgotPasswordForm";
import { safeNext } from "@/lib/safeNext";

export const metadata: Metadata = { title: "Reset password" };

async function Form({ searchParams }: PageProps<"/forgot-password">) {
  const { next } = await searchParams;
  return <ForgotPasswordForm next={safeNext(next)} />;
}

export default function Page(props: PageProps<"/forgot-password">) {
  return (
    <Suspense>
      <Form {...props} />
    </Suspense>
  );
}
