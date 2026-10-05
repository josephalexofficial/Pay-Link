import { cookies } from "next/headers";

import { getAuthSecret, readAuthSecret } from "@/common/config/env";

import { createSessionToken, readSessionToken, SESSION_COOKIE_NAME, SESSION_TTL_IN_SECONDS } from "./session-token";

export type AdminSession = {
  userId: string;
  email: string;
};

/**
 * Reads the signed admin cookie.
 *
 * @returns The signed-in admin, or null when the cookie is missing or invalid.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const secret = readAuthSecret();
  if (!secret) {
    return null;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  return readSessionToken(token, secret);
}

/**
 * Stores a new admin session cookie.
 *
 * @param user - Admin row that just authenticated.
 *
 * @throws {ConfigurationError} When AUTH_SECRET is missing.
 */
export async function setAdminSessionCookie(user: { id: string; email: string }): Promise<void> {
  const token = await createSessionToken(user, new Date(), getAuthSecret());
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_IN_SECONDS,
  });
}

/**
 * Removes the admin session cookie.
 */
export async function clearAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
