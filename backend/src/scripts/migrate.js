import { getEnv, assertServerEnv } from '../config/env.js';
import { createDatabase } from '../config/database.js';

const env = getEnv();
assertServerEnv(env);
const database = createDatabase(env);
try {
  await database.initialize();
  console.log('Database schema is ready.');
} finally {
  await database.close();
}
