export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * @route   POST /api/v1/payment-validations
 * @desc    Accepts every Safaricom validation check so a name lookup never blocks a payment.
 * @access  Public. Called by Safaricom, not by the pay page.
 *
 * @returns {200} Validation accepted. Body is { ResultCode: 0, ResultDesc: "Accepted" }.
 */
export async function POST(): Promise<Response> {
  return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
