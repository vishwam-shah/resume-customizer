import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/features/auth/AuthForm";
import { safeNext } from "@/lib/safeNext";

export const metadata: Metadata = { title: "Create account" };

async function Form({ searchParams }: PageProps<"/sign-up">) {
  const { next } = await searchParams;
  return <AuthForm mode="signUp" next={safeNext(next)} />;
}

export default function Page(props: PageProps<"/sign-up">) {
  return (
    <Suspense>
      <Form {...props} />
    </Suspense>
  );
}
