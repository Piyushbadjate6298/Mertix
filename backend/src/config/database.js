import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;
const migrationPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations/001_init.sql');

export function createDatabase(env) {
  const isRemote = env.databaseUrl && !env.databaseUrl.includes('localhost') && !env.databaseUrl.includes('127.0.0.1');
  const needsSsl = env.databaseSsl || (isRemote && (env.databaseUrl.includes('sslmode=') || /supabase|neon|render|aws|aiven|railway/i.test(env.databaseUrl)));

  const pool = new Pool({
    connectionString: env.databaseUrl,
    ssl: needsSsl ? { rejectUnauthorized: false } : (env.databaseSsl ? { rejectUnauthorized: false } : false),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });


  return {
    query: (text, params) => pool.query(text, params),
    async transaction(work) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async initialize() {
      await pool.query('SELECT 1');
      await pool.query(await fs.readFile(migrationPath, 'utf8'));
      if (env.seedDemoUsers) await seedDemoUsers(pool);
    },
    close: () => pool.end(),
  };
}

async function seedDemoUsers(pool) {
  const users = [
    ['student-1', 'Aarav Sharma', 'student@meritx.demo', 'Student@123', 'student', 'JEE Main', 'Pune', '2027'],
    ['teacher-1', 'Dr. Meera Joshi', 'teacher@meritx.demo', 'Teacher@123', 'teacher', null, null, null],
    ['admin-1', 'Operations Admin', 'admin@meritx.demo', 'Admin@123', 'admin', null, null, null],
    ['super-1', 'Finance Director', 'superadmin@meritx.demo', 'Super@123', 'superadmin', null, null, null],
  ];
  for (const [id, name, email, password, role, target, city, year] of users) {
    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, target, city, academic_year)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO NOTHING`,
      [id, name, email, passwordHash, role, target, city, year],
    );
  }
}
