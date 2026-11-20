'use client';

import { useEffect, useRef, useState } from 'react';
import { liveSessions, useNow, useStore } from '@/lib/store';
import { dayPlan, freeTime, lastDays } from '@/lib/score';
import { addD, DAY, DN, hhmm, hmPlain, MON, MONTHN, money, pad2, pctW, plural, sod, toMin, TK, WD, weekdayIdx, wStart, ymd } from '@/lib/util';
import { Icon, type IconName } from '../Icon';
import { AdviceCard } from '../Advice';
import { AffirmationsCard } from '../Affirmations';
import { sinceWord, WeekReviewPrompt } from '../needs';
import { weekSteps } from '@/lib/momentum';
import { FocusArea, Rhythm } from '../charts';
import { account, balance, budgetDKK, CUR_SIGN, fmtCur } from '@/lib/money';
import { bestStreak, streakDays, streakHours } from '@/lib/quit';
import { CatBars, lanes, LifeTiles, monthTx, sumT, weekMinutes } from '../shared';
import { energyToday, homeOn, MODES, modeOf, moduleOn, seasonEnded, seasonOn, todayPicks } from '@/lib/life';
import { daysSince, suggestPerson } from '@/lib/people';
import { ModeChips, RestCard, SeasonCard, WelcomeBack } from '../Life';


function greet(name: string) {
  const h = new Date().getHours();
  return (h < 5 ? 'Доброї ночі' : h < 12 ? 'Доброго ранку' : h < 18 ? 'Доброго дня' : 'Доброго вечора') + ', ' + name;
}

function NextEvent() {
  const { eventsOn } = useStore();
  const now = useNow(30_000);
  const n = new Date(now), m = n.getHours() * 60 + n.getMinutes();
  const ev = eventsOn(TK()).filter(e => !e.allDay && toMin(e.e) > m)[0];
  if (!ev) return null;
  const dm = toMin(ev.s) - m;
  return (
    <div className="nextev"><span className="dot" />{dm <= 0 ? 'Зараз' : 'Далі'}: {ev.title} · {ev.s}
      {dm > 0 && ` (через ${dm >= 60 ? Math.floor(dm / 60) + ' год ' + (dm % 60) + ' хв' : dm + ' хв'})`}
    </div>
  );
}


const DV_HOUR = 38; // px per hour in the home day view

