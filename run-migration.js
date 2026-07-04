import { pool } from './src/db/index.js';

async function migrate() {
  try {
    await pool.query('ALTER TABLE "lab_orders" ALTER COLUMN "timestamp" SET DATA TYPE bigint;');
    console.log("Migration executed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await pool.end();
  }
}

migrate();
