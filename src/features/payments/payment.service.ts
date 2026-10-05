import { ConflictError, ExternalServiceError, RateLimitError } from "@/common/errors/app-error";
import { logger } from "@/common/logging/logger";
import type { PaymentRecord } from "@/db/schema";

import {
  ACCOUNT_REFERENCE,
  MAX_PROMPTS_PER_WINDOW,
  PROMPT_COOLDOWN_IN_MS,
  PROMPT_WINDOW_IN_MS,
  QUERY_INTERVAL_IN_MS,
  TRANSACTION_DESCRIPTION,
  type PaymentStatus,
} from "./payment.constants";
import { queryStkPush, sendStkPush } from "./mpesa.service";
import {
  countPaymentsForPhoneSince,
  findPaymentByCheckoutRequestId,
  findPendingPaymentForPhone,
  findPendingPaymentsWithCallbacks,
  insertPayment,
  updatePaymentByCheckoutRequestId,
} from "./payment.repository";
import { paymentStatusSchema, stkCallbackSchema, type StkCallbackPayload } from "./payment.schema";

type CallbackDecision = {
  status: PaymentStatus;
  resultCode: string;
  resultDescription: string;
  receipt: string | null;
};

export type PaymentView = {
  checkoutRequestId: string;
  phoneNumber: string;
  customerName: string | null;
  amountInKes: number;
  status: PaymentStatus;
  resultDescription: string | null;
  mpesaReceiptNumber: string | null;
  createdAt: string;
};

/**
 * Sends an STK prompt, or returns the prompt already waiting on that phone.
 *
 * @param input - Payer name, normalized Safaricom number, and whole-shilling amount.
 * @param now - Instant used for rate limits and the Daraja timestamp.
 * @returns The pending payment the page should watch.
 *
 * @throws {RateLimitError} When the number has received too many prompts in the current window.
 * @throws {ConflictError} When a different amount is already waiting on that phone.
 * @throws {ExternalServiceError} When Daraja rejects the prompt or the row cannot be saved.
 * @throws {ConfigurationError} When credentials or the database are not configured.
 */