/** Home calendar: week strip, a scrollable day timeline with meals, and tap-to-add. */
export function SchedCard() {
  const { S, A, eventsOn, setSheet, go } = useStore();
  const now = useNow(30_000);
  const [day, setDay] = useState(TK);
  const [open, setOpen] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const dt = new Date(day + 'T00:00'), today = TK(), isToday = day === today;
  const week = [...Array(7)].map((_, i) => ymd(addD(wStart(dt), i)));
  const all = eventsOn(day), allDay = all.filter(e => e.allDay), timed = all.filter(e => !e.allDay);
  const plan = dayPlan(S, day), meals = plan.meals;
  const h0 = Math.min(Math.floor(toMin(plan.start) / 60), ...timed.map(e => Math.floor(toMin(e.s) / 60)));
  const h1 = Math.max(Math.ceil(toMin(plan.end) / 60), ...timed.map(e => Math.ceil(toMin(e.e) / 60)));
  const y = (min: number) => ((min - h0 * 60) / 60) * DV_HOUR;
  const n = new Date(now), nowMin = n.getHours() * 60 + n.getMinutes();
  const ft = freeTime(S, day, all, S.sessions, now);
  const sel = all.find(e => e.id === open);

  // open each day at "now" (today) or at its first event
  useEffect(() => {
    const el = scroller.current; if (!el) return;
    const first = timed[0] ? toMin(timed[0].s) : toMin(plan.start);
    el.scrollTop = Math.max(0, y(isToday ? nowMin : first) - 50);
  }, [day]); // eslint-disable-line react-hooks/exhaustive-deps

  const addAt = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    const h = Math.min(23, Math.max(0, Math.floor(h0 + (e.clientY - r.top) / DV_HOUR)));
    setSheet({ kind: 'form', key: 'event', init: { date: day, s: `${pad2(h)}:00`, e: h < 23 ? `${pad2(h + 1)}:00` : '23:59' } });
  };
  const goDay = (k: string) => { setDay(k); setOpen(null); };

  return (
    <div className="sched s4 sched-wrap">
      <div className="hd">
        <b>{isToday ? 'Сьогодні' : WD[dt.getDay()]}, {dt.getDate()} {MON[dt.getMonth()]}</b>
        {!isToday && <button className="chip" onClick={() => goDay(today)}>Сьогодні</button>}
        <button className="rnd" aria-label="Попередній день" onClick={() => goDay(ymd(addD(dt, -1)))}><Icon n="left" /></button>
        <button className="rnd" aria-label="Наступний день" onClick={() => goDay(ymd(addD(dt, 1)))}><Icon n="right" /></button>
        <button className="rnd add" aria-label="Додати подію" onClick={() => setSheet({ kind: 'form', key: 'event', init: { date: day } })}><Icon n="plus" /></button>
      </div>
      <div className="wkstrip">
        {week.map((k, i) => {
          const c = eventsOn(k).length, d = new Date(k + 'T00:00');
          return (
            <button key={k} aria-pressed={k === day} className={k === today ? 'today' : ''} onClick={() => goDay(k)} aria-label={`${WD[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}: ${c} ${plural(c, 'подія', 'події', 'подій')}`}>
              <span>{DN[i]}</span><b className="num">{d.getDate()}</b><i>{[...Array(Math.min(3, c))].map((_, j) => <em key={j} />)}</i>
            </button>
          );
        })}
      </div>
      {allDay.length > 0 && <div className="allday">{allDay.map(e => <span key={e.id} title={e.title}>{e.title}</span>)}</div>}
      <div className="dv" ref={scroller}>
        <div className="dv-in" style={{ height: (h1 - h0) * DV_HOUR }} onClick={addAt} title="Натисни на вільний час, щоб додати подію">
          {[...Array(h1 - h0 + 1)].map((_, i) => <div key={i} className="dv-h" style={{ top: i * DV_HOUR }}><span>{pad2((h0 + i) % 24)}:00</span></div>)}
          {meals.map(m => { const a = y(toMin(m.s)), b = y(toMin(m.e)); return b > a && <div key={m.key} className="dv-meal" style={{ top: a, height: Math.max(12, b - a) }}>{m.label}</div>; })}
          {lanes(timed).map(({ e, lane, of }) => {
            const s0 = toMin(e.s), e0 = Math.max(toMin(e.e), s0 + 20);
            return (
              <button key={e.id} className={`dv-ev ${e.ext ? 'ext' : e.c}`} aria-pressed={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)}
                style={{ top: y(s0) + 1, height: Math.max(20, y(e0) - y(s0) - 2), left: `calc(46px + (100% - 50px) * ${lane / of})`, width: `calc((100% - 50px) / ${of} - 3px)` }}>
                <b>{e.title}</b><small className="num">{e.s}–{e.e}</small>
              </button>
            );
          })}
          {isToday && nowMin >= h0 * 60 && nowMin <= h1 * 60 && <div className="dv-now" style={{ top: y(nowMin) }} />}
        </div>
      </div>
      {sel ? (
        <div className="dv-pop">
          <div style={{ minWidth: 0 }}>
            <b>{sel.title}</b>
            <small>{sel.allDay ? 'Весь день' : `${sel.s}–${sel.e}`}{sel.location ? ` · ${sel.location}` : ''} · {sel.ext ? 'з календаря' : sel.nap !== undefined ? 'денний сон' : 'моя подія'}</small>
          </div>
          {!sel.ext && sel.localId !== undefined && <button className="chip" onClick={() => { setSheet({ kind: 'form', key: 'editEvent', init: { id: String(sel.localId), title: sel.title, date: sel.date, s: sel.s, e: sel.e, c: sel.c } }); setOpen(null); }}>Змінити</button>}
          {!sel.ext && sel.localId !== undefined && <button className="chip" onClick={() => { A.delEvent(sel.localId!); setOpen(null); }}>Видалити</button>}
          {sel.nap !== undefined && <button className="chip" onClick={() => { A.delNap(sel.nap!, sel.date); setOpen(null); }}>Видалити</button>}
          {sel.ext && sel.extId && <button className="chip" title="Лише на цьому сайті: у самому календарі подія лишиться" onClick={() => { A.hideExt(sel.extId!); setOpen(null); }}>{sel.repeats ? 'Сховати цю' : 'Сховати тут'}</button>}
          {sel.ext && sel.series && sel.repeats && <button className="chip" title="Усі повтори цієї події, лише на цьому сайті" onClick={() => { A.hideExt(sel.series!, true); setOpen(null); }}>Сховати всі</button>}
          <button className="rnd" aria-label="Закрити" onClick={() => setOpen(null)}><Icon n="x" /></button>
        </div>
      ) : (
        <div className="dv-foot">
          <span>{timed.length ? `${timed.length} ${plural(timed.length, 'подія', 'події', 'подій')}` : 'Подій немає'} · вільно {hrs(ft.freeDay)} год</span>
          <button onClick={() => go('schedule')}>Весь розклад</button>
        </div>
      )}
    </div>
  );
}

