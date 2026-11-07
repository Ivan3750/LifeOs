#!/usr/bin/env node
// LifeOs collector for a Raspberry Pi: gathers data on its own and sends it to your site (/api/ingest), so nothing has to be typed by hand.
// No dependencies, Node 20+. Run it every 30 minutes with the systemd timer from pi/README.md.
//
// Sources (switch each on in config.json):
//   activitywatch  time on sites and apps from ActivityWatch (https://activitywatch.net) -> «Соцмережі»
//   inbox          files dropped into a folder: bank CSV -> «Гроші»; JSON from a phone shortcut / Health Auto Export -> health, steps, sleep
// Sending the same data again is safe: every record has a stable id, so it updates instead of duplicating.

import { readFile, readdir, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const pad = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sha = s => createHash('sha1').update(s).digest('hex').slice(0, 16);

/* ---------- ActivityWatch ---------- */

export const DEFAULT_PLATFORMS = {
  YouTube: ['youtube\\.com', 'youtu\\.be', '^YouTube'],
  Instagram: ['instagram\\.com', 'Instagram'],
  TikTok: ['tiktok\\.com', 'TikTok'],
  Facebook: ['facebook\\.com', 'messenger\\.com'],
  'X / Twitter': ['twitter\\.com', '(^|\\.)x\\.com'],
  Reddit: ['reddit\\.com'],
  Telegram: ['web\\.telegram\\.org', 'Telegram'],
  Netflix: ['netflix\\.com'],
  Twitch: ['twitch\\.tv'],
};

/** Which platform an event (window title / app / url) belongs to, or null. rules: platform -> list of regular expressions. */
export function platformOf(data, rules = DEFAULT_PLATFORMS) {
  const text = [data.url, data.app, data.title].filter(Boolean).join(' ');
  for (const [name, list] of Object.entries(rules)) if (list.some(re => new RegExp(re, 'i').test(text))) return name;
  return null;
}

/** ActivityWatch events of one day -> social items (one per platform and day, minutes rounded). Events when the person was away are skipped. */
export function socialItems(eventsByBucket, date, rules, host = 'aw') {
  const sec = new Map();
  for (const events of eventsByBucket) for (const e of events) {
    if (!(e.duration > 0) || e.data?.status === 'afk') continue;
    const p = platformOf(e.data || {}, rules);
    if (p) sec.set(p, (sec.get(p) || 0) + e.duration);
  }
  return [...sec].map(([platform, s]) => ({ type: 'social', ext: `aw:${host}:${date}:${platform}`, date, platform, min: Math.round(s / 60) })).filter(x => x.min >= 1);
}

async function activitywatch(cfg, days = 2) {
  const base = cfg.url.replace(/\/$/, ''), host = cfg.name || 'aw', items = [];
  const buckets = await (await fetch(`${base}/api/0/buckets/`)).json();
  const ids = Object.keys(buckets).filter(id => /^aw-watcher-(window|web)/.test(id));
  for (let i = 0; i < days; i++) {
    const d0 = new Date(); d0.setHours(0, 0, 0, 0); d0.setDate(d0.getDate() - i);
    const d1 = new Date(d0); d1.setDate(d1.getDate() + 1);
    const lists = [];
    for (const id of ids) {
      const url = `${base}/api/0/buckets/${encodeURIComponent(id)}/events?start=${d0.toISOString()}&end=${d1.toISOString()}&limit=-1`;
      lists.push(await (await fetch(url)).json());
    }
    items.push(...socialItems(lists, ymd(d0), cfg.platforms || DEFAULT_PLATFORMS, host));
  }
  return items;
}

/* ---------- bank CSV ---------- */

/** Splits CSV text into rows. The delimiter (; or ,) is detected; quoted fields may contain it. */
export function parseCsv(text) {
  const first = text.split(/\r?\n/, 1)[0] || '', delim = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); if (row.some(x => x.trim())) rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  row.push(cur); if (row.some(x => x.trim())) rows.push(row);
  return rows;
}

/** «1.234,56», «-59.50», «59,5 kr» -> number, or NaN. */
export function parseAmount(s) {
  let t = String(s).replace(/[^\d,.\-+]/g, '');
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); else t = t.replace(/,/g, '');
  return t === '' ? NaN : Number(t);
}

/** «31-10-2026», «31.10.2026», «2026-10-31», «31/10/26» -> 'YYYY-MM-DD', or null. */
export function parseDate(s) {
  const t = String(s).trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  return null;
}

