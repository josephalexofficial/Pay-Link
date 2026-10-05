import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import { getDatabaseUrl } from "@/common/config/env";

import * as schema from "./schema";

type Database = NeonHttpDatabase<typeof schema>;

const globalForDatabase = globalThis as unknown as { database?: Database };

/**
 * Returns the shared Neon client for this server instance.
 * The client is reused across warm invocations so each request does not open a new connection.
 *
 * @returns A Drizzle database bound to the payments schema.
 *
 * @throws {ConfigurationError} When DATABASE_URL is missing.
 */
export function getDatabase(): Database {
  if (globalForDatabase.database) {
    return globalForDatabase.database;
  }

  const database = drizzle(neon(getDatabaseUrl()), { schema });
  globalForDatabase.database = database;
  return database;
}
