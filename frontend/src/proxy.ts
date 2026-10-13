import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Optimistic redirect for signed-in-only pages: checks that a session cookie
 * exists, nothing more. Every page and server action still verifies the
 * session itself.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(signIn);
}

export const config = { matcher: ["/history/:path*", "/account/:path*"] };
