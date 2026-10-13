import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./authSchema";

/**
 * One tailoring session (a job + a resume) and all of its versions.
 * Saved only for signed-in users; deleted with the account (cascade).
 */
export const savedRun = pgTable(
  "saved_run",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jobTitle: text("job_title").notNull(),
    company: text("company"),
    fileName: text("file_name").notNull(),
    versionCount: integer("version_count").notNull(),
    matchBefore: integer("match_before"),
    matchAfter: integer("match_after").notNull(),
    atsBefore: integer("ats_before"),
    atsAfter: integer("ats_after").notNull(),
    /** The serialized workspace (inputs, analysis, versions). */
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("saved_run_user_updated_idx").on(table.userId, table.updatedAt)],
);

export type SavedRun = typeof savedRun.$inferSelect;
