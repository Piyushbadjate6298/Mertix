import './config/dns.js';
import { getEnv, assertServerEnv } from './config/env.js';
import { createDatabase } from './config/database.js';
import { createPlatformService } from './services/platform.service.js';
import { createEmailService } from './services/email.service.js';
import { createApp } from './app.js';
import Razorpay from 'razorpay';

const env = getEnv();
assertServerEnv(env);
const database = createDatabase(env);

try {
  await database.initialize();
  const razorpay = env.razorpay.keyId && env.razorpay.keySecret
    ? new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret })
    : null;
  const service = createPlatformService(database, { env, razorpay });
  const emailService = createEmailService(env.smtp);
  const app = createApp({ service, emailService, env });
  const server = app.listen(env.port, env.host, () => console.log(`MERITX API listening on http://${env.host}:${env.port}`));
  const shutdown = (signal) => {
    console.log(`${signal} received; closing MERITX API`);
    server.close(async () => { await database.close(); process.exit(0); });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
} catch (error) {
  let maskedTarget = 'configured database';
  try {
    const parsed = new URL(env.databaseUrl);
    maskedTarget = `${parsed.protocol}//${parsed.username}:****@${parsed.host}${parsed.pathname}`;
  } catch {}

  console.error(`\nMERITX API startup failed: ${error.message || error}`);
  console.error(`Target Database: ${maskedTarget}`);

  if (error.code === 'ECONNREFUSED' || (error.message && error.message.includes('ECONNREFUSED'))) {
    console.error('\n--> [MERITX TIP]: Connection was refused.');
    if (env.databaseUrl.includes('localhost') || env.databaseUrl.includes('127.0.0.1')) {
      console.error('--> Notice that DATABASE_URL is still pointing to localhost:5432.');
      console.error('--> If you edited backend/.env, make sure to PRESS CTRL + S to SAVE the file!');
      console.error('--> Make sure your changes are saved in backend/.env (not .env.example).\n');
    } else {
      console.error('--> Check that your database host, port, and IP allowlist/firewall permit incoming connections.\n');
    }
  } else if (error.code === '28P01' || (error.message && error.message.includes('password authentication failed'))) {
    console.error('\n--> [MERITX TIP]: Password authentication failed. Check your database password in backend/.env.');
    console.error('--> Note: If your password contains special characters (@, #, $, %, etc.), URL-encode them.\n');
  } else if (error.code === '3D000' || (error.message && error.message.includes('does not exist'))) {
    console.error('\n--> [MERITX TIP]: Database name does not exist. Ensure the database is created first.\n');
  } else if (error.code === 'ENOTFOUND' || (error.message && error.message.includes('ENOTFOUND'))) {
    console.error('\n--> [MERITX TIP]: Hostname lookup failed (DNS error). Check your internet connection or verify the database hostname in backend/.env.\n');
  }
  await database.close().catch(() => {});
  process.exit(1);
}


