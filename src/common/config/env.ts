import { z } from "zod";

import { ConfigurationError } from "@/common/errors/app-error";
import { logger } from "@/common/logging/logger";

const MIN_AUTH_SECRET_LENGTH = 32;

const mpesaConfigSchema = z.object({
  consumerKey: z.string().min(1),
  consumerSecret: z.string().min(1),
  passkey: z.string().min(1),
  shortCode: z.string().regex(/^\d{5,10}$/),
  tillNumber: z.string().regex(/^\d{5,10}$/),
  callbackUrl: z
    .string()
    .url()
    .refine((value) => value.startsWith("https://"), {
      message: "Callback URL must use https",
    }),
});

export type MpesaConfig = z.infer<typeof mpesaConfigSchema>;

/**
 * Reads Daraja production credentials from the environment.
 *
 * @returns The organization shortcode, Buy Goods till, passkey, consumer pair, and public callback URL.
 *
 * @throws {ConfigurationError} When any required M-Pesa variable is missing or the callback is not https.
 */
export function getMpesaConfig(): MpesaConfig {
  const parsed = mpesaConfigSchema.safeParse({
    consumerKey: process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET,
    passkey: process.env.MPESA_PASSKEY,
    shortCode: process.env.MPESA_SHORTCODE ?? "4329875",
    tillNumber: process.env.MPESA_TILL_NUMBER ?? "4277642",
    callbackUrl: process.env.MPESA_CALLBACK_URL,
  });

  if (!parsed.success) {
    logger.error("M-Pesa environment is incomplete", {
      fields: parsed.error.issues.map((issue) => issue.path.join(".")),
    });
    throw new ConfigurationError("Payments are not available right now.");
  }

  return parsed.data;
}

/**
 * Reads the Neon connection string.
 *
 * @returns The DATABASE_URL value.
 *
 * @throws {ConfigurationError} When DATABASE_URL is missing.
 */
export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new ConfigurationError("Payments are not available right now.");
  }

  return databaseUrl;
}

/**
 * Reads the admin session signing secret.
 *
 * @returns A secret of at least 32 characters.
 *
 * @throws {ConfigurationError} When AUTH_SECRET is missing or too short.
 */
export function getAuthSecret(): string {
  const authSecret = readAuthSecret();
  if (!authSecret) {
    throw new ConfigurationError("Admin sign-in is not configured.");
  }

  return authSecret;
}

/**
 * Reads the admin session secret without throwing, for pages that can render a setup hint.
 *
 * @returns The secret, or null when sign-in cannot be configured yet.
 */
export function readAuthSecret(): string | null {
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret || authSecret.length < MIN_AUTH_SECRET_LENGTH) {
    return null;
  }

  return authSecret;
}
