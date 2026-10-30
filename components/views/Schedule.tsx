'use client';

import { useRef, useState, type FormEvent } from 'react';
import type { UiEvent } from '@/lib/types';
import { useNow, useStore } from '@/lib/store';
import { addD, COLORS, DN, MON, MONTHN, pad2, plural, TK, toMin, WD, weekdayIdx, wStart, ymd } from '@/lib/util';
import { Icon } from '../Icon';
import { lanes } from '../shared';

/* ---------------- Schedule ---------------- */
type CalView = 'day' | 'week' | 'month';
const HOUR = 44;

export function Schedule() {
  const { S, A, eventsOn, cal, refreshCal, go, setSheet } = useStore();
  const now = useNow(30_000);
  const [mode, setMode] = useState<CalView>(() => (typeof window !== 'undefined' && window.innerWidth < 640 ? 'day' : 'week'));
  const [anchor, setAnchor] = useState(TK());
  const [v, setV] = useState({ title: '', date: TK(), s: '10:00', e: '11:00', c: 'c1' });
  const [err, setErr] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const today = TK(), at = new Date(anchor + 'T00:00');

  const days = mode === 'day' ? [anchor] : mode === 'week' ? [...Array(7)].map((_, i) => ymd(addD(wStart(at), i))) : [];
  const monthDays = (() => {
    if (mode !== 'month') return [];
    const first = new Date(at.getFullYear(), at.getMonth(), 1), ws = wStart(first);
    const last = new Date(at.getFullYear(), at.getMonth() + 1, 0);
    const n = Math.ceil((Math.round((last.getTime() - ws.getTime()) / 864e5) + 1) / 7) * 7;
    return [...Array(n)].map((_, i) => addD(ws, i));
  })();

  const evs = Object.fromEntries(days.map(d => [d, eventsOn(d)]));
  const timed = days.flatMap(d => evs[d].filter(e => !e.allDay));
  const h0 = Math.min(7, ...timed.map(e => Math.floor(toMin(e.s) / 60)));
  const h1 = Math.max(22, ...timed.map(e => Math.ceil(toMin(e.e) / 60)));
  const hours = [...Array(h1 - h0)].map((_, i) => h0 + i);
  const anyAllDay = days.some(d => evs[d].some(e => e.allDay));

  const shift = (dir: number) => {
    if (mode === 'month') setAnchor(ymd(new Date(at.getFullYear(), at.getMonth() + dir, 1)));
    else setAnchor(ymd(addD(at, dir * (mode === 'week' ? 7 : 1))));
  };
  const title = mode === 'month' ? `${MONTHN[at.getMonth()]} ${at.getFullYear()}`
    : mode === 'day' ? `${anchor === today ? 'Сьогодні, ' : WD[at.getDay()] + ', '}${at.getDate()} ${MON[at.getMonth()]}`
    : (() => { const a = new Date(days[0] + 'T00:00'), b = new Date(days[6] + 'T00:00'); return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MON[b.getMonth()]}` : `${a.getDate()} ${MON[a.getMonth()]} – ${b.getDate()} ${MON[b.getMonth()]}`; })();

  const pick = (date: string, hour?: number) => {
    const next = { ...v, date };
    if (hour !== undefined) { next.s = `${pad2(hour)}:00`; next.e = `${pad2(Math.min(hour + 1, 23))}:${hour + 1 > 23 ? '59' : '00'}`; }
    setV(next); setErr('');
    setTimeout(() => { titleRef.current?.focus(); titleRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 0);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (toMin(v.e) <= toMin(v.s)) { setErr('Кінець має бути пізніше за початок.'); return; }
    setErr('');
    if (A.addEvent({ ...v, title: v.title.trim() })) { setV({ ...v, title: '' }); setAnchor(v.date); }
  };
  const hasCal = S.icalUrls.length > 0 || cal.state === 'ok';
  const nowD = new Date(now), nowMin = nowD.getHours() * 60 + nowD.getMinutes();
  const evClass = (e: UiEvent) => `cev ${e.ext ? 'ext' : e.act !== undefined ? 'act' : e.c}`;
  const evTitle = (e: UiEvent) => `${e.title}${e.allDay ? '' : ` · ${e.s}–${e.e}`}${e.location ? ` · ${e.location}` : ''}${e.ext ? ' (календар)' : ''}`;
  const editBtn = (e: UiEvent) => !e.ext && e.act === undefined && e.localId !== undefined && <button className="cx" style={{ right: 22 }} aria-label={`Змінити ${e.title}`} title="Змінити" onClick={x => { x.stopPropagation(); setSheet({ kind: 'form', key: 'editEvent', init: { id: String(e.localId), title: e.title, date: e.date, s: e.s, e: e.e, c: e.c } }); }}>✎</button>;
  const delBtn = (e: UiEvent) => !e.ext && e.act !== 0 && <button className="cx" aria-label={`Видалити ${e.title}`} title="Видалити" onClick={x => { x.stopPropagation(); if (e.act) A.delActivity(e.act); else A.delEvent(e.localId!); }}><Icon n="x" /></button>;

  return (
    <section className="view">
      <div className="vh">
        <div><h2>Розклад</h2><p>Твій календар і підключені календарі. Натисни на вільний час, щоб додати подію.</p></div>
        <div className="row" style={{ marginLeft: 'auto' }}>
          <CalStatusChip />
          {hasCal ? <button className="btn ghost" onClick={refreshCal}><Icon n="refresh" />Оновити</button> : <button className="btn ghost" onClick={() => go('prefs')}><Icon n="link" />Підключити календар</button>}
        </div>
      </div>
      <div className="grid" style={{ marginTop: 18 }}>
        <div className="card cal-main">
          <div className="cal-bar">
            <div className="row" style={{ gap: 6 }}>
              <button className="btn ghost cal-nav" aria-label="Назад" onClick={() => shift(-1)}>‹</button>
              <button className="btn ghost cal-nav" aria-label="Вперед" onClick={() => shift(1)}>›</button>
              <button className="btn ghost" style={{ padding: '8px 14px' }} onClick={() => setAnchor(today)}>Сьогодні</button>
            </div>
            <h3 className="cal-title">{title}</h3>
            <div className="seg">
              {([['day', 'День'], ['week', 'Тиждень'], ['month', 'Місяць']] as const).map(([k, l]) => <button key={k} aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>)}
            </div>
          </div>

          {mode === 'month' ? (
            <div className="cal-month">
              {DN.map(d => <div key={d} className="cal-dn">{d}</div>)}
              {monthDays.map(d => {
                const k = ymd(d), list = eventsOn(k), out = d.getMonth() !== at.getMonth();
                return (
                  <button key={k} className={`cal-cell${out ? ' out' : ''}${k === today ? ' today' : ''}`} onClick={() => { setAnchor(k); setMode(window.innerWidth < 640 ? 'day' : 'week'); pick(k); }}>
                    <span className="n num">{d.getDate()}</span>
                    {list.slice(0, 3).map(e => <span key={e.id} className={evClass(e)} title={evTitle(e)}>{!e.allDay && <b className="num">{e.s}</b>}{e.title}</span>)}
                    {list.length > 3 && <span className="more">+{list.length - 3} ще</span>}
                    {list.length > 0 && <span className="dots">{list.slice(0, 4).map(e => <i key={e.id} className={e.ext ? 'ext' : e.c} />)}</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="cal-scroll">
              <div className="cal-week" style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(${mode === 'day' ? 0 : 92}px, 1fr))` }}>
                <div className="cal-corner" />
                {days.map(d => { const dt = new Date(d + 'T00:00'); return <button key={d} className={`cal-head${d === today ? ' today' : ''}`} onClick={() => { setAnchor(d); setMode('day'); }}><small>{DN[weekdayIdx(dt)]}</small><b className="num">{dt.getDate()}</b></button>; })}
                {anyAllDay && <>
                  <div className="cal-hl">весь день</div>
                  {days.map(d => <div key={d} className="cal-allday">{evs[d].filter(e => e.allDay).map(e => <span key={e.id} className={evClass(e)} title={evTitle(e)}>{e.title}</span>)}</div>)}
                </>}
                <div className="cal-hours">{hours.map(h => <div key={h} style={{ height: HOUR }}><span className="num">{pad2(h)}:00</span></div>)}</div>
                {days.map(d => (
                  <div key={d} className={`cal-col${d === today ? ' today' : ''}`} style={{ height: hours.length * HOUR }}>
                    {hours.map(h => <button key={h} className="cal-slot" style={{ top: (h - h0) * HOUR, height: HOUR }} aria-label={`Додати подію ${d} о ${pad2(h)}:00`} onClick={() => pick(d, h)} />)}
                    {lanes(evs[d].filter(e => !e.allDay)).map(({ e, lane, of }) => {
                      const s0 = toMin(e.s), e0 = Math.max(toMin(e.e), s0 + 20);
                      return (
                        <div key={e.id} className={evClass(e)} title={evTitle(e)}
                          style={{ top: (s0 / 60 - h0) * HOUR, height: Math.max(20, ((e0 - s0) / 60) * HOUR - 2), left: `calc(${(lane / of) * 100}% + 2px)`, width: `calc(${100 / of}% - 4px)` }}>
                          <b>{e.title}</b><small className="num">{e.s}–{e.e}{e.location ? ` · ${e.location}` : ''}</small>{editBtn(e)}{delBtn(e)}
                        </div>
                      );
                    })}
                    {d === today && nowMin >= h0 * 60 && nowMin <= h1 * 60 && <div className="cal-now" style={{ top: (nowMin / 60 - h0) * HOUR }} />}
                  </div>
                ))}
              </div>
            </div>
          )}
          {mode !== 'month' && days.every(d => !evs[d].length) && <p className="muted" style={{ margin: '12px 0 0', fontSize: 13 }}>{mode === 'day' ? 'Цього дня подій немає.' : 'Цього тижня подій немає.'} Натисни на годину в календарі, щоб додати.</p>}
        </div>

        <form className="card cal-side" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignSelf: 'start' }} onSubmit={submit}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Нова подія</h3>
          <label className="field" htmlFor="evTitle">Назва<input ref={titleRef} id="evTitle" required placeholder="Лекція, зустріч, спорт…" autoComplete="off" value={v.title} onChange={e => setV({ ...v, title: e.target.value })} /></label>
          <label className="field" htmlFor="evDate">Дата<input type="date" id="evDate" required value={v.date} onChange={e => setV({ ...v, date: e.target.value })} /></label>
          <div className="row">
            <label className="field" htmlFor="evStart" style={{ flex: 1 }}>Початок<input type="time" id="evStart" required value={v.s} onChange={e => setV({ ...v, s: e.target.value })} /></label>
            <label className="field" htmlFor="evEnd" style={{ flex: 1 }}>Кінець<input type="time" id="evEnd" required value={v.e} onChange={e => setV({ ...v, e: e.target.value })} /></label>
          </div>
          <label className="field" htmlFor="evColor">Колір<select id="evColor" value={v.c} onChange={e => setV({ ...v, c: e.target.value })}>{COLORS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          {err && <p className="muted" style={{ margin: 0, fontSize: 12, color: 'var(--m1)' }}>{err}</p>}
          <button className="btn acc" style={{ alignSelf: 'flex-start' }}>Додати подію</button>
          <p className="help">Події з підключених календарів показані бузковим. Їх змінюють у самому календарі, тут вони лише для перегляду. Свою подію можна видалити хрестиком.</p>
        </form>
      </div>
    </section>
  );
}

export function CalStatusChip() {
  const { cal, ext } = useStore();
  if (cal.state === 'idle' || cal.state === 'none') return null;
  const t = cal.at ? new Date(cal.at) : null;
  const label = cal.state === 'loading' ? 'Синхронізація…' : cal.state === 'error' ? 'Помилка календаря' : `${ext.length} ${plural(ext.length, 'подія', 'події', 'подій')} · ${t ? pad2(t.getHours()) + ':' + pad2(t.getMinutes()) : ''}`;
  return <span className={`calstat ${cal.state}`} title={cal.errors?.join('\n')}><i />{label}</span>;
}
