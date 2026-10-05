import Link from "next/link";

import { ConfigurationError } from "@/common/errors/app-error";
import { logger } from "@/common/logging/logger";
import { formatAmountInKes } from "@/common/utils/money";
import { formatKenyanPhoneForDisplay } from "@/common/utils/phone";
import { formatNairobiDateTime, getNairobiDayStart, getNairobiMonthStart } from "@/common/utils/nairobi-time";
import { listPayments, summarizePayments, type PaymentSummary } from "@/features/payments/payment.repository";
import { settlePendingCallbacks } from "@/features/payments/payment.service";
import { PAYMENT_STATUSES, type PaymentStatus } from "@/features/payments/payment.constants";
import { parsePaymentListParams } from "@/features/payments/payment.schema";
import type { PaymentRecord } from "@/db/schema";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Waiting",
  paid: "Paid",
  cancelled: "Cancelled",
  timed_out: "Timed out",
  failed: "Failed",
};

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const listQuery = parsePaymentListParams(params);
  const now = new Date();
  let summary: PaymentSummary | null = null;
  let payments: PaymentRecord[] = [];
  let totalRecords = 0;
  let loadError: "configuration" | "unavailable" | null = null;

  try {
    await settlePendingCallbacks(now);
    const [summaryResult, list] = await Promise.all([
      summarizePayments(getNairobiDayStart(now), getNairobiMonthStart(now)),
      listPayments(listQuery),
    ]);
    summary = summaryResult;
    payments = list.rows;
    totalRecords = list.totalRecords;
  } catch (error) {
    if (error instanceof ConfigurationError) {
      loadError = "configuration";
    } else {
      logger.error("Admin payments could not be loaded", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      loadError = "unavailable";
    }
  }

  if (loadError === "configuration") {
    return (
      <section className="rounded-2xl border border-line bg-card px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Connect the database</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
          Add DATABASE_URL, run npm run db:migrate, then npm run db:seed. Payments will show up here after the first prompt.
        </p>
      </section>
    );
  }

  if (loadError === "unavailable" || !summary) {
    return (
      <section className="rounded-2xl border border-line bg-card px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Payments are unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-muted">The list could not be loaded. Refresh the page in a moment.</p>
      </section>
    );
  }

  const totalPages = Math.max(1, Math.ceil(totalRecords / listQuery.pageSize));

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
      <p className="mt-1 text-sm text-muted">Every M-Pesa prompt sent from the pay page.</p>
      <SummaryCards summary={summary} />
      <FilterForm searchText={listQuery.searchText} status={listQuery.status} />
      <PaymentList payments={payments} />
      <Pagination page={listQuery.page} totalPages={totalPages} searchText={listQuery.searchText} status={listQuery.status} />
    </div>
  );
}

function SummaryCards({ summary }: { summary: PaymentSummary }) {
  const cards = [
    { label: "Collected today", value: formatAmountInKes(summary.collectedTodayInKes) },
    { label: "Collected this month", value: formatAmountInKes(summary.collectedThisMonthInKes) },
    { label: "Prompts today", value: String(summary.attemptsToday) },
    { label: "Still waiting", value: String(summary.pendingCount) },
  ];

  return (
    <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((card) => (
        <article key={card.label} className="rounded-2xl border border-line bg-card px-4 py-4">
          <p className="text-xs text-muted">{card.label}</p>
          <p className="mt-2 text-lg font-semibold tracking-tight">{card.value}</p>
        </article>
      ))}
    </section>
  );
}

function FilterForm({ searchText, status }: { searchText: string; status: PaymentStatus | null }) {
  return (
    <form className="mt-6 flex flex-col gap-3 sm:flex-row" method="get">
      <input
        name="q"
        defaultValue={searchText}
        placeholder="Phone or receipt"
        className="h-12 flex-1 rounded-xl border border-line bg-card px-4 text-sm outline-none transition duration-300 focus:border-brand focus:ring-4 focus:ring-brand/10"
      />
      <select
        name="status"
        defaultValue={status ?? ""}
        className="h-12 rounded-xl border border-line bg-card px-3 text-sm outline-none focus:border-brand"
      >
        <option value="">All statuses</option>
        {PAYMENT_STATUSES.map((paymentStatus) => (
          <option key={paymentStatus} value={paymentStatus}>
            {STATUS_LABELS[paymentStatus]}
          </option>
        ))}
      </select>
      <button type="submit" className="h-12 rounded-xl bg-brand px-5 text-sm font-medium text-white transition duration-300 hover:bg-brand-hover">
        Filter
      </button>
    </form>
  );
}

