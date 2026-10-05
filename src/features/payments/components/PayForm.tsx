"use client";

import { useEffect, useState, type FormEvent } from "react";

import { formatAmountInKes } from "@/common/utils/money";
import { formatKenyanPhoneForDisplay } from "@/common/utils/phone";
import { CLIENT_POLL_INTERVAL_IN_MS, CLIENT_WAIT_LIMIT_IN_MS, type PaymentStatus } from "@/features/payments/payment.constants";

type PaymentView = {
  checkoutRequestId: string;
  phoneNumber: string;
  amountInKes: number;
  status: PaymentStatus;
  resultDescription: string | null;
  mpesaReceiptNumber: string | null;
  createdAt: string;
};

type FieldErrors = {
  phoneNumber?: string;
  amountInKes?: string;
};

const FIELD_CLASS_NAME =
  "h-14 w-full rounded-xl border border-line bg-white px-4 text-base text-foreground outline-none transition duration-300 placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/10";

export function PayForm() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [amountText, setAmountText] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payment, setPayment] = useState<PaymentView | null>(null);
  const [isPastWait, setIsPastWait] = useState(false);

  useEffect(() => {
    if (!payment || payment.status !== "pending") {
      return;
    }

    let isActive = true;
    const deadline = new Date(payment.createdAt).getTime() + CLIENT_WAIT_LIMIT_IN_MS;

    const poll = async () => {
      const next = await fetchPayment(payment.checkoutRequestId);
      if (!isActive || !next) {
        return;
      }

      setPayment(next);
      if (next.status === "pending" && Date.now() >= deadline) {
        setIsPastWait(true);
      } else if (next.status !== "pending") {
        setIsPastWait(false);
      }
    };

    const intervalId = window.setInterval(() => {
      void poll();
    }, CLIENT_POLL_INTERVAL_IN_MS);

    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void poll();
      }
    };

    document.addEventListener("visibilitychange", checkWhenVisible);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, [payment]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const amountInKes = Number(amountText);
    if (!phoneNumber.trim() || !Number.isFinite(amountInKes) || amountInKes <= 0) {
      setFieldErrors({
        phoneNumber: phoneNumber.trim() ? undefined : "Enter a Safaricom number, for example 0712 345 678.",
        amountInKes: Number.isFinite(amountInKes) && amountInKes > 0 ? undefined : "Enter an amount from KES 1.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const created = await createPayment(phoneNumber, amountInKes);
      setPayment(created);
      setIsPastWait(false);
    } catch (error) {
      if (error instanceof PaymentRequestError) {
        setFieldErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError("Could not reach Whimsey. Check your connection and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetForm() {
    setPayment(null);
    setIsPastWait(false);
    setFormError(null);
    setFieldErrors({});
  }

  async function checkAgain() {
    if (!payment) {
      return;
    }

    const next = await fetchPayment(payment.checkoutRequestId);
    if (!next) {
      setFormError("Could not check the payment. Try again.");
      return;
    }

    setPayment(next);
    setIsPastWait(next.status === "pending");
  }

  return (
    <section className="rise-in rounded-2xl border border-line border-t-4 border-t-brand bg-card px-6 py-7 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
      {payment ? (
        <PaymentProgress
          payment={payment}
          isPastWait={isPastWait}
          onCheckAgain={() => {
            void checkAgain();
          }}
          onStartOver={resetForm}
        />
      ) : (
        <form onSubmit={(event) => void handleSubmit(event)} noValidate>
          <h1 className="text-[1.7rem] font-semibold tracking-tight">Pay with M-Pesa</h1>
          <p className="mt-2 text-sm leading-6 text-muted">Enter the Safaricom number that should receive the prompt.</p>

          <label className="mt-7 block text-sm font-medium" htmlFor="phone-number">
            M-Pesa number
          </label>
          <input
            id="phone-number"
            name="phoneNumber"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0712 345 678"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            className={`mt-2 ${FIELD_CLASS_NAME}`}
          />
          {fieldErrors.phoneNumber ? <p className="mt-2 text-sm text-danger">{fieldErrors.phoneNumber}</p> : null}

          <label className="mt-5 block text-sm font-medium" htmlFor="amount">
            Amount
          </label>
          <div className="mt-2 flex h-14 overflow-hidden rounded-xl border border-line bg-white focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
            <span className="flex items-center pl-4 text-sm font-medium text-muted">KES</span>
            <input
              id="amount"
              name="amountInKes"
              inputMode="numeric"
              autoComplete="off"
              placeholder=""
              value={amountText}
              onChange={(event) => setAmountText(event.target.value.replace(/\D/g, ""))}
              className="h-full w-full bg-transparent px-3 text-2xl font-medium outline-none placeholder:text-muted/50"
            />
          </div>
          {fieldErrors.amountInKes ? <p className="mt-2 text-sm text-danger">{fieldErrors.amountInKes}</p> : null}

          {formError && !fieldErrors.phoneNumber && !fieldErrors.amountInKes ? (
            <p className="mt-4 text-sm leading-6 text-danger">{formError}</p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 h-14 w-full rounded-xl bg-brand text-base font-medium text-white transition duration-300 hover:bg-brand-hover disabled:cursor-wait disabled:opacity-70"
          >
            {isSubmitting ? "Sending prompt…" : "Pay with M-Pesa"}
          </button>
          <p className="mt-4 text-center text-sm leading-6 text-muted">You will enter your M-Pesa PIN on your phone.</p>
        </form>
      )}
    </section>
  );
}

function PaymentProgress({
  payment,
  isPastWait,
  onCheckAgain,
  onStartOver,
}: {
  payment: PaymentView;
  isPastWait: boolean;
  onCheckAgain: () => void;
  onStartOver: () => void;
}) {
  const phoneLabel = formatKenyanPhoneForDisplay(payment.phoneNumber);
  const amountLabel = formatAmountInKes(payment.amountInKes);

  if (payment.status === "pending" && !isPastWait) {
    return (
      <div aria-live="polite" className="py-4 text-center">
        <span className="mx-auto inline-block h-11 w-11 animate-spin rounded-full border-2 border-brand/20 border-t-brand" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Check your phone</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          A prompt for {amountLabel} was sent to {phoneLabel}. Enter your M-Pesa PIN.
        </p>
      </div>
    );
  }

  if (payment.status === "pending") {
    return (
      <div aria-live="polite" className="py-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Still waiting</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          The prompt for {amountLabel} may still be open on {phoneLabel}.
        </p>
        <button
          type="button"
          onClick={onCheckAgain}
          className="mt-6 h-12 w-full rounded-xl bg-brand text-sm font-medium text-white transition duration-300 hover:bg-brand-hover"
        >
          Check again
        </button>
        <button type="button" onClick={onStartOver} className="mt-3 text-sm font-medium text-brand">
          Start over
        </button>
      </div>
    );
  }

  if (payment.status === "paid") {
    return (
      <div aria-live="polite" className="py-2 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white">
          <CheckIcon />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Paid</h1>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-brand">{amountLabel}</p>
        <p className="mt-4 text-sm leading-6 text-muted">
          {payment.mpesaReceiptNumber ? `Receipt ${payment.mpesaReceiptNumber}` : "The M-Pesa receipt will appear in a moment."}
        </p>
        <p className="mt-2 text-sm text-muted">You can close this page.</p>
        <button type="button" onClick={onStartOver} className="mt-6 text-sm font-medium text-brand">
          Make another payment
        </button>
      </div>
    );
  }

  return (
    <div aria-live="polite" className="py-2 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{titleForStatus(payment.status)}</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        {payment.resultDescription || "The payment was not completed."}
      </p>
      <button
        type="button"
        onClick={onStartOver}
        className="mt-6 h-12 w-full rounded-xl bg-brand text-sm font-medium text-white transition duration-300 hover:bg-brand-hover"
      >
        Try again
      </button>
    </div>
  );
}

function titleForStatus(status: PaymentStatus): string {
  if (status === "cancelled") {
    return "Cancelled";
  }

  if (status === "timed_out") {
    return "No response";
  }

  return "Not completed";
}

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M5 11.5 9 15.5 17 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

class PaymentRequestError extends Error {
  readonly fieldErrors: FieldErrors;

  constructor(message: string, fieldErrors: FieldErrors = {}) {
    super(message);
    this.fieldErrors = fieldErrors;
  }
}

async function createPayment(phoneNumber: string, amountInKes: number): Promise<PaymentView> {
  let response: Response;

  try {
    response = await fetch("/api/v1/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, amountInKes }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new PaymentRequestError("Could not reach Whimsey. Check your connection and try again.");
  }

  const body = await readJsonBody(response);
  const payment = readPaymentView(body);

  if (!response.ok || !payment) {
    throw new PaymentRequestError(readErrorMessage(body), readFieldErrors(body));
  }

  return payment;
}

async function fetchPayment(checkoutRequestId: string): Promise<PaymentView | null> {
  try {
    const response = await fetch(`/api/v1/payments/${encodeURIComponent(checkoutRequestId)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const body = await readJsonBody(response);
    return readPaymentView(body);
  } catch {
    return null;
  }
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function readPaymentView(body: unknown): PaymentView | null {
  if (!body || typeof body !== "object" || !("data" in body)) {
    return null;
  }

  const data = body.data;
  if (!data || typeof data !== "object") {
    return null;
  }

  if (!("checkoutRequestId" in data) || typeof data.checkoutRequestId !== "string") {
    return null;
  }

  if (!("phoneNumber" in data) || typeof data.phoneNumber !== "string") {
    return null;
  }

  if (!("amountInKes" in data) || typeof data.amountInKes !== "number") {
    return null;
  }

  if (!("status" in data) || typeof data.status !== "string") {
    return null;
  }

  if (!isPaymentStatus(data.status)) {
    return null;
  }

  return {
    checkoutRequestId: data.checkoutRequestId,
    phoneNumber: data.phoneNumber,
    amountInKes: data.amountInKes,
    status: data.status,
    resultDescription: "resultDescription" in data && typeof data.resultDescription === "string" ? data.resultDescription : null,
    mpesaReceiptNumber:
      "mpesaReceiptNumber" in data && typeof data.mpesaReceiptNumber === "string" ? data.mpesaReceiptNumber : null,
    createdAt: "createdAt" in data && typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
  };
}

function isPaymentStatus(value: string): value is PaymentStatus {
  return value === "pending" || value === "paid" || value === "cancelled" || value === "timed_out" || value === "failed";
}

function readErrorMessage(body: unknown): string {
  if (!body || typeof body !== "object" || !("error" in body) || !body.error || typeof body.error !== "object") {
    return "The payment could not be started.";
  }

  return "message" in body.error && typeof body.error.message === "string"
    ? body.error.message
    : "The payment could not be started.";
}

function readFieldErrors(body: unknown): FieldErrors {
  if (!body || typeof body !== "object" || !("error" in body) || !body.error || typeof body.error !== "object") {
    return {};
  }

  if (!("details" in body.error) || !Array.isArray(body.error.details)) {
    return {};
  }

  const fieldErrors: FieldErrors = {};

  for (const detail of body.error.details) {
    if (!detail || typeof detail !== "object" || !("field" in detail) || !("issue" in detail)) {
      continue;
    }

    if (detail.field === "phoneNumber" && typeof detail.issue === "string") {
      fieldErrors.phoneNumber = detail.issue;
    }

    if (detail.field === "amountInKes" && typeof detail.issue === "string") {
      fieldErrors.amountInKes = detail.issue;
    }
  }

  return fieldErrors;
}