/** Bank CSV -> tx items. cfg: { date, amount, text } column names (or 0-based numbers), acc: 'dk' | 'ua'. Money going out is negative. */
export function bankItems(csv, cfg, file = '') {
  const rows = parseCsv(csv); if (rows.length < 2) return [];
  const head = rows[0].map(h => h.trim().toLowerCase());
  const col = v => (typeof v === 'number' ? v : head.indexOf(String(v).toLowerCase()));
  const [ci, ca, ct] = [col(cfg.date), col(cfg.amount), col(cfg.text)];
  if (ci < 0 || ca < 0) throw new Error(`У ${file || 'CSV'} нема колонок «${cfg.date}» або «${cfg.amount}». Є: ${head.join(', ')}`);
  const seen = new Map(), out = [];
  for (const r of rows.slice(1)) {
    const date = parseDate(r[ci] || ''), amt = parseAmount(r[ca] || ''), note = (ct >= 0 ? r[ct] || '' : '').trim().slice(0, 120);
    if (!date || !Number.isFinite(amt) || amt === 0) continue;
    // identical lines on one day (two coffees) get a counter so they stay two records
    const key = `${date}|${amt}|${note}`, n = (seen.get(key) || 0) + 1; seen.set(key, n);
    out.push({ type: 'tx', ext: `bank:${sha(key)}:${n}`, dir: amt < 0 ? 'out' : 'in', amt: Math.abs(amt), date, note, acc: cfg.acc === 'ua' ? 'ua' : 'dk' });
  }
  return out;
}

/* ---------- inbox folder ---------- */

async function inbox(cfg) {
  const dir = cfg.dir, done = join(dir, 'done');
  await mkdir(done, { recursive: true });
  const items = [], moved = [];
  for (const f of await readdir(dir)) {
    const p = join(dir, f), ext = extname(f).toLowerCase();
    if (ext === '.csv') {
      if (!cfg.bank) { console.warn(`${f}: у config.json нема inbox.bank, пропускаю`); continue; }
      items.push(...bankItems(await readFile(p, 'utf8'), cfg.bank, f)); moved.push([p, join(done, f)]);
    } else if (ext === '.json') {
      const data = JSON.parse(await readFile(p, 'utf8'));
      items.push(...(Array.isArray(data) ? data : data.items || [])); moved.push([p, join(done, f)]);
    }
  }
  return { items, finish: async () => { for (const [a, b] of moved) await rename(a, b); } };
}

/* ---------- sending ---------- */

async function send(cfg, items) {
  let sent = { added: 0, updated: 0, skipped: 0, rejected: [] };
  for (let i = 0; i < items.length; i += 400) {
    const res = await fetch(cfg.site.replace(/\/$/, '') + '/api/ingest', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ source: cfg.name || 'pi', items: items.slice(i, i + 400) }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Сайт відповів ${res.status}: ${body.message || body.error || 'помилка'}`);
    sent = { added: sent.added + body.added, updated: sent.updated + body.updated, skipped: sent.skipped + body.skipped, rejected: [...sent.rejected, ...(body.rejected || [])] };
  }
  return sent;
}

async function main() {
  const path = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), 'config.json');
  const cfg = JSON.parse(await readFile(path, 'utf8'));
  if (!cfg.site || !cfg.token) throw new Error('У config.json потрібні site і token');
  const items = []; let finish = async () => {};
  const failed = [];
  if (cfg.activitywatch?.enabled) { try { items.push(...await activitywatch({ name: cfg.name, ...cfg.activitywatch })); } catch (e) { failed.push('ActivityWatch: ' + e.message); } }
  if (cfg.inbox?.enabled) { try { const r = await inbox(cfg.inbox); items.push(...r.items); finish = r.finish; } catch (e) { failed.push('inbox: ' + e.message); } }
  if (items.length) {
    const r = await send(cfg, items);
    await finish(); // files leave the inbox only after the site has accepted them
    console.log(`${new Date().toISOString()} надіслано ${items.length}: нових ${r.added}, оновлено ${r.updated}, без змін ${r.skipped}${r.rejected.length ? `, відхилено ${r.rejected.length}` : ''}`);
  } else console.log(`${new Date().toISOString()} нових даних нема`);
  if (failed.length) { console.error(failed.join('\n')); process.exitCode = 1; }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch(e => { console.error(e.message); process.exit(1); });
