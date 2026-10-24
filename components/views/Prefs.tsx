'use client';

import { useState, type FormEvent } from 'react';
import { logFocus, useStore } from '@/lib/store';
import { makeState, stripDemo } from '@/lib/seed';
import type { Theme } from '@/lib/types';
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

export function Prefs() {
  const { S, update, toast } = useStore();
  const [armed, setArmed] = useState(false);
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
          <label className="field" htmlFor="pTheme">Тема
            <select id="pTheme" value={S.theme} onChange={e => update(s => { s.theme = e.target.value as Theme; })}>
              <option value="system">Як у системі</option><option value="light">Світла</option><option value="dark">Темна</option>
            </select>
          </label>
        </div>
        <div className="row">
          <button className="btn ghost" disabled={!S.demo} onClick={() => { update(stripDemo); toast('Демо-дані прибрано'); }}>Прибрати демо-дані</button>
          <button className="btn ghost" onClick={() => {
            if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3000); return; }
            update(s => { const f = makeState(false); f.co.name = s.co.name; f.co.goal = s.co.goal; f.icalUrls = s.icalUrls; f.mode = s.mode; f.name = s.name; f.theme = s.theme; Object.assign(s, f); });
            setArmed(false); toast('Усе очищено');
          }}>{armed ? 'Точно? Натисни ще раз' : 'Почати з нуля'}</button>
        </div>
      </div>
      <AccountSettings />
      <CalendarSettings />
    </section>
  );
}