function HeatMap() {
  const { S } = useStore();
  const now = useNow(30_000);
  const ws = wStart().getTime(), grid = [...Array(5)].map(() => Array(28).fill(0) as number[]), n = new Date(now), ti = weekdayIdx(n);
  S.sessions.forEach(s => {
    const i = Math.floor((sod(s.t).getTime() - ws) / DAY); if (i < 0 || i > 6) return;
    let h = new Date(s.t).getHours(); h = (h + 24 - 6) % 24; if (h >= 20) return;
    grid[Math.floor(h / 4)][i * 4 + (h % 4)] += s.m;
  });
  const nh = (n.getHours() + 24 - 6) % 24;
  return (
    <div className="fmap">
      <div className="ylab"><span>06:00</span><span>10:00</span><span>14:00</span><span>18:00</span><span>22:00</span></div>
      <div>
        <div className="fdots">
          {grid.map((row, r) => row.map((mm, c) => {
            const l = mm >= 45 ? 3 : mm >= 25 ? 2 : mm > 0 ? 1 : 0;
            const isNow = nh < 20 && Math.floor(nh / 4) === r && c === ti * 4 + (nh % 4);
            return <i key={r + '-' + c} className={`${l ? 'l' + l : ''}${isNow ? ' nowcell' : ''}`} title={`${DN[Math.floor(c / 4)]}, ${String((6 + r * 4 + (c % 4)) % 24).padStart(2, '0')}:00 · ${mm} хв`} />;
          }))}
        </div>
        <div className="xlab">{DN.map((d, i) => <span key={d} className={i === ti ? 'today' : ''}>{d}</span>)}</div>
      </div>
      <div className="fleg"><span><i style={{ background: 'var(--accent)' }} />Висока</span><span><i style={{ background: 'var(--accent-2)' }} />Середня</span><span><i style={{ background: 'var(--bar)' }} />Низька</span></div>
    </div>
  );
}

const hrs = (m: number) => { const h = m / 60; return h >= 10 || Number.isInteger(Math.round(h * 10) / 10) ? String(Math.round(h * 10) / 10) : (Math.round(h * 10) / 10).toFixed(1); };

