"use server";

import { redirect } from "next/navigation";

import { clearAdminSessionCookie } from "./admin-session";

/**
 * Ends the admin session and returns to the sign-in page.
 */
export async function logoutAction(): Promise<void> {
  await clearAdminSessionCookie();
  redirect("/admin/login");
}
