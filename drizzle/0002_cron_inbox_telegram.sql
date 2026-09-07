CREATE TABLE "inbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_token" text NOT NULL,
	"portfolio_id" uuid,
	"run_id" uuid,
	"symbol" text NOT NULL,
	"status" text NOT NULL,
	"judul" text NOT NULL,
	"teks" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_links" (
	"chat_id" text PRIMARY KEY NOT NULL,
	"owner_token" text NOT NULL,
	"portfolio_id" uuid,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "inbox_owner_created_idx" ON "inbox" USING btree ("owner_token","created_at");--> statement-breakpoint
CREATE INDEX "telegram_links_owner_idx" ON "telegram_links" USING btree ("owner_token");