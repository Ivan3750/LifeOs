import fs from 'node:fs';
import mysql from 'mysql2/promise';

type G = typeof globalThis & { __pulsePool?: mysql.Pool; __pulseReady?: Promise<void> };

export const dbConfigured = () => !!(process.env.DATABASE_URL || (process.env.DB_HOST && process.env.DB_USER));

/** CA certificate from DB_CA_CERT: either the PEM text itself or a path to a .pem file. */
function caCert(): string | undefined {
  const v = process.env.DB_CA_CERT?.trim();
  if (!v) return undefined;
  if (v.startsWith('-----BEGIN')) return v.replace(/\\n/g, '\n');
  return fs.readFileSync(v, 'utf8');
}

function config(): mysql.PoolOptions {
  let o: mysql.PoolOptions, sslWanted: boolean;
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    // Service URI, e.g. mysql://avnadmin:pass@host:23785/defaultdb?ssl-mode=REQUIRED
    const u = new URL(url);
    o = { host: u.hostname, port: +u.port || 3306, user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: u.pathname.slice(1) || undefined };
    sslWanted = process.env.DB_SSL ? process.env.DB_SSL === 'true' : /ssl-mode=(required|verify)/i.test(u.search);
  } else {
    o = { host: process.env.DB_HOST, port: +(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME };
    sslWanted = process.env.DB_SSL === 'true';
  }
  if (sslWanted) {
    const ca = caCert();
    // With a CA (Aiven: "CA certificate" on the service page) the server is fully verified.
    // Without it the connection is still encrypted, but the server certificate is not checked.
    o.ssl = ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };
  }
  return { ...o, connectionLimit: 5, waitForConnections: true, connectTimeout: 10000, enableKeepAlive: true, charset: 'utf8mb4' };
}

/** Shared pool. The table is created on first use. */
export async function db() {
  const g = globalThis as G;
  if (!g.__pulsePool) g.__pulsePool = mysql.createPool(config());
  if (!g.__pulseReady) {
    g.__pulseReady = g.__pulsePool
      .query(`CREATE TABLE IF NOT EXISTS pulse_state (
        id VARCHAR(32) NOT NULL PRIMARY KEY,
        data LONGTEXT NOT NULL,
        version INT NOT NULL DEFAULT 1,
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
      ) CHARACTER SET utf8mb4`)
      .then(() => undefined)
      .catch(e => { g.__pulseReady = undefined; throw e; });
  }
  await g.__pulseReady;
  return g.__pulsePool;
}

/** Error text that is safe to show: the driver code, never the connection details. */
export function dbError(e: unknown) {
  const code = (e as { code?: string })?.code;
  const hints: Record<string, string> = {
    ER_ACCESS_DENIED_ERROR: 'неправильний логін або пароль до бази',
    ENOTFOUND: 'хост бази не знайдено, перевір DB_HOST',
    ECONNREFUSED: 'база не приймає зʼєднання, перевір хост і порт',
    ETIMEDOUT: 'база не відповідає, перевір хост, порт і доступ з твоєї IP-адреси',
    HANDSHAKE_SSL_ERROR: 'помилка SSL, перевір DB_SSL і DB_CA_CERT',
    ER_BAD_DB_ERROR: 'бази з такою назвою немає, перевір DB_NAME',
  };
  return code ? `${code}${hints[code] ? ': ' + hints[code] : ''}` : 'не вдалося підключитися до бази';
}
