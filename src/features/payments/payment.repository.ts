import { and, desc, eq, gte, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";

import { normalizeKenyanPhone } from "@/common/utils/phone";
import { getDatabase } from "@/db/client";
import { payments, type PaymentRecord } from "@/db/schema";

import type { PaymentStatus } from "./payment.constants";

export type NewPayment = {
  merchantRequestId: string;
  checkoutRequestId: string;
  phoneNumber: string;
  amountInKes: number;
  accountReference: string;
  transactionDescription: string;
};

export type PaymentPatch = {
  status?: PaymentStatus;
  resultCode?: string | null;
  resultDescription?: string | null;
  mpesaReceiptNumber?: string | null;
  paidAt?: Date | null;
  rawCallback?: unknown;
  lastQueriedAt?: Date | null;
  customerName?: string | null;
};

export type PaymentListQuery = {
  searchText: string;
  status: PaymentStatus | null;
  page: number;
  pageSize: number;
};

export type PaymentSummary = {
  collectedTodayInKes: number;
  collectedThisMonthInKes: number;
  attemptsToday: number;
  pendingCount: number;
};

/**
 * Inserts the pending row created when Daraja accepts an STK prompt.
 *
 * @param payment - Identifiers and amount returned by the STK request.
 * @returns The stored payment.
 */
export async function insertPayment(payment: NewPayment): Promise<PaymentRecord> {
  const database = getDatabase();
  const inserted = await database.insert(payments).values(payment).returning();
  const created = inserted[0];

  if (!created) {
    throw new Error("Payment insert did not return a row.");
  }

  return created;
}

/**
 * Loads one payment by the Daraja checkout ticket.
 *
 * @param checkoutRequestId - CheckoutRequestID from the STK accept response.
 * @returns The payment, or null when this app did not create that ticket.
 */
export async function findPaymentByCheckoutRequestId(checkoutRequestId: string): Promise<PaymentRecord | null> {
  const database = getDatabase();
  const rows = await database
    .select()
    .from(payments)
    .where(eq(payments.checkoutRequestId, checkoutRequestId))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Loads one payment by the M-Pesa receipt.
 *
 * @param receiptNumber - MpesaReceiptNumber from a completed payment.
 * @returns The payment, or null when no row has that receipt yet.
 */
export async function findPaymentByReceiptNumber(receiptNumber: string): Promise<PaymentRecord | null> {
  const database = getDatabase();
  const rows = await database.select().from(payments).where(eq(payments.mpesaReceiptNumber, receiptNumber)).limit(1);

  return rows[0] ?? null;
}

/**
 * Loads the newest matching payment that does not have a payer name yet.
 *
 * @param phoneNumber - Normalized 254 number.
 * @param amountInKes - Whole shillings.
 * @param createdAfter - Oldest prompt that can still be the same payment.
 * @returns The payment, or null when nothing matches.
 */
export async function findLatestUnnamedPayment(
  phoneNumber: string,
  amountInKes: number,
  createdAfter: Date,
): Promise<PaymentRecord | null> {
  const database = getDatabase();
  const rows = await database
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.phoneNumber, phoneNumber),
        eq(payments.amountInKes, amountInKes),
        gte(payments.createdAt, createdAfter),
        isNull(payments.customerName),
      ),
    )
    .orderBy(desc(payments.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Finds a prompt already sent to this phone inside the cooldown window.
 *
 * @param phoneNumber - Normalized 254 number.
 * @param createdAfter - Lower bound for createdAt.
 * @returns The newest pending payment in that window, if one exists.
 */
export async function findPendingPaymentForPhone(
  phoneNumber: string,
  createdAfter: Date,
): Promise<PaymentRecord | null> {
  const database = getDatabase();
  const rows = await database
    .select()
    .from(payments)
    .where(
      and(eq(payments.phoneNumber, phoneNumber), eq(payments.status, "pending"), gte(payments.createdAt, createdAfter)),
    )
    .orderBy(desc(payments.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Counts prompts sent to one phone since the given instant.
 *
 * @param phoneNumber - Normalized 254 number.
 * @param createdAfter - Start of the rate-limit window.
 * @returns How many payment rows were created in that window.
 */
export async function countPaymentsForPhoneSince(phoneNumber: string, createdAfter: Date): Promise<number> {
  const database = getDatabase();
  const rows = await database
    .select({ total: sql<number>`count(*)::int` })
    .from(payments)
    .where(and(eq(payments.phoneNumber, phoneNumber), gte(payments.createdAt, createdAfter)));

  return rows[0]?.total ?? 0;
}

/**
 * Updates one payment matched by checkout ticket.
 *
 * @param checkoutRequestId - Daraja CheckoutRequestID.
 * @param patch - Fields to change. updatedAt is always refreshed.
 * @returns The updated row, or null when the ticket is unknown.
 */
export async function updatePaymentByCheckoutRequestId(
  checkoutRequestId: string,
  patch: PaymentPatch,
): Promise<PaymentRecord | null> {
  const database = getDatabase();
  const updated = await database
    .update(payments)
    .set({
      ...patch,
      updatedAt: new Date(),
    })
    .where(eq(payments.checkoutRequestId, checkoutRequestId))
    .returning();

  return updated[0] ?? null;
}

/**
 * Loads pending payments that already have a Safaricom callback saved.
 *
 * @returns Up to 50 newest pending rows whose callback can settle the status.
 */
export async function findPendingPaymentsWithCallbacks(): Promise<PaymentRecord[]> {
  const database = getDatabase();

  return database
    .select()
    .from(payments)
    .where(and(eq(payments.status, "pending"), isNotNull(payments.rawCallback)))
    .orderBy(desc(payments.createdAt))
    .limit(50);
}

/**
 * Lists payments for the admin table, newest first, with a hard page size.
 *
 * @param query - Search text, optional status, and page bounds.
 * @returns The page of rows and the total count matching the same filter.
 */
export async function listPayments(query: PaymentListQuery): Promise<{ rows: PaymentRecord[]; totalRecords: number }> {
  const database = getDatabase();
  const filters = buildListFilters(query);
  const offset = (query.page - 1) * query.pageSize;

  const rows = await database
    .select()
    .from(payments)
    .where(filters)
    .orderBy(desc(payments.createdAt))
    .limit(query.pageSize)
    .offset(offset);

  const totals = await database.select({ total: sql<number>`count(*)::int` }).from(payments).where(filters);

  return {
    rows,
    totalRecords: totals[0]?.total ?? 0,
  };
}

/**
 * Aggregates the four figures shown at the top of the admin dashboard.
 *
 * @param dayStart - Midnight at the start of today in Nairobi.
 * @param monthStart - Midnight at the start of this month in Nairobi.
 * @returns Collected totals and counts. Missing rows count as zero.
 */
export async function summarizePayments(dayStart: Date, monthStart: Date): Promise<PaymentSummary> {
  const database = getDatabase();
  const rows = await database
    .select({
      collectedTodayInKes: sql<number>`coalesce(sum(${payments.amountInKes}) filter (where ${payments.status} = 'paid' and ${payments.paidAt} >= ${dayStart}), 0)::int`,
      collectedThisMonthInKes: sql<number>`coalesce(sum(${payments.amountInKes}) filter (where ${payments.status} = 'paid' and ${payments.paidAt} >= ${monthStart}), 0)::int`,
      attemptsToday: sql<number>`count(*) filter (where ${payments.createdAt} >= ${dayStart})::int`,
      pendingCount: sql<number>`count(*) filter (where ${payments.status} = 'pending')::int`,
    })
    .from(payments);

  const summary = rows[0];

  return {
    collectedTodayInKes: summary?.collectedTodayInKes ?? 0,
    collectedThisMonthInKes: summary?.collectedThisMonthInKes ?? 0,
    attemptsToday: summary?.attemptsToday ?? 0,
    pendingCount: summary?.pendingCount ?? 0,
  };
}

function buildListFilters(query: PaymentListQuery) {
  const clauses = [];

  if (query.status) {
    clauses.push(eq(payments.status, query.status));
  }

  const searchText = query.searchText.trim();
  if (searchText.length > 0) {
    const normalizedPhone = normalizeKenyanPhone(searchText);
    const phoneMatch = normalizedPhone ? eq(payments.phoneNumber, normalizedPhone) : undefined;
    const looseMatch = or(
      ilike(payments.phoneNumber, `%${searchText}%`),
      ilike(payments.mpesaReceiptNumber, `%${searchText}%`),
    );

    clauses.push(phoneMatch ? or(phoneMatch, looseMatch) : looseMatch);
  }

  if (clauses.length === 0) {
    return undefined;
  }

  return and(...clauses);
}
