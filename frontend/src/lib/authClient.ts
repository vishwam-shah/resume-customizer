import { createAuthClient } from "better-auth/react";

/** Same-origin client: the auth API lives at /api/auth on this app. */
export const authClient = createAuthClient();

export const { useSession, signOut } = authClient;
