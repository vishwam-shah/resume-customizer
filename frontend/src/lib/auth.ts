import "server-only";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { after } from "next/server";
import { db, schema } from "@/db/client";
import { mailEnabled, sendCode } from "@/lib/mailer";

/**
 * Email + password accounts, verified with a 6-digit code (no links: codes
 * work the same in a browser tab, on a phone, and in the installed app).
 * BETTER_AUTH_SECRET and BETTER_AUTH_URL come from the environment; extra
 * deploy origins from BETTER_AUTH_TRUSTED_ORIGINS.
 */
export const auth = betterAuth({
  appName: "Tailor",
  // neon-http has no interactive transactions; the adapter default (off) is required.
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    // Without mail credentials no code could arrive, so don't lock people out.
    requireEmailVerification: mailEnabled,
  },
  emailVerification: {
    sendOnSignUp: mailEnabled,
    autoSignInAfterVerification: true,
  },
  user: { deleteUser: { enabled: true } },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: { enabled: true, window: 60, max: 60 },
  plugins: [
    emailOTP({
      overrideDefaultEmailVerification: true,
      sendVerificationOnSignUp: mailEnabled,
      otpLength: 6,
      expiresIn: 10 * 60,
      allowedAttempts: 5,
      storeOTP: "hashed",
      async sendVerificationOTP({ email, otp, type }) {
        // Respond immediately (no timing signal about whether the account
        // exists) and finish sending after the response on serverless.
        after(() =>
          sendCode(email, otp, type).catch((error) => console.error("[auth] send code", error)),
        );
      },
    }),
    nextCookies(), // must stay last
  ],
});

export type Session = typeof auth.$Infer.Session;
