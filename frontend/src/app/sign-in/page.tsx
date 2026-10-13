import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/features/auth/AuthForm";
import { safeNext } from "@/lib/safeNext";

export const metadata: Metadata = { title: "Sign in" };

async function Form({ searchParams }: PageProps<"/sign-in">) {
  const { next } = await searchParams;
  return <AuthForm mode="signIn" next={safeNext(next)} />;
}

export default function Page(props: PageProps<"/sign-in">) {
  return (
    <Suspense>
      <Form {...props} />
    </Suspense>
  );
}
