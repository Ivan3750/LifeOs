// Checks the database settings from .env without printing any secrets.
// Usage: npm run db:check
import pg from 'pg';

const env = process.env;
const url = env.DATABASE_URL?.trim();
let o, ssl;
if (url) {
  const u = new URL(url);
  o = { host: u.hostname, port: +u.port || 5432, user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: decodeURIComponent(u.pathname.slice(1)) || undefined };
  ssl = env.DB_SSL ? env.DB_SSL === 'true' : /sslmode=(require|verify-ca|verify-full|prefer)/i.test(u.search);
} else if (env.DB_HOST && env.DB_USER) {
  o = { host: env.DB_HOST, port: +(env.DB_PORT || 5432), user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME };
  ssl = env.DB_SSL === 'true';
} else {
  console.error('✗ База не налаштована: заповни DB_HOST, DB_USER, DB_PASSWORD, DB_NAME або DATABASE_URL у .env');
  process.exit(1);
}
const verify = env.DB_SSL_VERIFY === 'true';
if (ssl) o.ssl = { rejectUnauthorized: verify };

console.log(`→ ${o.host}:${o.port} / ${o.database || '(без бази)'} · SSL: ${ssl ? (verify ? 'так, з перевіркою сертифіката' : 'так, шифрування без сертифіката') : 'ні'}`);
console.log(`→ APP_PASSWORD: ${env.APP_PASSWORD ? 'задано' : 'НЕ задано (вхід у дашборд не працюватиме)'}`);
const c = new pg.Client({ ...o, connectionTimeoutMillis: 10000 });
try {
  await c.connect();
  const { rows: [v] } = await c.query('SHOW server_version');
  await c.query(`CREATE TABLE IF NOT EXISTS pulse_state (
    id VARCHAR(32) PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const { rows: [row] } = await c.query("SELECT version, updated_at FROM pulse_state WHERE id = 'main'");
  console.log(`✓ Підключено, PostgreSQL ${v.server_version}. Таблиця pulse_state готова.`);
  console.log(row ? `✓ Збережені дані: версія ${row.version}, оновлено ${new Date(row.updated_at).toLocaleString('uk-UA')}` : '• Даних ще немає: перший вхід у дашборд їх створить.');
  await c.end();
} catch (e) {
  console.error(`✗ Не вдалося підключитися: ${e.code || ''} ${e.message?.split('\n')[0] || ''}`.replace(o.password || '\u0000', '***'));
  process.exit(1);
}
