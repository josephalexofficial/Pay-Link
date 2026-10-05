CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_request_id" text NOT NULL,
	"checkout_request_id" text NOT NULL,
	"phone_number" text NOT NULL,
	"amount_in_kes" integer NOT NULL,
	"account_reference" text NOT NULL,
	"transaction_description" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result_code" text,
	"result_description" text,
	"mpesa_receipt_number" text,
	"paid_at" timestamp with time zone,
	"raw_callback" jsonb,
	"last_queried_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_checkout_request_id_unique" UNIQUE("checkout_request_id")
);
--> statement-breakpoint
CREATE INDEX "payments_phone_created_idx" ON "payments" USING btree ("phone_number","created_at");--> statement-breakpoint
CREATE INDEX "payments_status_created_idx" ON "payments" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "payments_paid_at_idx" ON "payments" USING btree ("paid_at");