/** Focus time against the free time left by the calendar, e.g. 5/7 hours. */
function FreeTimeCard() {
  const { S, scoreOn, go } = useStore();
  const now = useNow(30_000);
  const k = TK();
  const t = scoreOn(k, now).ft;
  const pct = t.free ? Math.round((t.worked / t.free) * 100) : 0;
  const evBlock = t.blockers.filter(b => !b.meal), mealBlock = t.blockers.filter(b => b.meal);
  const week = lastDays(7).map(d => ({ d, ...scoreOn(d, now).ft }));
  const maxFree = Math.max(60, ...week.map(w => w.free));
  return (
    <div className="card s5 fillcard">
      <div className="ch"><Icon n="clock" className="ic" /><div><h3>Вільний час і робота</h3><p>Скільки з годин, вільних від подій і їжі, ти працював</p></div><button className="sel" onClick={() => go('prefs')}>День {hhmm(new Date(t.start))}–{hhmm(new Date(t.fullEnd))}</button></div>
      <div className="bigstat"><span className="v num">{hrs(t.worked)}<small>/</small>{hrs(t.free)}<small>год</small></span><span className={`delta ${pct >= 60 ? 'up' : 'dn'}`}>{pct}%</span></div>
      <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
        День {hhmm(new Date(t.start))}–{hhmm(new Date(t.fullEnd))}{(() => { const p = dayPlan(S, k); return p.wakeLogged ? ' (від часу, коли прокинувся)' : p.fromSleep && p.rhythm?.wake != null ? ' (за твоїм типовим сном)' : ''; })()}.{' '}
        {t.blockers.length > 0 && <>Події та їжа забирають {hrs(t.busyDay)} год.{' '}</>}
        {evBlock.length ? <>Події: {evBlock.map(b => `${b.title} ${b.s}–${b.e}`).join(', ')}. </> : 'Подій у календарі на цей час немає. '}
        {mealBlock.length > 0 && <>Їжа: {mealBlock.map(b => `${b.title.toLowerCase()} ${b.s}–${b.e}`).join(', ')}.</>}
        {t.windows.length > 0 && <> Вільні вікна: {t.windows.map(([a, b]) => `${hhmm(new Date(a))}–${hhmm(new Date(b))}`).join(', ')}.</>}
      </div>
      <div className="freeweek">
        {week.map(w => {
          const dt = new Date(w.d + 'T00:00');
          return (
            <div key={w.d} className={`fw${w.d === k ? ' today' : ''}`} title={`${hrs(w.worked)} з ${hrs(w.free)} год вільного часу`}>
              <span>{DN[weekdayIdx(dt)]}</span>
              <div className="trk"><i className="free" style={{ width: (w.free / maxFree) * 100 + '%' }} /><i className="work" style={{ width: (Math.min(w.worked, Math.max(w.free, w.worked)) / maxFree) * 100 + '%' }} /></div>
              <b className="num">{hrs(w.worked)}/{hrs(w.free)}</b>
            </div>
          );
        })}
      </div>
    </div>
  );
}


/** The last seven days in numbers, upwards only: steps, the fullest day, the days with something done, focus. */
function WeekSummary({ worked }: { worked: (k: string) => number }) {
  const { S } = useStore();
  const k = TK(), w = weekSteps(S, k, worked);
  const total = w.reduce((a, x) => a + x.n, 0), best = w.reduce((a, x) => (x.n > a.n ? x : a)), active = w.filter(x => x.n > 0).length;
  const focus = w.reduce((a, x) => a + worked(x.k), 0);
  const dl = (d: string) => { const x = new Date(d + 'T00:00'); return `${DN[weekdayIdx(x)]} ${x.getDate()}`; };
  const tiles: [string, string, string][] = [
    ['Кроки за 7 днів', String(total), total ? 'усе, що зроблено' : 'ще попереду'],
    ['Найповніший день', best.n ? String(best.n) : '—', best.n ? dl(best.k) : ''],
    ['Днів зі кроками', `${active} з 7`, active ? 'кожен із них рахується' : 'почни з одного кроку'],
    ['Фокус за 7 днів', `${Math.floor(focus / 60)}г ${Math.round(focus % 60)}хв`, ''],
  ];
  return (
    <div className="card s12">
      <div className="ch"><Icon n="trend" className="ic" /><div><h3>Тиждень у цифрах</h3><p>Останні 7 днів. Тільки те, що зроблено</p></div></div>
      <div className="statgrid">{tiles.map(([l, v, sub]) => <div key={l}><span>{l}</span><b className="num">{v}</b><span style={{ marginTop: 2 }}>{sub}</span></div>)}</div>
    </div>
  );
}

