import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const connectionString = process.env.DATABASE_URL;

// We check if connectionString is set to avoid crashing at startup if not provided.
export const pool = new Pool({
  connectionString: connectionString || 'postgresql://fake:fake@localhost:5432/fake', // fallback to avoid immediate crash in pure UI mode
  ssl: connectionString && connectionString.includes('supabase') ? { rejectUnauthorized: false } : undefined
});

export const db = drizzle(pool, { schema });
