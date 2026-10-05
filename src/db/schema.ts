import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantRequestId: text("merchant_request_id").notNull(),
    checkoutRequestId: text("checkout_request_id").notNull().unique(),
    phoneNumber: text("phone_number").notNull(),
    customerName: text("customer_name"),
    amountInKes: integer("amount_in_kes").notNull(),
    accountReference: text("account_reference").notNull(),
    transactionDescription: text("transaction_description").notNull(),
    status: text("status").notNull().default("pending"),
    resultCode: text("result_code"),
    resultDescription: text("result_description"),
    mpesaReceiptNumber: text("mpesa_receipt_number"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    rawCallback: jsonb("raw_callback"),
    lastQueriedAt: timestamp("last_queried_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("payments_phone_created_idx").on(table.phoneNumber, table.createdAt),
    index("payments_status_created_idx").on(table.status, table.createdAt),
    index("payments_paid_at_idx").on(table.paidAt),
  ],
);

export type AdminUserRecord = typeof adminUsers.$inferSelect;
export type PaymentRecord = typeof payments.$inferSelect;
