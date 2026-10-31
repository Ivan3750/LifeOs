'use client';

import { useRef, useState, type FormEvent } from 'react';
import { fill, logFocus, useStore } from '@/lib/store';
import { stripDemo } from '@/lib/seed';
import { DN, TK } from '@/lib/util';
import { dayPlan, sleepRhythm } from '@/lib/score';
import type { State, Theme } from '@/lib/types';
import { Icon } from '../Icon';
import { ExportCard } from '../ExportCard';
import { CalStatusChip } from './Schedule';
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
    <div className="card cardcol">
      <div className="ch" style={{ marginBottom: 0 }}>
        <Icon n="schedule" className="ic" />
        <div><h3>Мої календарі</h3><p>Події зʼявляються в розкладі, на головній і в «Далі: …». Оновлення кожні 10 хвилин.</p></div>
        <div className="row" style={{ marginLeft: 'auto' }}><CalStatusChip /><button className="sel" onClick={refreshCal}>Оновити</button></div>
      </div>
      <form className="row" onSubmit={add}>
        <label className="field" htmlFor="icalUrl" style={{ flex: '1 1 280px' }}>Секретне iCal-посилання (.ics)
          <input id="icalUrl" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" autoComplete="off" spellCheck={false} />
        </label>
        <button className="btn acc" style={{ alignSelf: 'flex-end' }}>Підключити</button>
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
        Посилання входить у твої дані: воно зберігається в цьому браузері і в базі (якщо вона підключена) і передається лише на твій сервер, який завантажує календар. Якщо не хочеш зберігати його в даних, пропиши його в <code>ICAL_URLS</code> на сервері.
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
    // the offline copy of the pages must not outlive the session
    await (typeof caches !== 'undefined' ? caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))) : Promise.resolve()).catch(() => {});
    location.reload();
  };
  return (
    <div className="card cardcol" style={{ height: '100%' }}>
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


function exportJson(S: State) {
  download(`lifeos-${TK()}.json`, 'application/json', JSON.stringify({ app: 'lifeos', exportedAt: new Date().toISOString(), data: S }, null, 2));
}

/** Reads a backup made by «Усі дані (JSON)» and returns the state in it, or a reason why it cannot be used. */
function parseBackup(text: string): { state: State } | { error: string } {
  let j: unknown;
  try { j = JSON.parse(text); } catch { return { error: 'Це не JSON-файл' }; }
  const data = (j as { app?: string; data?: unknown })?.app === 'pulse-os' || (j as { app?: string })?.app === 'lifeos' ? (j as { data: unknown }).data : j;
  const d = data as Partial<State> | null;
  if (!d || typeof d !== 'object' || Array.isArray(d) || !Array.isArray(d.tasks) || !Array.isArray(d.habits) || !d.money || !d.co) return { error: 'У файлі нема даних Pulse OS' };
  return { state: fill(d as State) };
}

/** Day start, end and breakfast follow the sleep you log, or fixed hours. */
function SleepDaySetting() {
  const { S, update } = useStore();
  const on = S.dayFromSleep !== false, r = sleepRhythm(S), p = dayPlan(S, TK());
  const fmt = (m: number | null) => (m == null ? '—' : `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  return (
    <div>
      <div className="fl">День за твоїм сном</div>
      <p className="help" style={{ marginBottom: 10 }}>
        {on
          ? <>Початок дня береться з часу, коли ти прокинувся сьогодні (або з типового), кінець — з типового часу засинання, а сніданок — через 30 хв після пробудження. Так вільні години відповідають твоєму реальному ритму.</>
          : <>Зараз день рахується за фіксованими годинами нижче.</>}
      </p>
      <div className="seg" style={{ marginBottom: 10 }}>
        <button aria-pressed={on} onClick={() => update(s => { s.dayFromSleep = true; })}>За сном</button>
        <button aria-pressed={!on} onClick={() => update(s => { s.dayFromSleep = false; })}>Фіксовано</button>
      </div>
      {on && (
        <p className="help">
          За останні 2 тижні ({r.nights} {r.nights === 1 ? 'ніч' : r.nights < 5 && r.nights > 1 ? 'ночі' : 'ночей'} зі сном): зазвичай прокидаєшся о <b>{fmt(r.wake)}</b>, засинаєш о <b>{fmt(r.bed)}</b>.
          {' '}Сьогодні день: <b>{p.start}–{p.end}</b>{p.wakeLogged ? ' (від записаного пробудження)' : ''}.
          {r.nights < 3 && ' Запиши сон ще кілька ночей у плитці «Сон», щоб ритм став точнішим.'}
          {r.bed != null && r.bed >= 24 * 60 && ' Кінець дня обрізається на півночі.'}
        </p>
      )}
    </div>
  );
}

export function Prefs() {
  const { S, A, update, toast } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const restore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const r = parseBackup(await f.text());
    if ('error' in r) { toast(r.error); return; }
    if (!window.confirm('Замінити всі поточні дані даними з файлу? Поточні дані буде втрачено (зроби експорт, якщо вони потрібні).')) return;
    update(s => { const keep = { view: s.view, mode: s.mode, theme: s.theme, log: s.log, unread: s.unread }; for (const k of Object.keys(s)) delete (s as unknown as Record<string, unknown>)[k]; Object.assign(s, r.state, keep); });
    toast('Дані відновлено з копії');
  };
  const THEMES: [Theme, string][] = [['system', 'Як у системі'], ['light', 'Світла'], ['dark', 'Темна']];
  return (
    <section className="view">
      <div className="vh"><div><h2>Налаштування</h2><p>Дані зберігаються в цьому браузері й, якщо налаштована база, синхронізуються між пристроями.</p></div></div>
      <div className="grid">
        <div className="card s6 cardcol">
          <div className="ch" style={{ margin: 0 }}><Icon n="user" className="ic" /><div><h3>Профіль</h3><p>Як до тебе звертатися й який вигляд має застосунок</p></div></div>
          <TextField id="pName" label="Імʼя" value={S.name} fallback="Друже" onSave={v => update(s => { s.name = v; })} />
          <div className="field">Тема
            <div className="seg themeseg" role="group" aria-label="Тема">
              {THEMES.map(([v, l]) => <button key={v} aria-pressed={S.theme === v} onClick={() => update(s => { s.theme = v; }, true)}>{l}</button>)}
            </div>
          </div>
        </div>

        <div className="card s6 cardcol">
          <div className="ch" style={{ margin: 0 }}><Icon n="money" className="ic" /><div><h3>Компанія</h3><p>Для режиму «Компанія»</p></div></div>
          <div className="fgrid">
            <TextField id="pCo" label="Назва" value={S.co.name} fallback="Моя компанія" onSave={v => update(s => { s.co.name = v; })} />
            <NumField id="pCoGoal" label="Ціль виручки на місяць, kr." value={S.co.goal} min={1000} max={100000000} onSave={n => update(s => { s.co.goal = n; })} />
          </div>
        </div>

        <div className="card s6 cardcol">
          <div className="ch" style={{ margin: 0 }}><Icon n="focus" className="ic" /><div><h3>Фокус</h3><p>Таймер і тижнева ціль</p></div></div>
          <div className="fgrid">
            <NumField id="pGoal" label="Ціль на тиждень, год" value={S.goal} min={1} max={80} onSave={n => update(s => { s.goal = n; })} />
            <NumField id="pFocus" label="Фокус, хв" value={S.focusMin} min={5} max={120} onSave={n => update(s => { if (!s.timer.running && s.timer.mode === 'focus') { logFocus(s); s.timer.sid = 0; s.timer.left = n * 60; } s.focusMin = n; })} />
            <NumField id="pBreak" label="Перерва, хв" value={S.breakMin} min={1} max={60} onSave={n => update(s => { s.breakMin = n; if (!s.timer.running && s.timer.mode === 'break') s.timer.left = n * 60; })} />
          </div>
          <div>
            <div className="fl">Робочі дні</div>
            <p className="help" style={{ marginBottom: 10 }}>Тижнева ціль ділиться між цими днями. У вихідні фокус в оцінці дня не очікується.</p>
            <div className="seg wdays">
              {DN.map((d, i) => (
                <button key={d} aria-pressed={!!S.workDays?.[i]} onClick={() => update(s => { const w = s.workDays ? [...s.workDays] : [true, true, true, true, true, false, false]; w[i] = !w[i]; s.workDays = w; })}>{d}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="card s6 cardcol">
          <div className="ch" style={{ margin: 0 }}><Icon n="health" className="ic" /><div><h3>Здоровʼя</h3><p>Денні цілі для плиток на сторінці «Здоровʼя»</p></div></div>
          <div className="fgrid">
            <NumField id="pWater" label="Вода, склянок (по 250 мл)" value={S.waterGoal || 8} min={1} max={20} onSave={n => update(s => { s.waterGoal = n; })} />
            <NumField id="pMove" label="Рух, хв на день" value={S.moveGoal || 30} min={5} max={300} onSave={n => update(s => { s.moveGoal = n; })} />
            <NumField id="pSteps" label="Кроки на день" value={S.stepsGoal || 8000} min={1000} max={50000} onSave={n => update(s => { s.stepsGoal = n; })} />
          </div>
          <div>
            <div className="fl">Режим сну</div>
            <p className="help" style={{ marginBottom: 10 }}>Сон у оцінці дня рахується не лише за довжиною, а й за тим, чи ти засинаєш і прокидаєшся вчасно. Засинання до 30 хв після цільового часу ще вважається добрим.</p>
            <div className="fgrid">
              <label className="field" htmlFor="pBed">Засинати о<input id="pBed" type="time" value={S.bedTarget} onChange={e => e.target.value && update(s => { s.bedTarget = e.target.value; })} /></label>
              <label className="field" htmlFor="pWake">Прокидатися о<input id="pWake" type="time" value={S.wakeTarget} onChange={e => e.target.value && update(s => { s.wakeTarget = e.target.value; })} /></label>
            </div>
          </div>
        </div>

        <div className="card s12 cardcol">
          <div className="ch" style={{ margin: 0 }}><Icon n="clock" className="ic" /><div><h3>День і їжа</h3><p>Від цього залежать вільні години й оцінка дня</p></div></div>
          <SleepDaySetting />
          <div className="fgrid">
            <label className="field" htmlFor="pDayStart">{S.dayFromSleep !== false ? 'Початок дня, якщо сну ще не записано' : 'Початок дня'}
              <input id="pDayStart" type="time" value={S.dayStart} onChange={e => e.target.value && update(s => { s.dayStart = e.target.value; })} />
            </label>
            <label className="field" htmlFor="pDayEnd">{S.dayFromSleep !== false ? 'Кінець дня, якщо сну ще не записано' : 'Кінець дня'}
              <input id="pDayEnd" type="time" value={S.dayEnd} onChange={e => e.target.value && update(s => { s.dayEnd = e.target.value; })} />
            </label>
          </div>
          <div>
            <div className="fl">Прийоми їжі</div>
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
        </div>

        <div className="s12"><CalendarSettings /></div>

        <div className="s12"><ExportCard /></div>

        <div className="card s6 cardcol">
          <div className="ch" style={{ margin: 0 }}><Icon n="copy" className="ic" /><div><h3>Резервна копія</h3><p>Повна копія всіх даних одним файлом: з неї можна відновити LifeOs на будь-якому пристрої</p></div></div>
          <div className="row">
            <button className="btn" onClick={() => { exportJson(S); toast('Копію даних завантажено'); }}>Завантажити копію (JSON)</button>
            <button className="btn ghost" onClick={() => fileRef.current?.click()}>Відновити з копії</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden aria-label="Файл резервної копії" onChange={restore} />
          </div>
          <div className="prefdemo">
            <p className="help" style={{ margin: '0 0 10px' }}>{S.demo ? 'Зараз у застосунку показані демонстраційні дані. Прибери їх, коли будеш готовий вести власні.' : 'Демонстраційних даних немає.'}</p>
            <button className="btn ghost" disabled={!S.demo} onClick={() => { update(stripDemo); toast('Демо-дані прибрано'); }}>Прибрати демо-дані</button>
          </div>
        </div>

        <div className="s6"><AccountSettings /></div>
      </div>
    </section>
  );
}
