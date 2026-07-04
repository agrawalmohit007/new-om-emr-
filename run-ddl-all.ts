import { db, pool } from './src/db/index.js';
import { sql } from 'drizzle-orm';

async function run() {
    try {
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS app_settings (
                key text PRIMARY KEY,
                value jsonb NOT NULL,
                updated_at timestamp DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS wards (
                id text PRIMARY KEY,
                name text NOT NULL,
                beds jsonb DEFAULT '[]'::jsonb
            );

            CREATE TABLE IF NOT EXISTS clinical_templates (
                id text PRIMARY KEY,
                title text NOT NULL,
                content text NOT NULL,
                category text NOT NULL
            );

            CREATE TABLE IF NOT EXISTS pharmacy_items (
                id text PRIMARY KEY,
                name text NOT NULL,
                generic_name text,
                quantity integer NOT NULL DEFAULT 0,
                batch_number text NOT NULL,
                expiry_date text NOT NULL,
                added_date text NOT NULL,
                mrp integer NOT NULL DEFAULT 0,
                purchase_rate integer NOT NULL DEFAULT 0,
                sale_rate integer NOT NULL DEFAULT 0,
                gst_percentage integer NOT NULL DEFAULT 0,
                supplier_id text,
                rack_location text,
                min_stock_level integer NOT NULL DEFAULT 0,
                rx_group jsonb
            );

            CREATE TABLE IF NOT EXISTS pharmacy_sales (
                id text PRIMARY KEY,
                invoice_no text NOT NULL,
                date text NOT NULL,
                patient_name text NOT NULL,
                doctor_name text NOT NULL,
                items jsonb NOT NULL,
                sub_total integer NOT NULL DEFAULT 0,
                total_gst integer NOT NULL DEFAULT 0,
                discount integer NOT NULL DEFAULT 0,
                grand_total integer NOT NULL DEFAULT 0,
                payment_method text NOT NULL
            );

            CREATE TABLE IF NOT EXISTS saved_reports (
                id text PRIMARY KEY,
                report_data jsonb NOT NULL,
                selected_tests jsonb NOT NULL,
                bill_data jsonb,
                timestamp bigint NOT NULL,
                is_deleted boolean DEFAULT false,
                deletion_reason text,
                deletion_timestamp bigint
            );

            CREATE TABLE IF NOT EXISTS lab_inventory_items (
                id text PRIMARY KEY,
                category text NOT NULL,
                name text NOT NULL,
                quantity integer NOT NULL DEFAULT 0,
                price_per_unit integer NOT NULL DEFAULT 0,
                total_price integer NOT NULL DEFAULT 0,
                order_date text NOT NULL,
                installation_date text,
                use_before_date text NOT NULL,
                is_open boolean DEFAULT false,
                remaining_tests integer NOT NULL DEFAULT 0,
                strips_per_box integer,
                price_per_strip integer,
                units_per_box integer
            );
        `);
        console.log("Created all missing tables");
    } catch (e: any) {
        console.log("Error creating tables:", e.message);
    }
    pool.end();
}

run();
