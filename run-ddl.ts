import { db, pool } from './src/db/index.js';
import { sql } from 'drizzle-orm';

async function run() {
    try {
        await db.execute(sql`ALTER TABLE visits ADD COLUMN case_status varchar(255) DEFAULT 'open';`);
        console.log("Added case_status");
    } catch (e: any) {
        console.log("Error adding case_status:", e.message);
    }
    
    try {
        await db.execute(sql`ALTER TABLE visits ADD COLUMN parent_visit_id varchar(255);`);
        console.log("Added parent_visit_id");
    } catch (e: any) {
        console.log("Error adding parent_visit_id:", e.message);
    }
    
    pool.end();
}

run();
