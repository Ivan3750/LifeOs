// Checks the database settings from .env without printing any secrets.
// Usage: npm run db:check
import fs from 'node:fs';
import mysql from 'mysql2/promise';

const env = process.env;
const url = env.DATABASE_URL?.trim();
let o, ssl;
if (url) {
  const u = new URL(url);
  o = { host: u.hostname, port: +u.port || 3306, user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: u.pathname.slice(1) || undefined };
  ssl = env.DB_SSL ? env.DB_SSL === 'true' : /ssl-mode=(required|verify)/i.test(u.search);
} else if (env.DB_HOST && env.DB_USER) {
  o = { host: env.DB_HOST, port: +(env.DB_PORT || 3306), user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME };
  ssl = env.DB_SSL === 'true';
} else {
  console.error('✗ База не налаштована: заповни DB_HOST, DB_USER, DB_PASSWORD, DB_NAME або DATABASE_URL у .env');
  process.exit(1);
}
const caRaw = env.DB_CA_CERT?.trim();
const ca = caRaw ? (caRaw.startsWith('-----BEGIN') ? caRaw.replace(/\\n/g, '\n') : fs.readFileSync(caRaw, 'utf8')) : undefined;
if (ssl) o.ssl = ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };

console.log(`→ ${o.host}:${o.port} / ${o.database || '(без бази)'} · SSL: ${ssl ? (ca ? 'так, з перевіркою CA' : 'так, без перевірки CA') : 'ні'}`);
console.log(`→ APP_PASSWORD: ${env.APP_PASSWORD ? 'задано' : 'НЕ задано (вхід у дашборд не працюватиме)'}`);
try {
  const c = await mysql.createConnection({ ...o, connectTimeout: 10000 });
  const [[v]] = await c.query('SELECT VERSION() AS v');
  await c.query(`CREATE TABLE IF NOT EXISTS pulse_state (
    id VARCHAR(32) NOT NULL PRIMARY KEY, data LONGTEXT NOT NULL, version INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
  ) CHARACTER SET utf8mb4`);
  const [[row]] = await c.query("SELECT version, updated_at FROM pulse_state WHERE id = 'main'");
  console.log(`✓ Підключено, MySQL ${v.v}. Таблиця pulse_state готова.`);
  console.log(row ? `✓ Збережені дані: версія ${row.version}, оновлено ${new Date(row.updated_at).toLocaleString('uk-UA')}` : '• Даних ще немає: перший вхід у дашборд їх створить.');
  await c.end();
} catch (e) {
  console.error(`✗ Не вдалося підключитися: ${e.code || ''} ${e.message?.split('\n')[0] || ''}`.replace(o.password || '\u0000', '***'));
  process.exit(1);
}
