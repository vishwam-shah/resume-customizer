import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit doesn't read Next's .env.local on its own.
config({ path: ".env.local" });

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/db/authSchema.ts", "./src/db/appSchema.ts"],
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
