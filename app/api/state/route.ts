import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { isAuthed, unauthorized } from '@/lib/server/auth';
import { db, dbConfigured, dbError } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID = 'main';
const MAX_BYTES = 8 * 1024 * 1024;

/** The stored text, or null when it cannot be read (the client then keeps its own copy instead of crashing). */
function parse(text: string) {
  try { const v = JSON.parse(text); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; }
}

type Row = RowDataPacket & { data: string; version: number; updated_at: Date };

async function current() {
  const [rows] = await (await db()).query<Row[]>('SELECT data, version, updated_at FROM pulse_state WHERE id = ?', [ID]);
  return rows[0] || null;
}

/** Latest saved state. With ?v=N and nothing newer than N, the data is left out. */
export async function GET(req: Request) {
  if (!(await isAuthed())) return unauthorized();
  if (!dbConfigured()) return Response.json({ error: 'no-db' }, { status: 503 });
  try {
    const known = Number(new URL(req.url).searchParams.get('v') || -1);
    const row = await current();
    if (!row) return Response.json({ version: 0, data: null });
    if (row.version === known) return Response.json({ version: row.version, same: true });
    const data = parse(row.data);
    if (!data) return Response.json({ error: 'corrupt', message: 'Збережені дані в базі пошкоджені. Відновіть їх із резервної копії (Налаштування → Експорт/Імпорт).' }, { status: 502 });
    return Response.json({ version: row.version, data, at: row.updated_at });
  } catch (e) {
    return Response.json({ error: 'db', message: dbError(e) }, { status: 502 });
  }
}

/** Saves the state if nobody saved since baseVersion; otherwise answers 409 with the newer copy. */
export async function PUT(req: Request) {
  if (!(await isAuthed())) return unauthorized();
  if (!dbConfigured()) return Response.json({ error: 'no-db' }, { status: 503 });
  let body: { data?: unknown; baseVersion?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: 'bad-json' }, { status: 400 }); }
  if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) return Response.json({ error: 'bad-data' }, { status: 400 });
  const text = JSON.stringify(body.data);
  if (Buffer.byteLength(text, 'utf8') > MAX_BYTES) return Response.json({ error: 'too-large', message: 'Дані завеликі для збереження (понад 8 МБ). Видали старі записи або зроби експорт і почисти.' }, { status: 413 });
  const base = Number(body.baseVersion) || 0;
  try {
    const pool = await db();
    const [res] = base === 0
      ? await pool.query<ResultSetHeader>('INSERT IGNORE INTO pulse_state (id, data, version) VALUES (?, ?, 1)', [ID, text])
      : await pool.query<ResultSetHeader>('UPDATE pulse_state SET data = ?, version = version + 1 WHERE id = ? AND version = ?', [text, ID, base]);
    if (res.affectedRows === 0) {
      const row = await current();
      return Response.json({ error: 'conflict', version: row?.version ?? 0, data: row ? parse(row.data) : null }, { status: 409 });
    }
    return Response.json({ version: base + 1 });
  } catch (e) {
    return Response.json({ error: 'db', message: dbError(e) }, { status: 502 });
  }
}