/** Habits to quit on the home page: the streaks and the SOS button. */
function QuitMini() {
  const { S, go, setSheet } = useStore();
  const now = useNow(60_000);
  return (
    <div className="card s12 quitmini">
      <div className="ch" style={{ margin: 0 }}><Icon n="flame" className="ic" /><div><h3>Без шкідливих звичок</h3><p>{S.badHabits.length ? 'Дні без зривів. Зрив перезапускає серію, але рекорд лишається' : 'Додай звичку, від якої хочеш відмовитись'}</p></div></div>
      <div className="qmini">
        {S.badHabits.slice(0, 4).map(h => { const d = streakDays(h, now); return <button key={h.id} onClick={() => go('quit')}><b className="num">{d || streakHours(h, now)}<small>{d ? 'дн' : 'год'}</small></b><span>{h.name}</span><em>рекорд {bestStreak(h, now)} дн</em></button>; })}
        {!S.badHabits.length && <button onClick={() => go('quit')}><span>Почати відстежувати</span></button>}
      </div>
      <button className="sosbtn sm" onClick={() => setSheet({ kind: 'sos' })}><Icon n="alert" />SOS</button>
    </div>
  );
}


const QUIET: Record<string, string> = {
  normal: 'Сьогодні без поспіху.', busy: 'Багато справ. Вистачить головного.', exam: 'Сьогодні головне: підготовка.', recovery: 'Сьогодні можна не поспішати.', social: 'Сьогодні є місце для людей.',
};
const SKY: Record<string, string> = { morning: 'sky-morning', day: 'sky-day', evening: 'sky-evening', night: 'sky-night' };

/** The top of the home screen: the sky of the time of day, a greeting, the current mode of life. No numbers, nothing owed. */
function Hero() {
  const { S, setSheet } = useStore();
  const now = useNow(60_000), h = new Date(now).getHours(), sky = h < 5 || h >= 22 ? 'night' : h < 11 ? 'morning' : h < 18 ? 'day' : 'evening';
  const mode = modeOf(S);
  return (
    <div className={`hero compact s12 hero-wrap ${SKY[sky]}`}>
      <div className="sun" />
      <div className="eyebrow">{greet(S.name)}{S.demo && <span className="demo">Демо-дані</span>}</div>
      <h1 className="long">{S.motto?.trim() || QUIET[mode]}</h1>
      <p className="hero-sub">{MODES[mode].hint}</p>
      <NextEvent />
      <ModeChips compact />
      <div className="row" style={{ gap: 10, marginTop: 10 }}>
        {!seasonOn(S, TK()) && !seasonEnded(S, TK()) && <button className="cta ghost" onClick={() => setSheet({ kind: 'season' })}><Icon n="flag" />Пріоритети на період</button>}
      </div>
    </div>
  );
}

/** One to three things for today. Not a list of everything that is open, and nothing about what is left. */
function TodayCard() {
  const { S, A, go, update, setSheet } = useStore();
  const k = TK(), picks = todayPicks(S, k);
  return (
    <div className="card s7">
      <div className="ch"><Icon n="flag" className="ic" /><div><h3>Головне на сьогодні</h3><p>{picks.length ? 'Лише це. Решта почекає' : 'Нічого обовʼязкового'}</p></div><button className="sel" onClick={() => go('tasks')}>Усі задачі</button></div>
      <div className="list">
        {picks.map(t => (
          <div className="item" key={t.id}>
            <button className="chk" role="checkbox" aria-checked={false} aria-label={`Виконано: ${t.t}`} onClick={() => A.toggleTask(t.id)} />
            <span className="t"><b>{t.t}</b></span>
            <button className="ib" title="Почати фокус" aria-label={`Фокус: ${t.t}`} onClick={() => { update(s => { s.timer.task = t.t; }); go('focus'); }}><Icon n="focus" /></button>
          </div>
        ))}
        {!picks.length && <div className="emptyline"><span>Можна просто жити. Якщо є що записати, зроби це тут.</span><button className="btn ghost sm" onClick={() => setSheet({ kind: 'form', key: 'task' })}>Додати</button></div>}
      </div>
    </div>
  );
}