export async function requestPayment(
  input: { customerName: string; phoneNumber: string; amountInKes: number },
  now: Date,
): Promise<PaymentView> {
  const windowStart = new Date(now.getTime() - PROMPT_WINDOW_IN_MS);
  const recentCount = await countPaymentsForPhoneSince(input.phoneNumber, windowStart);

  if (recentCount >= MAX_PROMPTS_PER_WINDOW) {
    throw new RateLimitError("This number has had several prompts. Wait a few minutes and try again.");
  }

  const cooldownStart = new Date(now.getTime() - PROMPT_COOLDOWN_IN_MS);
  const openPrompt = await findPendingPaymentForPhone(input.phoneNumber, cooldownStart);

  if (openPrompt) {
    if (openPrompt.amountInKes === input.amountInKes) {
      return toPaymentView(openPrompt);
    }

    throw new ConflictError("A prompt is already open on this phone. Complete it or dismiss it, then try again.");
  }

  const accepted = await sendStkPush({
    phoneNumber: input.phoneNumber,
    amountInKes: input.amountInKes,
    now,
  });

  try {
    const saved = await insertPayment({
      merchantRequestId: accepted.merchantRequestId,
      checkoutRequestId: accepted.checkoutRequestId,
      phoneNumber: input.phoneNumber,
      customerName: input.customerName,
      amountInKes: input.amountInKes,
      accountReference: ACCOUNT_REFERENCE,
      transactionDescription: TRANSACTION_DESCRIPTION,
    });

    return toPaymentView(saved);
  } catch (error) {
    logger.error("STK prompt was accepted but the payment row was not saved", {
      checkoutRequestId: accepted.checkoutRequestId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new ExternalServiceError("The prompt was sent. Check your phone before trying again.");
  }
}

/**
 * Stores Safaricom's callback and, when the prompt is still waiting, uses that result.
 * The callback is the payment result. The M-Pesa receipt is only present here.
 *
 * @param payload - Validated STK callback body.
 * @param now - Instant recorded as the paid time when the callback says the payment succeeded.
 * @returns Nothing. Unknown tickets are ignored so retries still receive an acknowledgement.
 */
export async function recordStkCallback(payload: StkCallbackPayload, now: Date): Promise<void> {
  const callback = payload.Body.stkCallback;
  const existing = await findPaymentByCheckoutRequestId(callback.CheckoutRequestID);

  if (!existing) {
    logger.warn("Ignored STK callback for an unknown ticket", {
      checkoutRequestId: callback.CheckoutRequestID,
    });
    return;
  }

  const decision = decisionFromCallback(payload);
  const shouldSettle = existing.status === "pending";
  const shouldStoreReceipt = existing.status === "paid" && !existing.mpesaReceiptNumber && decision.receipt !== null;

  await updatePaymentByCheckoutRequestId(callback.CheckoutRequestID, {
    rawCallback: payload,
    ...(shouldSettle
      ? {
          status: decision.status,
          resultCode: decision.resultCode,
          resultDescription: decision.resultDescription,
          mpesaReceiptNumber: decision.receipt,
          paidAt: decision.status === "paid" ? now : null,
        }
      : {}),
    ...(shouldStoreReceipt ? { mpesaReceiptNumber: decision.receipt } : {}),
  });
}

/**
 * Marks pending payments paid, cancelled, timed out, or failed from callbacks already saved.
 * Used when a callback arrived before this confirmation behavior was deployed.
 *
 * @param now - Instant recorded as the paid time for callbacks that succeeded.
 * @returns Nothing.
 */
export async function settlePendingCallbacks(now: Date): Promise<void> {
  const pending = await findPendingPaymentsWithCallbacks();

  for (const payment of pending) {
    await applyStoredCallback(payment, now);
  }
}

/**
 * Returns the current payment and, when it is still pending, asks Daraja what happened.
 *
 * @param checkoutRequestId - Ticket the pay page is watching.
 * @param now - Instant used to decide whether another query is due.
 * @param forceQuery - When true, query immediately. Used after a callback arrives.
 * @returns The payment view, or null when this app did not create the ticket.
 *
 * @throws {ConfigurationError} When the database is not configured.
 */
export async function reconcilePayment(
  checkoutRequestId: string,
  now: Date,
  forceQuery = false,
): Promise<PaymentView | null> {
  const existing = await findPaymentByCheckoutRequestId(checkoutRequestId);
  if (!existing) {
    return null;
  }

  if (existing.status !== "pending") {
    return toPaymentView(existing);
  }

  const settled = await applyStoredCallback(existing, now);
  if (settled) {
    return toPaymentView(settled);
  }

  if (!shouldQuery(existing, now, forceQuery)) {
    return toPaymentView(existing);
  }

  await updatePaymentByCheckoutRequestId(checkoutRequestId, { lastQueriedAt: now });

  try {
    const outcome = await queryStkPush(checkoutRequestId, now);
    if (outcome.outcome === "pending") {
      return toPaymentView({ ...existing, lastQueriedAt: now });
    }

    const status = statusFromResultCode(outcome.resultCode);
    const updated = await updatePaymentByCheckoutRequestId(checkoutRequestId, {
      status,
      resultCode: outcome.resultCode,
      resultDescription: outcome.resultDescription,
      mpesaReceiptNumber: status === "paid" ? readReceiptFromCallback(existing.rawCallback) : null,
      paidAt: status === "paid" ? now : null,
      lastQueriedAt: now,
    });

    return toPaymentView(updated ?? existing);
  } catch (error) {
    logger.error("STK query did not complete", {
      checkoutRequestId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return toPaymentView(existing);
  }
}

/**
 * Maps a Daraja result code onto the status stored for a payment.
 *
 * @param resultCode - ResultCode string from an STK query.
 * @returns The payment status. 0 is paid, 1032 is cancelled, 1037 is timed out.
 */
export function statusFromResultCode(resultCode: string): PaymentStatus {
  if (resultCode === "0") {
    return "paid";
  }

  if (resultCode === "1032") {
    return "cancelled";
  }

  if (resultCode === "1037") {
    return "timed_out";
  }

  return "failed";
}

function shouldQuery(payment: PaymentRecord, now: Date, forceQuery: boolean): boolean {
  const sinceLastQueryInMs = payment.lastQueriedAt ? now.getTime() - payment.lastQueriedAt.getTime() : Number.POSITIVE_INFINITY;

  if (forceQuery) {
    return sinceLastQueryInMs >= QUERY_INTERVAL_IN_MS;
  }

  const ageInMs = now.getTime() - payment.createdAt.getTime();
  return ageInMs >= QUERY_INTERVAL_IN_MS && sinceLastQueryInMs >= QUERY_INTERVAL_IN_MS;
}

async function applyStoredCallback(payment: PaymentRecord, now: Date): Promise<PaymentRecord | null> {
  const decision = decisionFromStoredCallback(payment.rawCallback);
  if (!decision) {
    return null;
  }

  return updatePaymentByCheckoutRequestId(payment.checkoutRequestId, {
    status: decision.status,
    resultCode: decision.resultCode,
    resultDescription: decision.resultDescription,
    mpesaReceiptNumber: decision.receipt,
    paidAt: decision.status === "paid" ? now : null,
  });
}

function decisionFromStoredCallback(raw: unknown): CallbackDecision | null {
  const parsed = stkCallbackSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }

  return decisionFromCallback(parsed.data);
}

function decisionFromCallback(payload: StkCallbackPayload): CallbackDecision {
  const callback = payload.Body.stkCallback;
  const status = statusFromResultCode(String(callback.ResultCode));

  return {
    status,
    resultCode: String(callback.ResultCode),
    resultDescription: callback.ResultDesc,
    receipt: status === "paid" ? readReceiptFromMetadata(callback.CallbackMetadata) : null,
  };
}

function readReceiptFromMetadata(metadata: StkCallbackPayload["Body"]["stkCallback"]["CallbackMetadata"]): string | null {
  for (const item of metadata?.Item ?? []) {
    if (item.Name !== "MpesaReceiptNumber") {
      continue;
    }

    if (typeof item.Value === "string" && item.Value.trim().length > 0) {
      return item.Value.trim();
    }

    if (typeof item.Value === "number") {
      return String(item.Value);
    }
  }

  return null;
}

function readReceiptFromCallback(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const body = "Body" in raw ? raw.Body : undefined;
  if (!body || typeof body !== "object" || !("stkCallback" in body)) {
    return null;
  }

  const callback = body.stkCallback;
  if (!callback || typeof callback !== "object" || !("CallbackMetadata" in callback)) {
    return null;
  }

  const metadata = callback.CallbackMetadata;
  if (!metadata || typeof metadata !== "object" || !("Item" in metadata) || !Array.isArray(metadata.Item)) {
    return null;
  }

  for (const item of metadata.Item) {
    if (!item || typeof item !== "object" || !("Name" in item) || !("Value" in item)) {
      continue;
    }

    if (item.Name === "MpesaReceiptNumber" && typeof item.Value === "string" && item.Value.trim().length > 0) {
      return item.Value.trim();
    }
  }

  return null;
}

function toPaymentView(payment: PaymentRecord): PaymentView {
  const parsedStatus = paymentStatusSchema.safeParse(payment.status);

  return {
    checkoutRequestId: payment.checkoutRequestId,
    phoneNumber: payment.phoneNumber,
    customerName: payment.customerName,
    amountInKes: payment.amountInKes,
    status: parsedStatus.success ? parsedStatus.data : "failed",
    resultDescription: payment.resultDescription,
    mpesaReceiptNumber: payment.mpesaReceiptNumber,
    createdAt: payment.createdAt.toISOString(),
  };
}
