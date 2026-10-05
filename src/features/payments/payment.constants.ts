export const MINIMUM_AMOUNT_IN_KES = 1;
export const MAXIMUM_AMOUNT_IN_KES = 150_000;

/** Account reference is limited to 12 characters on Daraja. */
export const ACCOUNT_REFERENCE = "WHIMSEY";

/** TransactionDesc is limited to 13 characters on Daraja. */
export const TRANSACTION_DESCRIPTION = "Whimsey Pay";

export const PROMPT_COOLDOWN_IN_MS = 90_000;
export const PROMPT_WINDOW_IN_MS = 10 * 60_000;
export const MAX_PROMPTS_PER_WINDOW = 5;
export const QUERY_INTERVAL_IN_MS = 15_000;
export const CLIENT_POLL_INTERVAL_IN_MS = 3_000;
export const CLIENT_WAIT_LIMIT_IN_MS = 90_000;
export const DARAJA_TIMEOUT_IN_MS = 15_000;

export const PAYMENT_STATUSES = ["pending", "paid", "cancelled", "timed_out", "failed"] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const DARAJA_OAUTH_URL = "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
export const DARAJA_STK_PUSH_URL = "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest";
export const DARAJA_STK_QUERY_URL = "https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query";
