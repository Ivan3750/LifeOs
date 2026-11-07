import { GUESS, toMin } from './util';

/* Automatic data entry. A collector (the Raspberry Pi) sends small typed items; this turns them into records of the state.
   Pure and defensive: the input comes from outside, so every field is checked and clamped, and sending the same item twice never duplicates it.
   It works on the raw JSON of the state (the server does not know the app's types at runtime). */

export type IngestItem =
  | { type: 'social'; ext: string; date: string; platform: string; min: number; why?: string }
  | { type: 'activity'; ext: string; kind: string; title?: string; start: number; end: number }
  | { type: 'tx'; ext: string; dir: 'in' | 'out'; amt: number; cat?: string; note?: string; date: string; acc?: 'dk' | 'ua' }
  | { type: 'health'; date: string; sleep?: number; bed?: string; wake?: string; steps?: number; workout?: number; weight?: number; water?: number };

export type IngestResult = { added: number; updated: number; skipped: number; rejected: { i: number; why: string }[] };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const okDate = (v: unknown): v is string => typeof v === 'string' && DATE.test(v) && !Number.isNaN(new Date(v + 'T00:00').getTime());
const list = (S: Obj, key: string) => (Array.isArray(S[key]) ? (S[key] as Obj[]) : (S[key] = []) as Obj[]);

/** Category of a bank line from its text, with the same word list the manual form uses. */
export function guessCategory(note: string, dir: 'in' | 'out'): string {
  if (dir === 'in') return /wolt/i.test(note) ? 'Wolt' : /løn|salary|зарплат/i.test(note) ? 'Зарплата' : 'Інше';
  return GUESS.find(([re]) => re.test(note))?.[1] || 'Інше';
}

/** Applies the items to the state S (changed in place). Never throws on bad items: they are reported and skipped. */
export function applyIngest(S: Obj, items: unknown[], source: string, now = Date.now()): IngestResult {
  const res: IngestResult = { added: 0, updated: 0, skipped: 0, rejected: [] };
  if (!isObj(S.health)) S.health = {};
  const health = S.health as Record<string, Obj>;
  let nextId = Number(S.nextId) || 1;
  const id = () => nextId++;
  const money = isObj(S.money) ? S.money : null;
  const reject = (i: number, why: string) => { res.rejected.push({ i, why }); };

  items.forEach((raw, i) => {
    if (!isObj(raw)) return reject(i, 'not-an-object');
    switch (raw.type) {
      case 'social': {
        const ext = str(raw.ext), platform = str(raw.platform, 40), min = Math.round(num(raw.min));
        if (!ext || !platform || !okDate(raw.date) || !(min > 0)) return reject(i, 'bad-social');
        const rows = list(S, 'social'), old = rows.find(r => r.ext === ext), m = Math.min(720, min);
        if (old) { if (old.min === m) { res.skipped++; return; } old.min = m; delete old.demo; res.updated++; return; }
        const why = str(raw.why, 40);
        rows.push({ id: id(), date: raw.date, platform, min: m, ...(why ? { why } : {}), ext }); res.added++; return;
      }
      case 'activity': {
        const ext = str(raw.ext), kind = str(raw.kind, 40), start = num(raw.start), end = num(raw.end);
        if (!ext || !kind || !(end > start) || end - start > 16 * 36e5 || start < 1e12 || end > now + 36e5) return reject(i, 'bad-activity');
        const rows = list(S, 'activities'), old = rows.find(r => r.ext === ext);
        if (old) { if (old.start === start && old.end === end) { res.skipped++; return; } old.start = start; old.end = end; res.updated++; return; }
        rows.push({ id: id(), kind, title: str(raw.title) || kind, start, end, ext });
        rows.sort((a, b) => Number(a.start) - Number(b.start)); res.added++; return;
      }
      case 'tx': {
        const ext = str(raw.ext), amt = Math.round(num(raw.amt) * 100) / 100, dir = raw.dir;
        if (!money || !ext || !(dir === 'in' || dir === 'out') || !(amt > 0) || amt > 1e7 || !okDate(raw.date)) return reject(i, 'bad-tx');
        const rows = list(money, 'tx');
        if (rows.some(r => r.ext === ext)) { res.skipped++; return; }
        const note = str(raw.note), acc = raw.acc === 'ua' ? 'ua' : 'dk';
        rows.push({ id: id(), type: dir, amt, cat: str(raw.cat, 40) || guessCategory(note, dir), note, date: raw.date, acc, ext }); res.added++; return;
      }
      case 'health': {
        if (!okDate(raw.date)) return reject(i, 'bad-health');
        const h = health[raw.date] || (health[raw.date] = { water: 0, sleep: 0, mood: 0, steps: 0, workout: 0, weight: 0 });
        let changed = false;
        const put = (key: string, v: unknown, lo: number, hi: number, mode: 'empty' | 'max') => {
          const n = num(v); if (!(n >= lo && n <= hi)) return;
          const cur = Number(h[key]) || 0;
          if (mode === 'empty' ? cur === 0 : n > cur) { h[key] = n; delete h.demo; changed = true; }
        };
        // what the person typed by hand is never overwritten; counters (steps, movement, water) only grow
        put('sleep', raw.sleep, 0.5, 16, 'empty'); put('weight', raw.weight, 20, 350, 'empty');
        put('steps', raw.steps, 1, 80000, 'max'); put('workout', raw.workout, 1, 600, 'max'); put('water', raw.water, 1, 20, 'max');
        for (const key of ['bed', 'wake'] as const) { const v = raw[key]; if (typeof v === 'string' && CLOCK.test(v) && !h[key]) { h[key] = v; changed = true; } }
        if (typeof h.bed === 'string' && typeof h.wake === 'string' && !(Number(h.sleep) > 0) && raw.sleep === undefined) {
          // both times known and no hours yet: the length of the night
          const len = (toMin(h.wake) - toMin(h.bed) + 1440) % 1440 / 60;
          if (len >= 0.5 && len <= 16) { h.sleep = Math.round(len * 10) / 10; changed = true; }
        }
        if (changed) res.updated++; else res.skipped++;
        return;
      }
      default: return reject(i, 'unknown-type');
    }
  });

  S.nextId = nextId;
  if (res.added + res.updated > 0) S.ingest = { at: now, n: res.added + res.updated, source: str(source, 40) || 'auto' };
  return res;
}
