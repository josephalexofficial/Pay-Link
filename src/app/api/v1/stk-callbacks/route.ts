import { after } from "next/server";

import { logger } from "@/common/logging/logger";
import { parseStkCallback } from "@/features/payments/payment.schema";
import { reconcilePayment, recordStkCallback } from "@/features/payments/payment.service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * @route   POST /api/v1/stk-callbacks
 * @desc    Receives the STK result Safaricom posts after the customer acts on the prompt.
 *          The response uses Daraja's acknowledgement shape so Safaricom stops retrying.
 *          Payment status is confirmed afterwards with an STK query.
 * @access  Public. Called by Safaricom, not by the pay page.
 *
 * @returns {200} Callback stored or ignored. Body is { ResultCode: 0, ResultDesc: "Accepted" }.
 * @returns {500} The callback could not be stored, so Safaricom should retry.
 */
export async function POST(request: Request): Promise<Response> {
  let payload: unknown;

  try {
    payload = (await request.json()) as unknown;
  } catch (error) {
    logger.warn("STK callback body was not JSON", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json({ ResultCode: 1, ResultDesc: "Rejected" }, { status: 400 });
  }

  try {
    const callback = parseStkCallback(payload);
    await recordStkCallback(callback);
    const checkoutRequestId = callback.Body.stkCallback.CheckoutRequestID;

    after(async () => {
      await reconcilePayment(checkoutRequestId, new Date(), true);
    });

    return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    logger.error("STK callback was not stored", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json({ ResultCode: 1, ResultDesc: "Rejected" }, { status: 500 });
  }
}