/** The next few events: today from now on, then tomorrow. */
function EventsCard() {
  const { eventsOn, go, setSheet } = useStore();
  const now = useNow(60_000), n = new Date(now), m = n.getHours() * 60 + n.getMinutes(), today = ymd(n), tom = ymd(addD(n, 1));
  const list = [
    ...eventsOn(today).filter(e => e.allDay || toMin(e.e) > m).map(e => ({ e, day: 'сьогодні' })),
    ...eventsOn(tom).map(e => ({ e, day: 'завтра' })),
  ].slice(0, 4);
  return (
    <div className="card s5">
      <div className="ch"><Icon n="schedule" className="ic" /><div><h3>Найближчі події</h3><p>З календаря й розкладу</p></div><button className="sel" onClick={() => go('schedule')}>Розклад</button></div>
      <div className="list">
        {list.map(({ e, day }) => (
          <div className="item" key={e.id + day}><span className="t"><b>{e.title}</b><small>{day} · {e.allDay ? 'весь день' : `${e.s}–${e.e}`}</small></span></div>
        ))}
        {!list.length && <div className="emptyline"><span>Подій найближчим часом немає.</span><button className="btn ghost sm" onClick={() => setSheet({ kind: 'form', key: 'event' })}>Додати</button></div>}
      </div>
    </div>
  );
}

/** How much of today is free, and where. Nothing says it has to be filled. */
function FreeCard() {
  const { S, eventsOn } = useStore();
  const now = useNow(60_000), k = TK();
  const ft = freeTime(S, k, eventsOn(k), S.sessions, now);
  const wins = ft.windows.map(([a, b]) => [Math.max(a, now), b] as [number, number]).filter(([a, b]) => b - a >= 15 * 6e4);
  const left = wins.reduce((t, [a, b]) => t + (b - a), 0) / 6e4;
  const best = wins.reduce<[number, number] | null>((r, w) => (!r || w[1] - w[0] > r[1] - r[0] ? w : r), null);
  return (
    <div className="card s4">
      <div className="ch"><Icon n="clock" className="ic" /><div><h3>Вільний час</h3><p>Лишилось сьогодні</p></div></div>
      <div className="bigstat"><span className="v num" style={{ fontSize: 30 }}>{left > 0 ? hmPlain(left) : '—'}</span></div>
      <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, margin: '8px 0 0' }}>
        {best ? `Найдовше вікно: ${hhmm(new Date(best[0]))}–${hhmm(new Date(best[1]))}. ` : 'Вільних вікон уже немає. '}Це час для себе, його не обовʼязково заповнювати.
      </p>
    </div>
  );
}

/** Energy and rest, only if the person says it. */
function EnergyCard() {
  const { S, A, go } = useStore();
  const k = TK(), lvl = energyToday(S, k), sl = S.health[k]?.sleep || 0;
  return (
    <div className="card s4">
      <div className="ch"><Icon n="moon" className="ic" /><div><h3>Енергія</h3><p>{sl ? `Сон сьогодні: ${sl} год` : 'Як ти себе почуваєш?'}</p></div></div>
      <div className="modechips" role="group" aria-label="Рівень енергії">
        {([[1, 'Мало сил'], [3, 'Нормально'], [5, 'Багато сил']] as const).map(([v, l]) => <button key={v} aria-pressed={lvl === (v === 1 ? 1 : v === 3 ? 2 : 3)} onClick={() => A.setEnergy(v)}>{l}</button>)}
      </div>
      {!sl && <button className="linkbtn" style={{ marginTop: 10 }} onClick={() => go('health')}>Записати сон у «Здоровʼя»</button>}
    </div>
  );
}

