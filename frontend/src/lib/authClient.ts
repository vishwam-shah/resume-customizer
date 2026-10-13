import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Same-origin client: the auth API lives at /api/auth on this app. */
export const authClient = createAuthClient({ plugins: [emailOTPClient()] });

export const { useSession, signOut } = authClient;

/** Better Auth error codes, in words a person can act on. */
export function describeAuthError(code: string | undefined, fallback?: string): string {
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That email and password don't match. Check both and try again.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "An account with this email already exists. Sign in instead.";
    case "PASSWORD_TOO_SHORT":
      return "Use at least 8 characters for your password.";
    case "INVALID_EMAIL":
      return "Enter a valid email address, like name@example.com.";
    case "INVALID_OTP":
      return "That code isn't right. Check the latest email and try again.";
    case "OTP_EXPIRED":
      return "That code has expired. Send a new one.";
    case "TOO_MANY_ATTEMPTS":
      return "Too many wrong codes. Send a new one.";
    case "TOO_MANY_REQUESTS":
      return "Too many attempts. Wait a minute and try again.";
    default:
      return fallback || "Something went wrong. Try again.";
  }
}
