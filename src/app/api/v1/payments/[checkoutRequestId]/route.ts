import { createRequestId, successEnvelope, toErrorResponse } from "@/common/http/api-response";
import { NotFoundError } from "@/common/errors/app-error";
import { reconcilePayment } from "@/features/payments/payment.service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CHECKOUT_REQUEST_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;

/**
 * @route   GET /api/v1/payments/:checkoutRequestId
 * @desc    Returns the payment state. When the prompt is still pending, this may ask Daraja for the result.
 * @access  Public. The ticket is the secret returned when the prompt was created.
 *
 * @param   {string} checkoutRequestId - Daraja CheckoutRequestID.
 *
 * @returns {200} Current payment state.
 * @returns {404} This app did not create that ticket.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ checkoutRequestId: string }> },
): Promise<Response> {
  const requestId = createRequestId();

  try {
    const { checkoutRequestId } = await context.params;

    if (!CHECKOUT_REQUEST_PATTERN.test(checkoutRequestId)) {
      throw new NotFoundError("Payment not found.");
    }

    const payment = await reconcilePayment(checkoutRequestId, new Date());
    if (!payment) {
      throw new NotFoundError("Payment not found.");
    }

    return Response.json(successEnvelope(payment, requestId), {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return toErrorResponse(error, requestId);
  }
}
