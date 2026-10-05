import { logger } from "@/common/logging/logger";
import { parsePayerConfirmation } from "@/features/payments/payment.schema";
import { recordPayerName } from "@/features/payments/payment.service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * @route   POST /api/v1/payment-confirmations
 * @desc    Receives the payer name Safaricom posts after a completed payment.
 *          The pay page does not collect this name.
 * @access  Public. Called by Safaricom, not by the pay page.
 *
 * @returns {200} Confirmation accepted. Body is { ResultCode: 0, ResultDesc: "Accepted" }.
 * @returns {500} The name could not be saved, so Safaricom should retry.
 */
export async function POST(request: Request): Promise<Response> {
  let payload: unknown;

  try {
    payload = (await request.json()) as unknown;
  } catch (error) {
    logger.warn("Payment confirmation body was not JSON", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  const confirmation = parsePayerConfirmation(payload);
  if (!confirmation) {
    return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  try {
    await recordPayerName(confirmation);
    return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    logger.error("Payer name was not saved", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json({ ResultCode: 1, ResultDesc: "Rejected" }, { status: 500 });
  }
}
