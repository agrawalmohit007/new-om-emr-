ALTER TABLE "lab_orders" ALTER COLUMN "timestamp" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "visits" ADD COLUMN "case_status" text DEFAULT 'open';--> statement-breakpoint
ALTER TABLE "visits" ADD COLUMN "parent_visit_id" text;