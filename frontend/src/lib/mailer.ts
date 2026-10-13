import "server-only";
import nodemailer from "nodemailer";

/**
 * Transactional mail through Gmail SMTP with an app password: free, about 500
 * messages a day, and delivered by Google's own servers, so it passes Gmail's
 * sender checks without owning a domain. Set GMAIL_USER and GMAIL_APP_PASSWORD.
 */
const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");

/** Verification is only enforced when codes can actually be delivered. */
export const mailEnabled = Boolean(user && pass);

const transport =
  user && pass ? nodemailer.createTransport({ service: "gmail", auth: { user, pass } }) : null;

export type CodePurpose = "email-verification" | "forget-password" | "sign-in" | "change-email";

const copy: Record<CodePurpose, { subject: string; intro: string }> = {
  "email-verification": {
    subject: "Your Tailor verification code",
    intro: "Enter this code to verify your email and finish creating your account.",
  },
  "forget-password": {
    subject: "Your Tailor password reset code",
    intro: "Enter this code to choose a new password.",
  },
  "sign-in": { subject: "Your Tailor sign-in code", intro: "Enter this code to sign in." },
  "change-email": {
    subject: "Confirm your new email for Tailor",
    intro: "Enter this code to confirm your new email address.",
  },
};

export async function sendCode(to: string, code: string, purpose: CodePurpose): Promise<void> {
  const { subject, intro } = copy[purpose];
  const footer =
    "The code expires in 10 minutes. If you didn't ask for it, you can ignore this email.";
  if (!transport || !user) {
    // Local development without credentials: surface the code in the server log.
    console.warn(`[mailer] GMAIL_USER/GMAIL_APP_PASSWORD not set. ${subject} for ${to}: ${code}`);
    return;
  }
  await transport.sendMail({
    from: { name: "Tailor", address: user },
    to,
    subject,
    text: `${intro}\n\n${code}\n\n${footer}`,
    html: `<!doctype html><html lang="en"><body style="margin:0;padding:32px 16px;background:#fafafa;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#09090b">
<div style="max-width:440px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;border-radius:16px;padding:32px">
<p style="margin:0 0 4px;font-weight:600;font-size:18px">Tailor</p>
<p style="margin:0 0 24px;color:#52525b;line-height:1.5">${intro}</p>
<p style="margin:0 0 24px;font:600 32px/1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:8px">${code}</p>
<p style="margin:0;color:#52525b;font-size:13px;line-height:1.5">${footer}</p>
</div></body></html>`,
  });
}
