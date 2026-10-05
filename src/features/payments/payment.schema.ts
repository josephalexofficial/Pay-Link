import { z } from "zod";

import { ValidationError } from "@/common/errors/app-error";
import { normalizeKenyanPhone } from "@/common/utils/phone";

import { MAXIMUM_AMOUNT_IN_KES, MINIMUM_AMOUNT_IN_KES, PAYMENT_STATUSES } from "./payment.constants";

export const createPaymentSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .min(1, "Enter a Safaricom number, for example 0712 345 678.")
    .transform((value, context) => {
      const normalized = normalizeKenyanPhone(value);
      if (!normalized) {
        context.addIssue({
          code: "custom",
          message: "Enter a Safaricom number, for example 0712 345 678.",
        });
        return z.NEVER;
      }
      return normalized;
    }),
  amountInKes: z
    .number({ error: "Enter an amount in Kenyan shillings." })
    .int("Enter a whole number of shillings.")
    .min(MINIMUM_AMOUNT_IN_KES, `Enter an amount from KES ${MINIMUM_AMOUNT_IN_KES}.`)
    .max(MAXIMUM_AMOUNT_IN_KES, `Enter an amount up to KES ${MAXIMUM_AMOUNT_IN_KES.toLocaleString("en-KE")}.`),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);

const callbackItemSchema = z.object({
  Name: z.string(),
  Value: z.union([z.string(), z.number()]).optional(),
});

export const stkCallbackSchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      MerchantRequestID: z.string().min(1),
      CheckoutRequestID: z.string().min(1),
      ResultCode: z.number(),
      ResultDesc: z.string(),
      CallbackMetadata: z
        .object({
          Item: z.array(callbackItemSchema),
        })
        .optional(),
    }),
  }),
});

export type StkCallbackPayload = z.infer<typeof stkCallbackSchema>;

/**
 * Parses an unknown JSON body into a payment request.
 *
 * @param payload - Raw request JSON.
 * @returns The normalized phone number and whole-shilling amount.
 *
 * @throws {ValidationError} When the phone or amount is not acceptable.
 */
export function parseCreatePayment(payload: unknown): CreatePaymentInput {
  const parsed = createPaymentSchema.safeParse(payload);
  if (!parsed.success) {
    throw validationErrorFromZod(parsed.error);
  }

  return parsed.data;
}

/**
 * Parses a Safaricom STK callback body.
 *
 * @param payload - Raw JSON posted by Daraja.
 * @returns The typed callback.
 *
 * @throws {ValidationError} When the body is not an STK callback.
 */
export function parseStkCallback(payload: unknown): StkCallbackPayload {
  const parsed = stkCallbackSchema.safeParse(payload);
  if (!parsed.success) {
    throw validationErrorFromZod(parsed.error);
  }

  return parsed.data;
}

export function validationErrorFromZod(error: z.ZodError): ValidationError {
  return new ValidationError("Check the phone number and amount.", {
    details: error.issues.map((issue) => ({
      field: issue.path.join(".") || "request",
      issue: issue.message,
    })),
  });
}

const LIST_PAGE_SIZE = 20;

/**
 * Reads admin list filters from the dashboard URL.
 *
 * @param params - Query string values for search, status, and page.
 * @returns A bounded list query. Unknown statuses are treated as all statuses.
 */
export function parsePaymentListParams(params: { q?: string; status?: string; page?: string }): {
  searchText: string;
  status: z.infer<typeof paymentStatusSchema> | null;
  page: number;
  pageSize: number;
} {
  const status = paymentStatusSchema.safeParse(params.status);
  const pageNumber = Number(params.page);

  return {
    searchText: (params.q ?? "").trim().slice(0, 40),
    status: status.success ? status.data : null,
    page: Number.isInteger(pageNumber) && pageNumber >= 1 ? pageNumber : 1,
    pageSize: LIST_PAGE_SIZE,
  };
}
