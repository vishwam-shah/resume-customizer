import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as appSchema from "./appSchema";
import * as authSchema from "./authSchema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");

export const schema = { ...authSchema, ...appSchema };

/** HTTP driver: one round trip per query, no connection pool to manage on serverless. */
export const db = drizzle({ client: neon(databaseUrl), schema });
