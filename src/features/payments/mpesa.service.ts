import { z } from "zod";

import type { MpesaConfig } from "@/common/config/env";
import { getMpesaConfig } from "@/common/config/env";
import { ExternalServiceError } from "@/common/errors/app-error";
import { logger } from "@/common/logging/logger";
import { formatNairobiTimestamp } from "@/common/utils/nairobi-time";

import {
  ACCOUNT_REFERENCE,
  DARAJA_OAUTH_URL,
  DARAJA_STK_PUSH_URL,
  DARAJA_STK_QUERY_URL,
  DARAJA_TIMEOUT_IN_MS,
  TRANSACTION_DESCRIPTION,
} from "./payment.constants";

const TOKEN_REFRESH_BUFFER_IN_MS = 60_000;

const accessTokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.union([z.string(), z.number()]),
});

const stkAcceptedSchema = z.object({
  MerchantRequestID: z.string().min(1),
  CheckoutRequestID: z.string().min(1),
  ResponseCode: z.string(),
  ResponseDescription: z.string(),
  CustomerMessage: z.string().optional(),
});

const darajaFaultSchema = z.object({
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  ResponseCode: z.string().optional(),
  ResponseDescription: z.string().optional(),
  CustomerMessage: z.string().optional(),
  ResultCode: z.union([z.string(), z.number()]).optional(),
  ResultDesc: z.string().optional(),
});

export type StkQueryOutcome =
  | { outcome: "pending" }
  | { outcome: "final"; resultCode: string; resultDescription: string };

type CachedAccessToken = {
  accessToken: string;
  expiresAtMs: number;
};

let cachedAccessToken: CachedAccessToken | null = null;

export type StkPushAcceptance = {
  merchantRequestId: string;
  checkoutRequestId: string;
};

/**
 * Asks Daraja to show an M-Pesa PIN prompt on the customer's phone.
 *
 * @param input - Normalized phone, whole shillings, and the request instant used for the password timestamp.
 * @returns The merchant and checkout tickets for the accepted prompt.
 *
 * @throws {ExternalServiceError} When Daraja rejects the prompt or cannot be reached.
 * @throws {ConfigurationError} When M-Pesa credentials are missing.
 */
export async function sendStkPush(input: {
  phoneNumber: string;
  amountInKes: number;
  now: Date;
}): Promise<StkPushAcceptance> {
  const config = getMpesaConfig();
  const timestamp = formatNairobiTimestamp(input.now);
  const accessToken = await fetchAccessToken(config, input.now);

  const response = await darajaFetch(DARAJA_STK_PUSH_URL, accessToken, {
    BusinessShortCode: config.shortCode,
    Password: buildDarajaPassword(config.shortCode, config.passkey, timestamp),
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: input.amountInKes,
    PartyA: input.phoneNumber,
    PartyB: config.shortCode,
    PhoneNumber: input.phoneNumber,
    CallBackURL: config.callbackUrl,
    AccountReference: ACCOUNT_REFERENCE,
    TransactionDesc: TRANSACTION_DESCRIPTION,
  });

  const body = await readResponseBody(response);
  const accepted = stkAcceptedSchema.safeParse(body);

  if (!response.ok || !accepted.success || accepted.data.ResponseCode !== "0") {
    logger.error("Daraja rejected the STK prompt", {
      httpStatus: response.status,
      body,
    });
    throw new ExternalServiceError(publicDarajaMessage(body, "M-Pesa could not send the prompt. Try again."));
  }

  return {
    merchantRequestId: accepted.data.MerchantRequestID,
    checkoutRequestId: accepted.data.CheckoutRequestID,
  };
}

/**
 * Asks Daraja how an existing STK prompt ended.
 * This does not send another prompt and does not move money.
 *
 * @param checkoutRequestId - Ticket returned when the prompt was accepted.
 * @param now - Instant used for a fresh Daraja password timestamp.
 * @returns Pending when Safaricom is still waiting on the phone, or a final result code.
 *
 * @throws {ExternalServiceError} When the query itself fails. The payment should stay pending.
 * @throws {ConfigurationError} When M-Pesa credentials are missing.
 */
export async function queryStkPush(checkoutRequestId: string, now: Date): Promise<StkQueryOutcome> {
  const config = getMpesaConfig();
  const timestamp = formatNairobiTimestamp(now);
  const accessToken = await fetchAccessToken(config, now);

  const response = await darajaFetch(DARAJA_STK_QUERY_URL, accessToken, {
    BusinessShortCode: config.shortCode,
    Password: buildDarajaPassword(config.shortCode, config.passkey, timestamp),
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestId,
  });

  const body = await readResponseBody(response);
  const parsed = darajaFaultSchema.safeParse(body);
  const fault = parsed.success ? parsed.data : {};
  const description = fault.errorMessage ?? fault.ResultDesc ?? fault.ResponseDescription ?? "";

  if (isStillProcessing(description)) {
    return { outcome: "pending" };
  }

  if (!response.ok) {
    logger.error("Daraja STK query failed", { httpStatus: response.status, checkoutRequestId, body });
    throw new ExternalServiceError("M-Pesa could not confirm this payment yet.");
  }

  if (fault.ResultCode === undefined) {
    return { outcome: "pending" };
  }

  return {
    outcome: "final",
    resultCode: String(fault.ResultCode),
    resultDescription: fault.ResultDesc || "M-Pesa completed the check.",
  };
}

async function fetchAccessToken(config: MpesaConfig, now: Date): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAtMs > now.getTime()) {
    return cachedAccessToken.accessToken;
  }

  let response: Response;
  try {
    response = await fetch(DARAJA_OAUTH_URL, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64")}`,
      },
      signal: AbortSignal.timeout(DARAJA_TIMEOUT_IN_MS),
      cache: "no-store",
    });
  } catch (error) {
    logger.error("Daraja token request failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new ExternalServiceError("M-Pesa could not be reached. Try again.");
  }

  const body = await readResponseBody(response);
  const parsed = accessTokenSchema.safeParse(body);

  if (!response.ok || !parsed.success) {
    logger.error("Daraja token response was rejected", { httpStatus: response.status });
    throw new ExternalServiceError("M-Pesa could not be reached. Try again.");
  }

  const expiresInSeconds = Number(parsed.data.expires_in);
  const lifetimeInMs = Number.isFinite(expiresInSeconds) ? expiresInSeconds * 1000 : 0;

  cachedAccessToken = {
    accessToken: parsed.data.access_token,
    expiresAtMs: now.getTime() + Math.max(0, lifetimeInMs - TOKEN_REFRESH_BUFFER_IN_MS),
  };

  return parsed.data.access_token;
}

async function darajaFetch(url: string, accessToken: string, payload: Record<string, string | number>): Promise<Response> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(DARAJA_TIMEOUT_IN_MS),
      cache: "no-store",
    });
  } catch (error) {
    logger.error("Daraja request failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new ExternalServiceError("M-Pesa could not be reached. Try again.");
  }
}

function buildDarajaPassword(shortCode: string, passkey: string, timestamp: string): string {
  return Buffer.from(`${shortCode}${passkey}${timestamp}`).toString("base64");
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function isStillProcessing(description: string): boolean {
  return /being processed|still under processing/i.test(description);
}

function publicDarajaMessage(body: unknown, fallback: string): string {
  const parsed = darajaFaultSchema.safeParse(body);
  if (!parsed.success) {
    return fallback;
  }

  const message = parsed.data.CustomerMessage ?? parsed.data.errorMessage ?? parsed.data.ResponseDescription;
  if (!message || /token|credential|passkey|secret/i.test(message)) {
    return fallback;
  }

  return message;
}