/** A short way into social life: who might like a message, and an idea for a meeting. */
function SocialCard() {
  const { S, A, go, setSheet } = useStore();
  const k = TK(), sug = suggestPerson(S, k), idea = S.socialNotes.find(n => n.kind === 'idea');
  const days = sug ? daysSince(S, sug.person.id, k) : null;
  return (
    <div className="card s4">
      <div className="ch"><Icon n="team" className="ic" /><div><h3>Соціальне життя</h3><p>{sug ? 'Можливо, комусь приємно було б почути тебе' : 'Люди, ідеї, нові знайомства'}</p></div><button className="sel" onClick={() => go('social')}>Відкрити</button></div>
      <div className="list">
        {sug && (
          <div className="item">
            <span className="t"><b>{sug.person.name}</b><small>{sinceWord(days)}</small></span>
            <button className="btn ghost sm" onClick={() => A.addTouch(sug.person.id, 'msg')}>Написав</button>
          </div>
        )}
        {idea && <div className="item"><span className="t"><small>Ідея</small>{idea.text}</span></div>}
        {!sug && !idea && <div className="emptyline"><span>Почни з однієї людини чи однієї ідеї.</span><button className="btn ghost sm" onClick={() => setSheet({ kind: 'people' })}>Додати людину</button></div>}
      </div>
    </div>
  );
}

const LINKS: [string, string, IconName][] = [['anela', 'Anela', 'user'], ['faith', 'Віра', 'sun'], ['health', 'Здоровʼя', 'health'], ['notes', 'Нотатки', 'notes'], ['goals', 'Цілі', 'goals'], ['money', 'Фінанси', 'money']];

/** Short ways to the personal sections the person keeps switched on. */
function LinksCard() {
  const { S, go } = useStore();
  const list = LINKS.filter(([k]) => moduleOn(S, k));
  if (!list.length) return null;
  return (
    <div className="card s12 linkscard">
      <div className="quicklinks">{list.map(([k, l, i]) => <button key={k} onClick={() => go(k)}><Icon n={i} className="ic" /><span>{l}</span></button>)}</div>
    </div>
  );
}

