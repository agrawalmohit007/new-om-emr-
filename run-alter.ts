import { db, pool } from './src/db/index.js';
import { sql } from 'drizzle-orm';

async function run() {
    try {
        await db.execute(sql`
            ALTER TABLE pharmacy_items 
                ALTER COLUMN quantity TYPE real,
                ALTER COLUMN mrp TYPE real,
                ALTER COLUMN purchase_rate TYPE real,
                ALTER COLUMN sale_rate TYPE real,
                ALTER COLUMN gst_percentage TYPE real,
                ALTER COLUMN min_stock_level TYPE real;

            ALTER TABLE pharmacy_sales 
                ALTER COLUMN sub_total TYPE real,
                ALTER COLUMN total_gst TYPE real,
                ALTER COLUMN discount TYPE real,
                ALTER COLUMN grand_total TYPE real;

            ALTER TABLE lab_inventory_items 
                ALTER COLUMN quantity TYPE real,
                ALTER COLUMN price_per_unit TYPE real,
                ALTER COLUMN total_price TYPE real,
                ALTER COLUMN price_per_strip TYPE real;
        `);
        console.log("Altered tables to use real");
    } catch (e: any) {
        console.log("Error altering tables:", e.message);
    }
    pool.end();
}

run();
