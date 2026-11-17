import { Pool, type PoolConfig } from 'pg';

type G = typeof globalThis & { __pulsePool?: Pool; __pulseReady?: Promise<void> };

export const dbConfigured = () => !!(process.env.DATABASE_URL || (process.env.DB_HOST && process.env.DB_USER));

/** Connection settings from DATABASE_URL (postgres://user:pass@host:5432/dbname?sslmode=require) or from DB_HOST, DB_USER… */
export function dbSettings(env: NodeJS.ProcessEnv = process.env): { o: PoolConfig; ssl: boolean; verify: boolean } | null {
  let o: PoolConfig, ssl: boolean;
  const url = env.DATABASE_URL?.trim();
  if (url) {
    const u = new URL(url);
    o = { host: u.hostname, port: +u.port || 5432, user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: decodeURIComponent(u.pathname.slice(1)) || undefined };
    ssl = env.DB_SSL ? env.DB_SSL === 'true' : /sslmode=(require|verify-ca|verify-full|prefer)/i.test(u.search);
  } else if (env.DB_HOST && env.DB_USER) {
    o = { host: env.DB_HOST, port: +(env.DB_PORT || 5432), user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME };
    ssl = env.DB_SSL === 'true';
  } else return null;
  const verify = env.DB_SSL_VERIFY === 'true';
  // The connection is encrypted and no certificate file is needed. The server's certificate is not checked unless DB_SSL_VERIFY=true,
  // so without it this does not protect against someone impersonating the database server.
  if (ssl) o.ssl = { rejectUnauthorized: verify };
  return { o, ssl, verify };
}

/** The table that holds the whole state as one JSON document with a version number. */
export const TABLE_SQL = `CREATE TABLE IF NOT EXISTS pulse_state (
  id VARCHAR(32) PRIMARY KEY,
  data TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

/** Shared pool. The table is created on first use. */
export async function db() {
  const g = globalThis as G;
  if (!g.__pulsePool) {
    const s = dbSettings();
    if (!s) throw new Error('database is not configured');
    g.__pulsePool = new Pool({ ...s.o, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000, keepAlive: true });
    // an idle connection that the server dropped must not crash the process
    g.__pulsePool.on('error', () => {});
  }
  const pool = g.__pulsePool;
  if (!g.__pulseReady) {
    g.__pulseReady = pool.query(TABLE_SQL).then(() => undefined).catch(e => { g.__pulseReady = undefined; throw e; });
  }
  await g.__pulseReady;
  return pool;
}

/** Error text that is safe to show: the driver code, never the connection details. */
export function dbError(e: unknown) {
  const code = (e as { code?: string })?.code;
  const hints: Record<string, string> = {
    '28P01': 'неправильний логін або пароль до бази',
    '28000': 'базі не дозволено це підключення (перевір логін і доступ з твоєї IP-адреси)',
    '3D000': 'бази з такою назвою немає, перевір DB_NAME',
    '53300': 'забагато підключень до бази',
    '57P03': 'база ще запускається, спробуй за хвилину',
    ENOTFOUND: 'хост бази не знайдено, перевір DB_HOST',
    ECONNREFUSED: 'база не приймає зʼєднання, перевір хост і порт',
    ETIMEDOUT: 'база не відповідає, перевір хост, порт і доступ з твоєї IP-адреси',
    ECONNRESET: 'зʼєднання з базою обірвано: якщо база вимагає SSL, постав DB_SSL=true',
    SELF_SIGNED_CERT_IN_CHAIN: 'сертифікат бази не пройшов перевірку: прибери DB_SSL_VERIFY',
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'сертифікат бази не пройшов перевірку: прибери DB_SSL_VERIFY',
    DEPTH_ZERO_SELF_SIGNED_CERT: 'сертифікат бази не пройшов перевірку: прибери DB_SSL_VERIFY',
  };
  if (code) return `${code}${hints[code] ? ': ' + hints[code] : ''}`;
  // the driver has no code for this one
  if (/does not support SSL/i.test((e as Error)?.message || '')) return 'база без SSL: постав DB_SSL=false';
  return 'не вдалося підключитися до бази';
}
