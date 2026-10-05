"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { logger } from "@/common/logging/logger";

import { findAdminByEmail } from "./admin.repository";
import { setAdminSessionCookie } from "./admin-session";
import { verifyPassword } from "./password.service";

export type LoginState = {
  error: string | null;
};

const DUMMY_PASSWORD_HASH = `${"aa".repeat(16)}:${"bb".repeat(64)}`;

const loginSchema = z.object({
  email: z.string().trim().email("Enter the admin email."),
  password: z.string().min(1, "Enter the admin password."),
});

/**
 * Checks the admin email and password, then opens a session.
 *
 * @param _previous - Previous form state. Unused because each attempt replaces it.
 * @param formData - Email and password fields from the sign-in form.
 * @returns An error message, or redirects to the dashboard on success.
 */
export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter the admin email and password." };
  }

  try {
    const admin = await findAdminByEmail(parsed.data.email.toLowerCase());
    const passwordMatches = await verifyPassword(
      parsed.data.password,
      admin?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!admin || !passwordMatches) {
      return { error: "Email or password is incorrect." };
    }

    await setAdminSessionCookie({ id: admin.id, email: admin.email });
  } catch (error) {
    logger.error("Admin sign-in failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return { error: "Sign-in is unavailable right now." };
  }

  redirect("/admin");
}
