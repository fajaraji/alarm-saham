CREATE TYPE "public"."corporate_action_kind" AS ENUM('dividend', 'stock_split', 'right_issue', 'warrant', 'bonus', 'agm', 'other');--> statement-breakpoint
CREATE TYPE "public"."symbol_group" AS ENUM('delisting', 'watchlist', 'control');--> statement-breakpoint
CREATE TABLE "alarms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_token" text NOT NULL,
	"name" text NOT NULL,
	"rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_score" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"endpoint" text NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "api_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"endpoint" text NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" integer NOT NULL,
	"credits" integer DEFAULT 0 NOT NULL,
	"cache_hit" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corporate_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"kind" "corporate_action_kind" NOT NULL,
	"event_date" date NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "filings" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"holder_name" text,
	"holder_type" text,
	"transaction_type" text,
	"amount_transaction" numeric(28, 2),
	"price" numeric(28, 2),
	"transaction_value" numeric(28, 2),
	"share_pct_before" numeric(12, 6),
	"share_pct_after" numeric(12, 6),
	"source" text
);
--> statement-breakpoint
CREATE TABLE "financials_q" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"report_date" date NOT NULL,
	"total_equity" numeric(28, 2),
	"total_liabilities" numeric(28, 2),
	"total_assets" numeric(28, 2),
	"earnings" numeric(28, 2),
	"revenue" numeric(28, 2),
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "financials_q_symbol_date_uq" UNIQUE("symbol","report_date")
);
--> statement-breakpoint
CREATE TABLE "portfolios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_token" text NOT NULL,
	"symbols" text[] DEFAULT '{}' NOT NULL,
	"alarm_ids" uuid[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_dates" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"report_date" date NOT NULL,
	"quarter" text NOT NULL,
	"fiscal_year" integer NOT NULL,
	CONSTRAINT "report_dates_symbol_year_quarter_uq" UNIQUE("symbol","fiscal_year","quarter")
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alarm_id" uuid NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL,
	"score" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suspensions" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"suspension_date" date NOT NULL,
	"reason" text,
	"pdf_url" text,
	CONSTRAINT "suspensions_symbol_date_uq" UNIQUE("symbol","suspension_date")
);
--> statement-breakpoint
CREATE TABLE "symbols" (
	"symbol" text PRIMARY KEY NOT NULL,
	"company_name" text,
	"sub_sector" text,
	"group" "symbol_group" NOT NULL,
	"target_event_date" date,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_alarm_id_alarms_id_fk" FOREIGN KEY ("alarm_id") REFERENCES "public"."alarms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alarms_owner_idx" ON "alarms" USING btree ("owner_token");--> statement-breakpoint
CREATE INDEX "api_cache_endpoint_idx" ON "api_cache" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "api_ledger_at_idx" ON "api_ledger" USING btree ("at");--> statement-breakpoint
CREATE INDEX "corporate_actions_symbol_date_idx" ON "corporate_actions" USING btree ("symbol","event_date");--> statement-breakpoint
CREATE INDEX "filings_symbol_ts_idx" ON "filings" USING btree ("symbol","timestamp");--> statement-breakpoint
CREATE INDEX "financials_q_symbol_date_idx" ON "financials_q" USING btree ("symbol","report_date");--> statement-breakpoint
CREATE INDEX "portfolios_owner_idx" ON "portfolios" USING btree ("owner_token");--> statement-breakpoint
CREATE INDEX "report_dates_symbol_date_idx" ON "report_dates" USING btree ("symbol","report_date");--> statement-breakpoint
CREATE INDEX "runs_alarm_ran_at_idx" ON "runs" USING btree ("alarm_id","ran_at");--> statement-breakpoint
CREATE INDEX "suspensions_symbol_date_idx" ON "suspensions" USING btree ("symbol","suspension_date");