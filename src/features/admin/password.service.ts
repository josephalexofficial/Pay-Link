import { scrypt as scryptCallback, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const PASSWORD_KEY_LENGTH = 64;

/**
 * Hashes an admin password with scrypt and a random salt.
 *
 * @param password - Plain password from the seed command or a future password change.
 * @returns A salt and hash joined as `salt:hash`.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

/**
 * Checks a password against a stored scrypt hash.
 *
 * @param password - Password typed on the sign-in form.
 * @param storedHash - Value saved in admin_users.password_hash.
 * @returns True only when the password matches.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const separatorIndex = storedHash.indexOf(":");
  if (separatorIndex <= 0) {
    return false;
  }

  const salt = storedHash.slice(0, separatorIndex);
  const hash = storedHash.slice(separatorIndex + 1);
  if (!salt || !hash) {
    return false;
  }

  const derived = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;
  const stored = Buffer.from(hash, "hex");

  if (derived.length !== stored.length) {
    return false;
  }

  return timingSafeEqual(derived, stored);
}
