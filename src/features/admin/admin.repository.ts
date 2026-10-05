import { eq } from "drizzle-orm";

import { getDatabase } from "@/db/client";
import { adminUsers, type AdminUserRecord } from "@/db/schema";

/**
 * Loads an admin by email address.
 *
 * @param email - Normalized lowercase email.
 * @returns The admin row, or null when no account uses that email.
 */
export async function findAdminByEmail(email: string): Promise<AdminUserRecord | null> {
  const database = getDatabase();
  const rows = await database.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
  return rows[0] ?? null;
}

/**
 * Creates or replaces the password for one admin email.
 *
 * @param input - Email, display name, and scrypt password hash.
 * @returns The saved admin id and email.
 */
export async function saveAdminUser(input: {
  email: string;
  name: string;
  passwordHash: string;
}): Promise<{ id: string; email: string }> {
  const database = getDatabase();
  const existing = await findAdminByEmail(input.email);

  if (existing) {
    await database
      .update(adminUsers)
      .set({ passwordHash: input.passwordHash, name: input.name })
      .where(eq(adminUsers.id, existing.id));

    return { id: existing.id, email: existing.email };
  }

  const inserted = await database
    .insert(adminUsers)
    .values({
      email: input.email,
      name: input.name,
      passwordHash: input.passwordHash,
    })
    .returning({ id: adminUsers.id, email: adminUsers.email });

  const created = inserted[0];
  if (!created) {
    throw new Error("Admin insert did not return a row.");
  }

  return created;
}