function PaymentList({ payments }: { payments: PaymentRecord[] }) {
  if (payments.length === 0) {
    return (
      <p className="mt-8 rounded-2xl border border-dashed border-line bg-card px-6 py-10 text-center text-sm text-muted">
        No payments yet. They will show up here after the first prompt.
      </p>
    );
  }

  return (
    <>
      <div className="mt-6 hidden overflow-hidden rounded-2xl border border-line bg-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Receipt</th>
              <th className="px-4 py-3 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-b border-line last:border-b-0">
                <td className="px-4 py-3 whitespace-nowrap">{formatNairobiDateTime(payment.createdAt)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatKenyanPhoneForDisplay(payment.phoneNumber)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatAmountInKes(payment.amountInKes)}</td>
                <td className="px-4 py-3">
                  <StatusPill status={readStatus(payment.status)} />
                </td>
                <td className="px-4 py-3">{payment.mpesaReceiptNumber ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{payment.resultDescription ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 space-y-3 md:hidden">
        {payments.map((payment) => (
          <article key={payment.id} className="rounded-2xl border border-line bg-card px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{formatKenyanPhoneForDisplay(payment.phoneNumber)}</p>
                <p className="mt-1 text-xs text-muted">{formatNairobiDateTime(payment.createdAt)}</p>
              </div>
              <StatusPill status={readStatus(payment.status)} />
            </div>
            <p className="mt-3 text-lg font-semibold">{formatAmountInKes(payment.amountInKes)}</p>
            <p className="mt-2 text-sm text-muted">{payment.mpesaReceiptNumber ? `Receipt ${payment.mpesaReceiptNumber}` : "No receipt yet"}</p>
            {payment.resultDescription ? <p className="mt-2 text-sm leading-6 text-muted">{payment.resultDescription}</p> : null}
          </article>
        ))}
      </div>
    </>
  );
}

function StatusPill({ status }: { status: PaymentStatus }) {
  const className =
    status === "paid"
      ? "bg-[#E8F1FF] text-brand"
      : status === "pending"
        ? "bg-[#F4F0E6] text-[#8A6A2F]"
        : status === "failed"
          ? "bg-[#FDECEC] text-danger"
          : "bg-[#F1F5F9] text-[#475569]";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>{STATUS_LABELS[status]}</span>;
}

function Pagination({
  page,
  totalPages,
  searchText,
  status,
}: {
  page: number;
  totalPages: number;
  searchText: string;
  status: PaymentStatus | null;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const previous = page > 1 ? buildPageHref(page - 1, searchText, status) : null;
  const next = page < totalPages ? buildPageHref(page + 1, searchText, status) : null;

  return (
    <nav className="mt-6 flex items-center justify-between text-sm">
      {previous ? (
        <Link href={previous} className="font-medium text-brand">
          Previous
        </Link>
      ) : (
        <span className="text-muted">Previous</span>
      )}
      <span className="text-muted">
        Page {page} of {totalPages}
      </span>
      {next ? (
        <Link href={next} className="font-medium text-brand">
          Next
        </Link>
      ) : (
        <span className="text-muted">Next</span>
      )}
    </nav>
  );
}

function buildPageHref(page: number, searchText: string, status: PaymentStatus | null): string {
  const params = new URLSearchParams();
  if (searchText) {
    params.set("q", searchText);
  }
  if (status) {
    params.set("status", status);
  }
  params.set("page", String(page));
  return `/admin?${params.toString()}`;
}

function readStatus(status: string): PaymentStatus {
  if (status === "pending" || status === "paid" || status === "cancelled" || status === "timed_out" || status === "failed") {
    return status;
  }

  return "failed";
}
