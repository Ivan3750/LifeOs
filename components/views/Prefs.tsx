'use client';

import { useState, type FormEvent } from 'react';
import { logFocus, useStore } from '@/lib/store';
import { stripDemo } from '@/lib/seed';
import { TK } from '@/lib/util';
import type { State, Theme } from '@/lib/types';
import { Icon } from '../Icon';
import { CalStatusChip } from './Personal';
import { SYNC_TEXT } from '../Shell';

/** Hides the secret part of a calendar address so it can be shown on screen. */
const maskUrl = (u: string) => {
  try { const x = new URL(u.replace(/^webcal:/i, 'https:')); return `${x.host}/…${x.pathname.slice(-12)}`; } catch { return u.slice(0, 24) + '…'; }
};

function NumField({ id, label, value, min, max, onSave }: { id: string; label: string; value: number; min: number; max: number; onSave: (n: number) => void }) {
  const [v, setV] = useState(String(value));
  return (
    <label className="field" htmlFor={id}>{label}
      <input id={id} type="number" min={min} max={max} value={v} onChange={e => setV(e.target.value)} onBlur={() => { const n = Math.max(min, Math.min(max, +v || value)); setV(String(n)); onSave(n); }} />
    </label>
  );
}

function TextField({ id, label, value, fallback, onSave }: { id: string; label: string; value: string; fallback: string; onSave: (s: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <label className="field" htmlFor={id}>{label}
      <input id={id} autoComplete="off" value={v} onChange={e => setV(e.target.value)} onBlur={() => onSave(v.trim() || fallback)} />
    </label>
  );
}

function CalendarSettings() {
  const { S, update, cal, refreshCal, toast } = useStore();
  const [url, setUrl] = useState('');
  const add = (e: FormEvent) => {
    e.preventDefault();
    const u = url.trim().replace(/^webcal:/i, 'https:');
    if (!/^https:\/\/\S+$/i.test(u)) { toast('Встав посилання, що починається з https:// або webcal://'); return; }
    if (S.icalUrls.includes(u)) { toast('Цей календар уже підключено'); return; }
    update(s => { s.icalUrls.push(u); });
    setUrl('');
    toast('Календар підключено. Синхронізую…');
  };
  return (
    <div className="card" style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="ch" style={{ marginBottom: 0 }}>
        <Icon n="schedule" className="ic" />
        <div><h3>Мої календарі</h3><p>Події зʼявляються в розкладі, на головній і в «Далі: …». Оновлення кожні 10 хвилин.</p></div>
        <div className="row" style={{ marginLeft: 'auto' }}><CalStatusChip /><button className="sel" onClick={refreshCal}>Оновити</button></div>
      </div>
      <form className="row" onSubmit={add}>
        <label className="field" htmlFor="icalUrl" style={{ flex: '1 1 280px' }}>Секретне iCal-посилання (.ics)
          <input id="icalUrl" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" autoComplete="off" spellCheck={false} />
        </label>
        <button className="btn" style={{ alignSelf: 'flex-end' }}>Підключити</button>
      </form>
      <div>
        {S.icalUrls.map(u => (
          <div className="urlrow" key={u}>
            <Icon n="link" /><code title="Адресу приховано, бо вона дає доступ до календаря">{maskUrl(u)}</code>
            <button className="sqb" onClick={() => update(s => { s.icalUrls = s.icalUrls.filter(x => x !== u); })}>Відключити</button>
          </div>
        ))}
        {!S.icalUrls.length && cal.state !== 'ok' && <p className="muted" style={{ margin: 0, fontSize: 13 }}>Ще жодного календаря. Можна також прописати посилання в файлі <code>.env.local</code> як <code>ICAL_URLS</code>.</p>}
        {!S.icalUrls.length && cal.state === 'ok' && <p className="muted" style={{ margin: 0, fontSize: 13 }}>Календарі підключено через <code>ICAL_URLS</code> у <code>.env.local</code>.</p>}
      </div>
      {!!cal.errors?.length && <div className="help" style={{ color: 'var(--m1)' }}>{cal.errors.map(e => <div key={e}>{e}</div>)}</div>}
      <div className="help">
        <b>Google Calendar:</b> calendar.google.com → ⚙ Налаштування → обери свій календар → «Інтеграція календаря» → «Секретна адреса у форматі iCal».<br />
        <b>Outlook:</b> outlook.com → ⚙ Налаштування → Календар → «Спільні календарі» → «Опублікувати календар» → посилання ICS.<br />
        <b>iCloud:</b> застосунок Календар → «Поділитися календарем» → «Публічний календар» → скопіюй посилання webcal://.<br />
        Посилання зберігається лише в цьому браузері і йде тільки на твій сервер Next.js, який завантажує календар.
      </div>
    </div>
  );
}

function AccountSettings() {
  const { sync, flush, dbOn } = useStore();
  const [busy, setBusy] = useState(false);
  const t = sync.at ? new Date(sync.at) : null;
  const logout = async () => {
    setBusy(true);
    await flush().catch(() => {});
    await fetch('/api/login', { method: 'DELETE' }).catch(() => {});
    location.reload();
  };
  return (
    <div className="card" style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="ch" style={{ marginBottom: 0 }}>
        <Icon n="refresh" className="ic" />
        <div>
          <h3>Синхронізація</h3>
          <p>{dbOn ? 'Дані зберігаються в базі MySQL і однакові на всіх пристроях, де ти увійшов.' : 'База даних не налаштована, тому дані живуть лише в цьому браузері. Заповни DB_* або DATABASE_URL у .env.'}</p>
        </div>
      </div>
      <div className="row">
        <span className={`calstat ${sync.state === 'ok' ? 'ok' : sync.state === 'syncing' ? 'loading' : sync.state === 'error' ? 'error' : ''}`}><i />{SYNC_TEXT[sync.state]}{t && sync.state === 'ok' ? ` о ${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}` : ''}</span>
        {dbOn && <button className="sel" onClick={() => flush()}>Синхронізувати зараз</button>}
        <button className="btn ghost" style={{ marginLeft: 'auto' }} disabled={busy} onClick={logout}>{busy ? 'Виходжу…' : 'Вийти'}</button>
      </div>
      {sync.state === 'error' && sync.msg && <p className="help" style={{ color: 'var(--m1)' }}>{sync.msg}</p>}
    </div>
  );
}

function download(name: string, type: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvCell = (v: string | number) => (/[",;\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const csv = (rows: (string | number)[][]) => '\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n'); // BOM so Excel reads Cyrillic

function exportJson(S: State) {
  download(`pulse-os-${TK()}.json`, 'application/json', JSON.stringify({ app: 'pulse-os', exportedAt: new Date().toISOString(), data: S }, null, 2));
}

function exportMoney(S: State) {
  const rows = [...S.money.tx].sort((a, b) => a.date.localeCompare(b.date))
    .map(t => [t.date, t.type === 'in' ? 'Дохід' : 'Витрата', t.cat, t.type === 'in' ? t.amt : -t.amt, t.note]);
  download(`pulse-os-finansy-${TK()}.csv`, 'text/csv;charset=utf-8', csv([['Дата', 'Тип', 'Категорія', 'Сума, kr.', 'Нотатка'], ...rows]));
}

function exportFocus(S: State) {
  const rows = [...S.sessions].sort((a, b) => a.t - b.t).map(x => { const d = new Date(x.t); return [d.toLocaleDateString('sv-SE'), d.toTimeString().slice(0, 5), x.m]; });
  download(`pulse-os-fokus-${TK()}.csv`, 'text/csv;charset=utf-8', csv([['Дата', 'Початок', 'Хвилин'], ...rows]));
}

export function Prefs() {
  const { S, A, update, toast } = useStore();
  return (
    <section className="view">
      <div className="vh"><div><h2>Налаштування</h2><p>Дані зберігаються лише в цьому браузері.</p></div></div>
      <div className="card" style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="kv">
          <TextField id="pName" label="Імʼя" value={S.name} fallback="Друже" onSave={v => update(s => { s.name = v; })} />
          <NumField id="pGoal" label="Ціль фокусу на тиждень, год" value={S.goal} min={1} max={80} onSave={n => update(s => { s.goal = n; })} />
          <NumField id="pFocus" label="Тривалість фокусу, хв" value={S.focusMin} min={5} max={120} onSave={n => update(s => { if (!s.timer.running && s.timer.mode === 'focus') { logFocus(s); s.timer.sid = 0; s.timer.left = n * 60; } s.focusMin = n; })} />
          <NumField id="pBreak" label="Тривалість перерви, хв" value={S.breakMin} min={1} max={60} onSave={n => update(s => { s.breakMin = n; if (!s.timer.running && s.timer.mode === 'break') s.timer.left = n * 60; })} />
          <TextField id="pCo" label="Назва компанії" value={S.co.name} fallback="Моя компанія" onSave={v => update(s => { s.co.name = v; })} />
          <NumField id="pCoGoal" label="Ціль виручки на місяць, kr." value={S.co.goal} min={1000} max={100000000} onSave={n => update(s => { s.co.goal = n; })} />
          <label className="field" htmlFor="pDayStart">Початок дня (для вільного часу)
            <input id="pDayStart" type="time" value={S.dayStart} onChange={e => e.target.value && update(s => { s.dayStart = e.target.value; })} />
          </label>
          <label className="field" htmlFor="pDayEnd">Кінець дня
            <input id="pDayEnd" type="time" value={S.dayEnd} onChange={e => e.target.value && update(s => { s.dayEnd = e.target.value; })} />
          </label>
          <label className="field" htmlFor="pTheme">Тема
            <select id="pTheme" value={S.theme} onChange={e => update(s => { s.theme = e.target.value as Theme; })}>
              <option value="system">Як у системі</option><option value="light">Світла</option><option value="dark">Темна</option>
            </select>
          </label>
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>Прийоми їжі</div>
          <p className="help" style={{ marginBottom: 10 }}>Цей час віднімається від вільних годин так само, як події з календаря, і показується на календарі на головній.</p>
          <div className="meals">
            {S.meals.map(m => (
              <div className="mealrow" key={m.key}>
                <label className="mealon"><input type="checkbox" checked={m.on} onChange={e => A.setMeal(m.key, { on: e.target.checked })} />{m.label}</label>
                <input type="time" aria-label={`${m.label}: початок`} value={m.s} disabled={!m.on} onChange={e => e.target.value && A.setMeal(m.key, { s: e.target.value })} />
                <span className="muted">–</span>
                <input type="time" aria-label={`${m.label}: кінець`} value={m.e} disabled={!m.on} onChange={e => e.target.value && A.setMeal(m.key, { e: e.target.value })} />
              </div>
            ))}
          </div>
        </div>
        <div className="row">
          <button className="btn ghost" disabled={!S.demo} onClick={() => { update(stripDemo); toast('Демо-дані прибрано'); }}>Прибрати демо-дані</button>
        </div>
      </div>
      <div className="card" style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><h3 style={{ margin: 0, fontSize: 16 }}>Експорт даних</h3><p className="help" style={{ margin: '4px 0 0' }}>Повна копія всіх даних у JSON або окремі таблиці для Excel і Google Sheets.</p></div>
        <div className="row">
          <button className="btn" onClick={() => { exportJson(S); toast('Копію даних завантажено'); }}>Усі дані (JSON)</button>
          <button className="btn ghost" onClick={() => exportMoney(S)}>Фінанси (CSV)</button>
          <button className="btn ghost" onClick={() => exportFocus(S)}>Сесії фокусу (CSV)</button>
        </div>
      </div>
      <AccountSettings />
      <CalendarSettings />
    </section>
  );
}
