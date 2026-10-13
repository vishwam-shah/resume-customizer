import "server-only";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "@/db/client";

/**
 * Email + password accounts. BETTER_AUTH_SECRET and BETTER_AUTH_URL come from
 * the environment; extra deploy origins from BETTER_AUTH_TRUSTED_ORIGINS.
 */
export const auth = betterAuth({
  appName: "Tailor",
  // neon-http has no interactive transactions; the adapter default (off) is required.
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    // Also makes a duplicate sign-up return a clear error instead of a silent no-op.
    autoSignIn: true,
  },
  user: { deleteUser: { enabled: true } },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: { enabled: true, window: 60, max: 60 },
  plugins: [nextCookies()], // must stay last
});

export type Session = typeof auth.$Infer.Session;
