import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { config } from 'dotenv'

config()

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and configure credentials.')
}

export const pool = new Pool({ connectionString })

export const db = drizzle(pool)

export async function closeDb() {
  await pool.end()
}
