"use server";

import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { savedRun } from "@/db/appSchema";
import { db } from "@/db/client";
import { auth } from "@/lib/auth";

async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not signed in");
  return session.user.id;
}

const scoreShape = z.object({
  match: z.object({ score: z.number() }).passthrough(),
  ats: z.object({ score: z.number() }).passthrough(),
});

/** Just enough structure to trust the summary columns; the rest is stored as-is. */
const workspaceShape = z
  .object({
    jobDescription: z.string().max(20_000),
    file: z.object({ fileName: z.string().max(300) }).passthrough(),
    analysis: z
      .object({ title: z.string().max(300), company: z.string().max(300).nullable() })
      .passthrough(),
    scoresBefore: scoreShape.nullable(),
    versions: z
      .array(z.object({ result: z.object({ scores: scoreShape }).passthrough() }).passthrough())
      .min(1)
      .max(3),
  })
  .passthrough();

const saveInput = z.object({ id: z.uuid(), data: workspaceShape });
const maxBytes = 3 * 1024 * 1024;

export type SaveResult = { ok: true } | { ok: false; message: string };

export async function saveRun(input: unknown): Promise<SaveResult> {
  const userId = await requireUserId();
  const parsed = saveInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "This run couldn't be saved." };
  const { id, data } = parsed.data;
  if (JSON.stringify(data).length > maxBytes) {
    return { ok: false, message: "This run is too large to save." };
  }

  const latest = data.versions.at(-1);
  const row = {
    userId,
    jobTitle: data.analysis.title,
    company: data.analysis.company,
    fileName: data.file.fileName,
    versionCount: data.versions.length,
    matchBefore: data.scoresBefore?.match.score ?? null,
    matchAfter: latest?.result.scores.match.score ?? 0,
    atsBefore: data.scoresBefore?.ats.score ?? null,
    atsAfter: latest?.result.scores.ats.score ?? 0,
    data,
  };
  await db
    .insert(savedRun)
    .values({ id, ...row })
    .onConflictDoUpdate({
      target: savedRun.id,
      set: { ...row, updatedAt: new Date() },
      // Never overwrite a row that belongs to someone else.
      setWhere: eq(savedRun.userId, userId),
    });
  return { ok: true };
}

export type RunSummary = {
  id: string;
  jobTitle: string;
  company: string | null;
  fileName: string;
  versionCount: number;
  matchBefore: number | null;
  matchAfter: number;
  atsBefore: number | null;
  atsAfter: number;
  updatedAt: string;
};

export async function listRuns(): Promise<RunSummary[]> {
  const userId = await requireUserId();
  const rows = await db
    .select({
      id: savedRun.id,
      jobTitle: savedRun.jobTitle,
      company: savedRun.company,
      fileName: savedRun.fileName,
      versionCount: savedRun.versionCount,
      matchBefore: savedRun.matchBefore,
      matchAfter: savedRun.matchAfter,
      atsBefore: savedRun.atsBefore,
      atsAfter: savedRun.atsAfter,
      updatedAt: savedRun.updatedAt,
    })
    .from(savedRun)
    .where(eq(savedRun.userId, userId))
    .orderBy(desc(savedRun.updatedAt))
    .limit(100);
  return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }));
}

export async function getRun(id: string): Promise<unknown | null> {
  const userId = await requireUserId();
  if (!z.uuid().safeParse(id).success) return null;
  const [row] = await db
    .select({ data: savedRun.data })
    .from(savedRun)
    .where(and(eq(savedRun.id, id), eq(savedRun.userId, userId)));
  return row?.data ?? null;
}

export async function deleteRun(id: string): Promise<void> {
  const userId = await requireUserId();
  await db.delete(savedRun).where(and(eq(savedRun.id, id), eq(savedRun.userId, userId)));
}

/** Everything we store about the user, for the "Download my data" button. */
export async function exportMyData(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not signed in");
  const runs = await db.select().from(savedRun).where(eq(savedRun.userId, session.user.id));
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      account: {
        name: session.user.name,
        email: session.user.email,
        createdAt: session.user.createdAt,
      },
      runs,
    },
    null,
    2,
  );
}
