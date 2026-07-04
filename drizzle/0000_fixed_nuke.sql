CREATE TABLE "consultants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"department" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"qualifications" text,
	"specialty" text,
	"base_fee" integer,
	"follow_up_fee" integer,
	"pin" text,
	"roles" jsonb
);
--> statement-breakpoint
CREATE TABLE "fallback_store" (
	"collection" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lab_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"tests" jsonb NOT NULL,
	"ultrasound" boolean DEFAULT false,
	"status" text NOT NULL,
	"report_data" jsonb,
	"timestamp" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" text PRIMARY KEY NOT NULL,
	"uhid" text NOT NULL,
	"name" text NOT NULL,
	"age" text NOT NULL,
	"address" text,
	"mobile" text,
	"type" text NOT NULL,
	"is_previously_registered" boolean DEFAULT false,
	"pregnancy_info" jsonb,
	"obstetric_history" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"roles" jsonb NOT NULL,
	"pin" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"date" text NOT NULL,
	"visit_type" text NOT NULL,
	"fees" integer,
	"orders" jsonb,
	"is_approved" boolean DEFAULT false,
	"calling_status" text,
	"vitals" jsonb,
	"payment_status" text,
	"payment_method" text,
	"assigned_doctor" text,
	"discount" integer,
	"doctor_action_status" text,
	"collected_by" text,
	"final_bill" jsonb,
	"complaints" text,
	"visit_obstetric_history" text,
	"menstrual_history" text,
	"visit_lmp" text,
	"visit_edd" text,
	"visit_pog" text,
	"general_examination" text,
	"examination_details" text,
	"prescription" text,
	"remarks" text,
	"follow_up_date" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;