import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Remote Postgres (Linode) uses a self-signed cert, so verification must be
  // off or every query fails on Vercel (NODE_ENV=production). Connection stays
  // TLS-encrypted; we just don't verify the cert chain. Matches .env.local.example.
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
  max: 10,
  // Serverless hardening: a blocked connect now rejects fast instead of riding
  // to Vercel's gateway timeout (504). Idle connections are recycled.
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  keepAlive: true,
});

export default pool;
