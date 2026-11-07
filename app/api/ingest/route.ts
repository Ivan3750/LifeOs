import { timingSafeEqual } from 'node:crypto';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { db, dbConfigured, dbError } from '@/lib/server/db';
import { applyIngest } from '@/lib/ingest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID = 'main';
const MAX_BODY = 1024 * 1024;
const MAX_ITEMS = 500;
const MAX_STATE = 8 * 1024 * 1024;

/** The collector's own key (INGEST_TOKEN), separate from the login password so it can be changed or revoked on its own. */
function tokenOk(req: Request) {
  const want = process.env.INGEST_TOKEN || '';
  if (want.length < 24) return false;
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(got), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Receives a batch from the automatic collector and merges it into the saved state (same version check as the app itself). */
export async function POST(req: Request) {
  if (!process.env.INGEST_TOKEN) return Response.json({ error: 'disabled', message: 'INGEST_TOKEN не задано на сервері' }, { status: 503 });
  if (!tokenOk(req)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!dbConfigured()) return Response.json({ error: 'no-db' }, { status: 503 });
  const text = await req.text();
  if (text.length > MAX_BODY) return Response.json({ error: 'too-large' }, { status: 413 });
  let body: { source?: unknown; items?: unknown };
  try { body = JSON.parse(text); } catch { return Response.json({ error: 'bad-json' }, { status: 400 }); }
  if (!Array.isArray(body.items) || body.items.length > MAX_ITEMS) return Response.json({ error: 'bad-items', message: `items: масив до ${MAX_ITEMS}` }, { status: 400 });
  const source = typeof body.source === 'string' ? body.source : 'auto';
  try {
    const pool = await db();
    // another save may land between the read and the write: read again and retry
    for (let attempt = 0; attempt < 5; attempt++) {
      const [rows] = await pool.query<(RowDataPacket & { data: string; version: number })[]>('SELECT data, version FROM pulse_state WHERE id = ?', [ID]);
      const row = rows[0];
      if (!row) return Response.json({ error: 'no-state', message: 'У базі ще нема даних: відкрий застосунок і увійди один раз' }, { status: 409 });
      let S: Record<string, unknown>;
      try { S = JSON.parse(row.data); } catch { return Response.json({ error: 'corrupt' }, { status: 502 }); }
      const result = applyIngest(S, body.items, source);
      if (result.added + result.updated === 0) return Response.json({ ...result, version: row.version });
      const out = JSON.stringify(S);
      if (Buffer.byteLength(out, 'utf8') > MAX_STATE) return Response.json({ error: 'too-large' }, { status: 413 });
      const [res] = await pool.query<ResultSetHeader>('UPDATE pulse_state SET data = ?, version = version + 1 WHERE id = ? AND version = ?', [out, ID, row.version]);
      if (res.affectedRows) return Response.json({ ...result, version: row.version + 1 });
    }
    return Response.json({ error: 'busy', message: 'Дані змінюються, спробуй ще раз' }, { status: 503 });
  } catch (e) {
    return Response.json({ error: 'db', message: dbError(e) }, { status: 502 });
  }
}
