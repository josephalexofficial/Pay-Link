import { createRequestId, successEnvelope, toErrorResponse } from "@/common/http/api-response";
import { logger } from "@/common/logging/logger";
import { parseCreatePayment } from "@/features/payments/payment.schema";
import { requestPayment } from "@/features/payments/payment.service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * @route   POST /api/v1/payments
 * @desc    Sends an M-Pesa STK prompt for a Safaricom number and amount.
 * @access  Public.
 *
 * @param   {string} body.phoneNumber - Safaricom number, for example 0712345678.
 * @param   {number} body.amountInKes - Whole shillings from 1 to 150000.
 *
 * @returns {200} Prompt accepted, or an identical prompt is already waiting on that phone.
 * @returns {400} Phone number or amount failed validation.
 * @returns {409} A different amount is already waiting on that phone.
 * @returns {429} Too many prompts were sent to that number.
 * @returns {502} Daraja could not send the prompt.
 */
export async function POST(request: Request): Promise<Response> {
  const requestId = createRequestId();

  try {
    const payload = await readJson(request);
    const input = parseCreatePayment(payload);
    const payment = await requestPayment(input, new Date());

    return Response.json(successEnvelope(payment, requestId), {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return toErrorResponse(error, requestId);
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch (error) {
    logger.warn("Payment request body was not JSON", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}
