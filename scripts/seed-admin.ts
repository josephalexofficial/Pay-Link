import { hashPassword } from "../src/features/admin/password.service";
import { saveAdminUser } from "../src/features/admin/admin.repository";

const MINIMUM_PASSWORD_LENGTH = 12;

async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const password = process.env.ADMIN_PASSWORD ?? "";
  const name = process.env.ADMIN_NAME?.trim() || "Whimsey Admin";

  if (!process.env.DATABASE_URL) {
    throw new Error("Set DATABASE_URL before seeding the admin user.");
  }

  if (!email || !email.includes("@")) {
    throw new Error("Set ADMIN_EMAIL to the admin sign-in address.");
  }

  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    throw new Error("Set ADMIN_PASSWORD to at least 12 characters.");
  }

  const passwordHash = await hashPassword(password);
  const admin = await saveAdminUser({ email, name, passwordHash });
  console.info(`Admin ready for ${admin.email}`);
}

seedAdmin().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Admin seed failed.";
  console.error(message);
  process.exitCode = 1;
});