/** Everything the old dashboard showed, behind one tap. It stays shut until it is asked for. */
function Details() {
  const { S: S0, A, go, scoreOn } = useStore();
  const now = useNow(30_000);
  const worked = (k: string) => scoreOn(k, now).ft.worked;
  const S = { ...S0, sessions: liveSessions(S0, now) };
  const ti = weekdayIdx(), w = weekMinutes(S), tot = Math.round(w.reduce((a, b) => a + b, 0));
  const ws = wStart().getTime(), blocks = [...Array(7)].map(() => Array(6).fill(0) as number[]);
  S.sessions.forEach(s => { const i = Math.floor((sod(s.t).getTime() - ws) / DAY); if (i >= 0 && i < 7) blocks[i][Math.floor(new Date(s.t).getHours() / 4)] += s.m; });
  const k = TK(), habits = S.habits.filter(h => !h.paused), hDone = habits.filter(h => h.days[k]).length;
  const mt = monthTx(S), out = sumT(S, mt, 'out'), b = budgetDKK(S), hide = S0.ui.hideMetrics;
  return (
    <>
      <AdviceCard />
      <SchedCard />
      {!hide && <FreeTimeCard />}
      {!hide && <WeekSummary worked={worked} />}
      <div className="card s12">
        <div className="ch"><Icon n="life" className="ic" /><div><h3>Сьогодні</h3><p>Сон, настрій і гроші</p></div><button className="sel" onClick={() => go('health')}>Здоровʼя</button></div>
        <LifeTiles full={false} />
      </div>
      <div className="card s4">
        <div className="ch"><Icon n="habits" className="ic" /><div><h3>Звички</h3><p>{hide ? ' ' : habits.length ? `${hDone} з ${habits.length} сьогодні` : 'Звичок немає'}</p></div><button className="sel" onClick={() => go('habits')}>Усі</button></div>
        <div className="list">
          {habits.slice(0, 6).map(h => {
            const on = !!h.days[k];
            return <div className="item" key={h.id}><button className={`chk ${on ? 'on' : ''}`} aria-pressed={on} aria-label={`Відмітити: ${h.name}`} onClick={() => A.toggleHabit(h.id)}>{on && <Icon n="check" />}</button><span className="t">{h.name}</span></div>;
          })}
        </div>
      </div>
      <div className="card s4">
        <div className="ch"><Icon n="money" className="ic" /><div><h3>Фінанси</h3><p>{MONTHN[new Date().getMonth()]}, витрати обох рахунків у кронах</p></div><button className="sel" onClick={() => go('money')}>Відкрити</button></div>
        <div className="bigstat"><span className="v num" style={{ fontSize: 28 }}>{money(out)}</span><span className="muted">з {money(b)}</span></div>
        <div className="bar" style={{ margin: '10px 0 10px' }}><i style={{ width: pctW(out, b) + '%', background: 'var(--accent)' }} /></div>
        <div className="accmini">
          {(['dk', 'ua'] as const).map(id => { const a = account(S, id); return <button key={id} onClick={() => go('money')}><span className={`curtag ${a.cur}`}>{CUR_SIGN[a.cur]}</span><b className="num">{fmtCur(balance(S, id), a.cur)}</b></button>; })}
        </div>
        <div className="cats"><CatBars tx={mt} limit={4} /></div>
      </div>
      <QuitMini />
      {!hide && (
        <>
          <div className="card s4">
            <div className="ch"><Icon n="clock" className="ic" /><div><h3>Час фокусу</h3><p>Глибока робота за тиждень</p></div></div>
            <div className="bigstat"><span className="v num">{Math.floor(tot / 60) > 0 && <>{Math.floor(tot / 60)}<small>год</small></>}{tot % 60}<small>хв</small></span></div>
            <FocusArea week={w} today={ti} />
          </div>
          <div className="card s8">
            <div className="ch"><Icon n="wave" className="ic" /><div><h3>Ритм навчання</h3><p>Фокус по 4-годинних блоках</p></div></div>
            <div className="hscroll"><Rhythm blocks={blocks} today={ti} /></div>
          </div>
          <div className="card s4">
            <div className="ch"><Icon n="map" className="ic" /><div><h3>Карта фокусу</h3><p>Коли найлегше зосередитись</p></div></div>
            <HeatMap />
          </div>
        </>
      )}
      <AffirmationsCard />
    </>
  );
}

export function Home() {
  const { S, go } = useStore();
  const [more, setMore] = useState(false);
  const min = S.ui.minimal, on = (k: string) => homeOn(S, k);
  return (
    <section className="view">
      <div className="grid">
        <WelcomeBack />
        <Hero />
        {on('season') && !min && <SeasonCard />}
        {on('today') && <TodayCard />}
        {on('events') && <EventsCard />}
        {on('energy') && !min && <RestCard />}
        {!min && on('free') && <FreeCard />}
        {!min && on('energy') && <EnergyCard />}
        {!min && on('social') && moduleOn(S, 'social') && <SocialCard />}
        {!min && on('links') && <LinksCard />}
        <WeekReviewPrompt />
        {!min && on('details') && (
          <>
            <button className="moretoggle" aria-expanded={more} onClick={() => setMore(m => !m)}>
              <Icon n="trend" /><span>Докладніше: тіло, гроші, фокус, розклад</span><small>{more ? 'Сховати' : 'Показати'}</small><Icon n="right" className="icn chev" />
            </button>
            {more && <Details />}
          </>
        )}
        {min && <button className="moretoggle" onClick={() => go('prefs')}><Icon n="prefs" /><span>Мінімалістичний режим увімкнено</span><small>Налаштування</small><Icon n="right" className="icn chev" /></button>}
      </div>
    </section>
  );
}
