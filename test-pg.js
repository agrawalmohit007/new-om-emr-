import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  console.log("DB_URL:", process.env.DATABASE_URL);
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    console.log("Connected!");
    await client.end();
  } catch(e) {
    console.error("Error:", e);
  }
}
test();
