'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Goal, MoodEntry, Note, UiEvent } from '@/lib/types';
import { scoreColor } from '@/lib/score';
import { ACT_KINDS, dayMood, ENERGY3, energyLevel, energyWord, MOOD_TAGS, moodColor, moodsOn, moodWord } from '@/lib/score';
import { goalStep, liveSessions, useStore } from '@/lib/store';
import { goalFocusOn, goalProgress, goalTasks } from '@/lib/goals';
import { WoltCard } from '../Wolt';
import { addD, AREAS, DAY, COLORS, daysTo, DN, fmt, fmtN, hhmm, hmPlain, MON, MONTHN, pad2, plural, sod, sum, TK, toMin, WD, weekdayIdx, wStart, ymd } from '@/lib/util';
import { Icon } from '../Icon';
import { Bars, Radar } from '../charts';
import { avg, DelBtn, habStreak, lanes, LifeTiles } from '../shared';

/* ---------------- Focus ---------------- */
/** One focus session a day goes to a goal: suggests the most important goal task until that is done. */
export function GoalSessionBanner({ compact = false }: { compact?: boolean }) {
  const { S, update, now, go, toggleTimer, setTimerMode } = useStore();
  const k = TK(), mins = goalFocusOn(S, k, liveSessions(S, now)), next = goalTasks(S)[0];
  const goal = next ? S.goals.find(g => g.id === next.goal) : null;
  if (mins >= 20) return <div className={`goalbanner ok${compact ? ' compact' : ''}`}><Icon n="check" /><span>Сьогодні вже {Math.round(mins)} хв фокусу на кроки до цілей.</span></div>;
  if (!next || !goal) {
    if (compact || !S.goals.length) return null;
    return <div className="goalbanner"><span>Привʼяжи задачі до цілей у «Задачах» або «Цілях», і тут зʼявиться крок, з якого варто почати день.</span><button className="sqb" onClick={() => go('goals')}>До цілей</button></div>;
  }
  const start = () => { update(s => { s.timer.task = next.t; }); if (!S.timer.running) { if (S.timer.mode !== 'focus') setTimerMode('focus'); toggleTimer(); } go('focus'); };
  return (
    <div className={`goalbanner${compact ? ' compact' : ''}`}>
      <div style={{ minWidth: 0 }}>
        <small>{mins > 0 ? `Для цілей сьогодні ${Math.round(mins)} хв, ще трохи` : 'Перша сесія дня — для цілі'} «{goal.title}»</small>
        <b>{next.t}</b>
      </div>
      <button className="btn acc" onClick={start}><Icon n="play" />Почати</button>
    </div>
  );
}

export function Focus() {
  const { S, A, update, now, timerLeft, toggleTimer, resetTimer, setTimerMode, completeTimer, durOf } = useStore();
  const T = S.timer, dur = durOf(T.mode), C = 552.9;
  const all = liveSessions(S, now);
  const a = sod(new Date()).getTime(), today = all.filter(s => s.t >= a);
  const recent = [...all].sort((x, y) => y.t - x.t).slice(0, 12);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement?.tagName || '')) { e.preventDefault(); toggleTimer(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggleTimer]);
  return (
    <section className="view">
      <div className="vh"><div><h2>Фокус</h2><p>Таймер Помодоро. У статистику йде весь час фокусу, навіть якщо зупинився раніше. Пробіл: старт і пауза.</p></div></div>
      <GoalSessionBanner />
      <div className="grid" style={{ marginTop: 18 }}>
        <div className="card s7">
          <div className="row" style={{ justifyContent: 'center' }}>
            <div className="seg">
              <button aria-pressed={T.mode === 'focus'} onClick={() => setTimerMode('focus')}>Фокус {S.focusMin}</button>
              <button aria-pressed={T.mode === 'break'} onClick={() => setTimerMode('break')}>Перерва {S.breakMin}</button>
            </div>
          </div>
          <div className="timer">
            <div className="face">
              <svg viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="88" fill="none" stroke="var(--bar)" strokeWidth="10" />
                <circle cx="100" cy="100" r="88" fill="none" stroke={T.mode === 'focus' ? 'var(--accent)' : 'var(--good)'} strokeWidth="10" strokeLinecap="round" transform="rotate(-90 100 100)" strokeDasharray={C} strokeDashoffset={(C * (1 - timerLeft / dur)).toFixed(1)} />
              </svg>
              <div className="in"><small>{T.mode === 'focus' ? 'Фокус' : 'Перерва'}</small><b>{fmt(timerLeft)}</b><small>{T.task || (T.mode === 'focus' ? 'Без задачі' : 'Відпочинь, розімнись')}</small></div>
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn acc" onClick={toggleTimer}><Icon n={T.running ? 'pause' : 'play'} />{T.running ? 'Пауза' : timerLeft < dur ? 'Продовжити' : 'Старт'}</button>
            <button className="btn ghost" onClick={resetTimer}>Скинути</button>
            <button className="btn ghost" onClick={() => completeTimer(true)}>Пропустити</button>
          </div>
        </div>
        <div className="card s5" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label className="field" htmlFor="tTaskSel">Над чим працюєш
            <select id="tTaskSel" value={T.task} onChange={e => update(s => { s.timer.task = e.target.value; })}>
              <option value="">Без задачі</option>
              {goalTasks(S).length > 0 && <optgroup label="Кроки до цілей">{goalTasks(S).map(t => <option key={t.id} value={t.t}>{t.t}</option>)}</optgroup>}
              <optgroup label="Інші задачі">{S.tasks.filter(t => !t.d && !goalTasks(S).includes(t)).map(t => <option key={t.id} value={t.t}>{t.t}</option>)}</optgroup>
            </select>
          </label>
          <div className="kv">
            <div><div className="muted" style={{ fontSize: 12 }}>Сьогодні</div><div className="num" style={{ fontSize: 24, fontWeight: 600 }}>{hmPlain(sum(today.map(s => s.m)))}</div></div>
            <div><div className="muted" style={{ fontSize: 12 }}>Сесій сьогодні</div><div className="num" style={{ fontSize: 24, fontWeight: 600 }}>{today.length}</div></div>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Журнал сесій</div>
          <div className="list log">
            {recent.map(s => { const d = new Date(s.t); return <div className="item" key={s.t}><span className="sw c1" /><span className="t">{DN[weekdayIdx(d)]}, {pad2(d.getHours())}:{pad2(d.getMinutes())}{'live' in s && <span className="muted"> · триває</span>}</span><span className="num">{s.m} хв</span>{!('live' in s) && <DelBtn label="Видалити сесію" onDelete={() => A.delSession(s.t)} />}</div>; })}
            {!recent.length && <p className="muted">Ще немає сесій. Натисни «Старт».</p>}
          </div>
        </div>
        <ActTimer />
        <ManualTime />
        <ActLog />
        <WoltCard />
      </div>
    </section>
  );
}

const DAY_MS = 864e5;
const hms = (sec: number) => `${Math.floor(sec / 3600)}:${pad2(Math.floor(sec / 60) % 60)}:${pad2(sec % 60)}`;

/** Stopwatch for errands: start when you leave, stop when you are back. */
function ActTimer() {
  const { S, A, now } = useStore();
  const [kind, setKind] = useState(ACT_KINDS[0]);
  const [title, setTitle] = useState('');
  const a = S.act;
  return (
    <div className="card s5" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="ch" style={{ margin: 0 }}><div><h3>Справи</h3><p>Пішов у магазин чи по справах? Запусти відлік, щоб цей час не губився.</p></div></div>
      {a ? (
        <>
          <div className="actrun"><span className="dot" /><div><b>{a.kind}{a.title && <span className="muted"> · {a.title}</span>}</b><small>з {hhmm(new Date(a.start))}</small></div><span className="num">{hms(Math.max(0, Math.round((now - a.start) / 1000)))}</span></div>
          <div className="row">
            <button className="btn acc" onClick={A.stopAct}><Icon n="check" />Завершити</button>
            <button className="btn ghost" onClick={A.cancelAct}>Скасувати</button>
          </div>
        </>
      ) : (
        <>
          <div className="tags">{ACT_KINDS.map(k => <button type="button" key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{k}</button>)}</div>
          <label className="field" htmlFor="actTitle">Що саме (необовʼязково)<input id="actTitle" placeholder="Напр.: Netto, пошта, банк" value={title} onChange={e => setTitle(e.target.value)} autoComplete="off" /></label>
          <button className="btn acc" style={{ alignSelf: 'flex-start' }} onClick={() => { A.startAct(kind, title); setTitle(''); }}><Icon n="play" />Почати відлік</button>
        </>
      )}
    </div>
  );
}

/** Add focus or an errand afterwards, with start and end time. */
function ManualTime() {
  const { A } = useStore();
  const [v, setV] = useState(() => ({ kind: 'focus', title: '', date: TK(), s: hhmm(new Date(Date.now() - 36e5)), e: hhmm(new Date()) }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const start = new Date(`${v.date}T${v.s}`).getTime();
    let end = new Date(`${v.date}T${v.e}`).getTime();
    if (end <= start) end += DAY_MS; // e.g. 23:00–01:00 ends the next day
    const ok = v.kind === 'focus' ? A.addFocus(start, end) : A.addActivity({ kind: v.kind, title: v.title, start, end });
    if (ok) setV({ ...v, title: '' });
  };
  return (
    <form className="card s7" style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={submit}>
      <div className="ch" style={{ margin: 0 }}><div><h3>Додати час вручну</h3><p>Забув запустити таймер? Впиши, коли почав і закінчив.</p></div></div>
      <div className="row">
        <label className="field" htmlFor="mtKind" style={{ flex: '1 1 160px' }}>Що це було
          <select id="mtKind" value={v.kind} onChange={e => setV({ ...v, kind: e.target.value })}>
            <option value="focus">Фокус (робота, навчання)</option>
            {ACT_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        {v.kind !== 'focus' && <label className="field" htmlFor="mtTitle" style={{ flex: '1 1 160px' }}>Деталі<input id="mtTitle" placeholder="Необовʼязково" value={v.title} onChange={e => setV({ ...v, title: e.target.value })} autoComplete="off" /></label>}
      </div>
      <div className="row">
        <label className="field" htmlFor="mtDate" style={{ flex: '1 1 140px' }}>Дата<input id="mtDate" type="date" required max={TK()} value={v.date} onChange={e => setV({ ...v, date: e.target.value })} /></label>
        <label className="field" htmlFor="mtS" style={{ flex: '1 1 100px' }}>З<input id="mtS" type="time" required value={v.s} onChange={e => setV({ ...v, s: e.target.value })} /></label>
        <label className="field" htmlFor="mtE" style={{ flex: '1 1 100px' }}>До<input id="mtE" type="time" required value={v.e} onChange={e => setV({ ...v, e: e.target.value })} /></label>
      </div>
      <button className="btn" style={{ alignSelf: 'flex-start' }}>Додати</button>
    </form>
  );
}

/** Errands logged on a day, with totals per kind. */
function ActLog() {
  const { S, A } = useStore();
  const [k, setK] = useState(TK());
  const dt = new Date(k + 'T00:00');
  const list = S.activities.filter(a => ymd(new Date(a.start)) === k).sort((a, b) => b.start - a.start);
  const mins = (a: { start: number; end: number }) => Math.round((a.end - a.start) / 6e4);
  const by: Record<string, number> = {};
  list.forEach(a => { by[a.kind] = (by[a.kind] || 0) + mins(a); });
  const total = sum(Object.values(by));
  return (
    <div className="card s12">
      <div className="ch">
        <div><h3>Справи: {k === TK() ? 'сьогодні' : `${WD[dt.getDay()].toLowerCase()}, ${dt.getDate()} ${MON[dt.getMonth()]}`}</h3><p>{total ? `Усього ${hmPlain(total)}. Цей час не рахується як вільний.` : 'Записів немає'}</p></div>
        <div className="row" style={{ marginLeft: 'auto', gap: 6 }}>
          <button className="btn ghost cal-nav" aria-label="Попередній день" onClick={() => setK(ymd(addD(dt, -1)))}>‹</button>
          <button className="btn ghost cal-nav" aria-label="Наступний день" disabled={k >= TK()} onClick={() => setK(ymd(addD(dt, 1)))}>›</button>
        </div>
      </div>
      {total > 0 && <div className="tags small" style={{ marginBottom: 8 }}>{Object.entries(by).sort((a, b) => b[1] - a[1]).map(([kind, m]) => <span key={kind}>{kind} · {hmPlain(m)}</span>)}</div>}
      <div className="list">
        {list.map(a => (
          <div className="item" key={a.id}>
            <span className="sw c2" />
            <span className="num muted" style={{ fontSize: 12, minWidth: 92 }}>{hhmm(new Date(a.start))}–{hhmm(new Date(a.end))}</span>
            <span className="t">{a.kind}{a.title && <span className="muted"> · {a.title}</span>}</span>
            <span className="num">{hmPlain(mins(a))}</span>
            <DelBtn label="Видалити запис" onDelete={() => A.delActivity(a.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Tasks ---------------- */
export function Tasks() {
  const { S, A, update, go, setSheet } = useStore();
  const [f, setF] = useState<'open' | 'done' | 'all'>('open');
  const [text, setText] = useState('');
  const [pri, setPri] = useState<'hi' | 'lo'>('lo');
  const [goal, setGoal] = useState('');
  const open = S.tasks.filter(t => !t.d).length;
  const goalName = (id?: number) => S.goals.find(g => g.id === id)?.title;
  const list = S.tasks.filter(t => f === 'all' || (f === 'done' ? t.d : !t.d)).sort((a, b) => (a.p === 'hi' ? 0 : 1) - (b.p === 'hi' ? 0 : 1));
  const submit = (e: FormEvent) => { e.preventDefault(); A.addTask(text, pri, +goal || undefined); setText(''); };
  return (
    <section className="view">
      <div className="vh"><div><h2>Задачі</h2><p>{open} відкритих із {S.tasks.length}</p></div></div>
      <div className="card" style={{ marginTop: 18 }}>
        <form className="row" onSubmit={submit}>
          <label className="field" htmlFor="taskIn" style={{ flex: '1 1 240px' }}>Нова задача<input id="taskIn" value={text} onChange={e => setText(e.target.value)} placeholder="Напр. Підготувати презентацію" autoComplete="off" /></label>
          <label className="field" htmlFor="taskPri">Пріоритет<select id="taskPri" value={pri} onChange={e => setPri(e.target.value as 'hi' | 'lo')}><option value="hi">Важливо</option><option value="lo">Звичайно</option></select></label>
          {S.goals.length > 0 && <label className="field" htmlFor="taskGoal" style={{ flex: '1 1 180px' }}>Для цілі<select id="taskGoal" value={goal} onChange={e => { setGoal(e.target.value); if (e.target.value) setPri('hi'); }}><option value="">Без цілі</option>{S.goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>}
          <button className="btn" style={{ alignSelf: 'flex-end' }}>Додати</button>
        </form>
        <div className="row" style={{ margin: '18px 0 6px' }}>
          <div className="seg">{([['open', 'Відкриті'], ['done', 'Виконані'], ['all', 'Усі']] as const).map(([k, l]) => <button key={k} aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>)}</div>
        </div>
        <div className="list">
          {list.map(t => (
            <div key={t.id} className={`item ${t.d ? 'done' : ''}`}>
              <button className="chk" aria-label="Позначити" onClick={() => { A.toggleTask(t.id); }}>{t.d && <Icon n="check" />}</button>
              <span className="t">{t.t}</span>
              {t.goal && goalName(t.goal) && <button className="tag goaltag" title="Ця задача веде до цілі" onClick={() => go('goals')}>→ {goalName(t.goal)}</button>}
              {t.p === 'hi' && <span className="tag">Важливо</span>}
              <button className="x" title="Фокус на задачі" aria-label="Фокус на задачі" onClick={() => { update(s => { s.timer.task = t.t; }); go('focus'); }}><Icon n="focus" /></button>
              <button className="sqb" aria-label={`Змінити: ${t.t}`} onClick={() => setSheet({ kind: 'form', key: 'editTask', init: { id: String(t.id), text: t.t, pri: t.p, goal: t.goal ? String(t.goal) : '' } })}>Змінити</button>
              <button className="x" aria-label="Видалити" onClick={() => A.delTask(t.id)}><Icon n="x" /></button>
            </div>
          ))}
          {!list.length && <p className="muted">Тут порожньо. Додай першу задачу вище.</p>}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Habits ---------------- */
export function Habits() {
  const { S, A, setSheet } = useStore();
  const [name, setName] = useState('');
  const [off, setOff] = useState(0);
  const ws = addD(wStart(), off * 7), ti = off === 0 ? weekdayIdx() : 6, k = TK(), now = new Date();
  const done = S.habits.filter(h => h.days[k]).length;
  let cnt = 0;
  S.habits.forEach(h => { for (let i = 0; i <= ti; i++) if (h.days[ymd(addD(ws, i))]) cnt++; });
  const wp = S.habits.length ? Math.round((cnt / (S.habits.length * (ti + 1))) * 100) : 0;
  const we = addD(ws, 6), wLabel = off === 0 ? 'Цей тиждень' : `${ws.getDate()}.${String(ws.getMonth() + 1).padStart(2, '0')} – ${we.getDate()}.${String(we.getMonth() + 1).padStart(2, '0')}`;
  // completion of the last 8 weeks, oldest first, to look back at
  const hist = [...Array(8)].map((_, j) => {
    const w0 = addD(wStart(), (off - 7 + j) * 7); let c = 0, n = 0;
    S.habits.forEach(h => { for (let i = 0; i < 7; i++) { const d = addD(w0, i); if (d > now) continue; n++; if (h.days[ymd(d)]) c++; } });
    return { w0, p: n ? Math.round((c / n) * 100) : null };
  });
  return (
    <section className="view">
      <div className="vh"><div><h2>Звички</h2><p>{done} з {S.habits.length} сьогодні · {wp}% виконання: {wLabel.toLowerCase()}</p></div>
        <div className="hnav">
          <button className="btn ghost cal-nav" aria-label="Попередній тиждень" onClick={() => setOff(off - 1)}>‹</button>
          <button className="btn ghost" disabled={off === 0} onClick={() => setOff(0)}>Сьогодні</button>
          <button className="btn ghost cal-nav" aria-label="Наступний тиждень" disabled={off === 0} onClick={() => setOff(off + 1)}>›</button>
        </div></div>
      <div className="card" style={{ marginTop: 18 }}>
        <form className="row" onSubmit={e => { e.preventDefault(); A.addHabit(name); setName(''); }}>
          <label className="field" htmlFor="habIn" style={{ flex: '1 1 240px' }}>Нова звичка<input id="habIn" value={name} onChange={e => setName(e.target.value)} placeholder="Напр. 10 хвилин медитації" autoComplete="off" /></label>
          <button className="btn" style={{ alignSelf: 'flex-end' }}>Додати</button>
        </form>
        <div style={{ marginTop: 18, overflowX: 'auto' }}>
          {S.habits.length ? (
            <>
              <div className="habrow head"><span />{DN.map((d, i) => <span key={d} className={i === ti ? 'today' : ''}>{d}</span>)}<span>Серія</span><span /></div>
              {S.habits.map(h => (
                <div className="habrow" key={h.id}>
                  <button className="t" style={{ textAlign: 'left' }} title="Натисни, щоб перейменувати" onClick={() => setSheet({ kind: 'form', key: 'editHabit', init: { id: String(h.id), name: h.name } })}>{h.name}</button>
                  {DN.map((d, i) => {
                    const day = addD(ws, i), key = ymd(day), on = !!h.days[key];
                    return <button key={d} className={`hc ${on ? 'on' : ''}`} disabled={day > now} aria-pressed={on} aria-label={`${h.name}, ${d}`} onClick={() => A.toggleHabit(h.id, key)}>{on && <Icon n="check" />}</button>;
                  })}
                  <span className="num" style={{ textAlign: 'center' }}>{habStreak(h.days, S)} дн</span>
                  <DelBtn label="Видалити звичку" onDelete={() => A.delHabit(h.id)} />
                </div>
              ))}
            </>
          ) : <p className="muted">Звичок поки немає. Додай першу вище.</p>}
        </div>
        {S.habits.length > 0 && (
          <div className="scorehist" style={{ marginTop: 18 }}>
            {hist.map(h => (
              <button key={+h.w0} aria-pressed={+h.w0 === +ws} title={`Тиждень з ${h.w0.getDate()}.${String(h.w0.getMonth() + 1).padStart(2, '0')}: ${h.p ?? '—'}%`} onClick={() => setOff(Math.round((+h.w0 - +wStart()) / 6048e5))}>
                <i style={{ height: Math.max(3, (h.p ?? 0) * 0.44), background: scoreColor(h.p) }} /><span>{h.w0.getDate()}.{String(h.w0.getMonth() + 1).padStart(2, '0')}</span><b className="num">{h.p ?? '—'}</b>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------------- Health ---------------- */
/** New mood check-in, or editing an existing one when `edit` is given. */
function MoodForm({ edit, onDone }: { edit?: MoodEntry | null; onDone?: () => void }) {
  const { S, A } = useStore();
  const blank = () => ({ date: TK(), time: hhmm(new Date()), v: 7, energy: 3, tags: [] as string[], note: '' });
  const [m, setM] = useState(() => (edit ? { date: ymd(new Date(edit.t)), time: hhmm(new Date(edit.t)), v: edit.v, energy: edit.energy, tags: [...edit.tags], note: edit.note } : blank()));
  const [custom, setCustom] = useState('');
  // own tags used before come back as buttons
  const ownTags = [...new Set(S.moods.flatMap(x => x.tags))].filter(t => !MOOD_TAGS.includes(t));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = { t: new Date(`${m.date}T${m.time || '12:00'}`).getTime(), v: m.v, energy: m.energy, tags: m.tags, note: m.note };
    if (edit) { A.updateMood(edit.id, v); onDone?.(); } else { A.addMood(v); setM(blank()); }
  };
  const toggleTag = (t: string) => setM({ ...m, tags: m.tags.includes(t) ? m.tags.filter(x => x !== t) : [...m.tags, t] });
  const addCustom = () => { const t = custom.trim(); if (t && !m.tags.includes(t)) setM({ ...m, tags: [...m.tags, t] }); setCustom(''); };
  return (
    <form className="moodform" onSubmit={submit}>
      <div className="row">
        <label className="field" htmlFor="mdDate" style={{ flex: 1 }}>Дата<input id="mdDate" type="date" value={m.date} max={TK()} onChange={e => setM({ ...m, date: e.target.value })} /></label>
        <label className="field" htmlFor="mdTime" style={{ flex: 1 }}>Час<input id="mdTime" type="time" value={m.time} onChange={e => setM({ ...m, time: e.target.value })} /></label>
      </div>
      <div className="field">
        <div className="row" style={{ justifyContent: 'space-between' }}><span>Настрій</span><b className="num" style={{ color: moodColor(m.v) }}>{m.v}/10 · {moodWord(m.v)}</b></div>
        <div className="scale10">
          {[...Array(10)].map((_, i) => <button type="button" key={i} aria-pressed={m.v === i + 1} aria-label={`Настрій ${i + 1} з 10`} style={{ ['--mc' as string]: moodColor(i + 1) }} onClick={() => setM({ ...m, v: i + 1 })}>{i + 1}</button>)}
        </div>
      </div>
      <div className="field">
        <span>Скільки в тебе сил зараз? <em className="opt">необовʼязково</em></span>
        <div className="energy3">
          {ENERGY3.map(x => {
            const on = energyLevel(m.energy) === energyLevel(x.v);
            return <button type="button" key={x.v} aria-pressed={on} onClick={() => setM({ ...m, energy: on ? 0 : x.v })}><b>{x.l}</b><small>{x.hint}</small></button>;
          })}
        </div>
      </div>
      <div className="field">
        <span>Що відчуваєш</span>
        <div className="tags">
          {[...MOOD_TAGS, ...ownTags, ...m.tags.filter(t => !MOOD_TAGS.includes(t) && !ownTags.includes(t))].map(t => <button type="button" key={t} aria-pressed={m.tags.includes(t)} onClick={() => toggleTag(t)}>{t}</button>)}
          <input className="tagin" value={custom} placeholder="+ свій тег" aria-label="Додати свій тег" onChange={e => setCustom(e.target.value)} onBlur={addCustom}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} />
        </div>
      </div>
      <label className="field" htmlFor="mdNote">Що сталося, про що думаєш
        <textarea id="mdNote" rows={3} placeholder="Необовʼязково: що вплинуло на настрій" value={m.note} onChange={e => setM({ ...m, note: e.target.value })} />
      </label>
      <div className="row">
        <button className="btn acc">{edit ? 'Зберегти зміни' : 'Записати настрій'}</button>
        {edit && <button type="button" className="btn ghost" onClick={onDone}>Скасувати</button>}
      </div>
    </form>
  );
}

/** Mood check-ins of one day as dots on a 24-hour line. */
function MoodDay({ k }: { k: string }) {
  const { S } = useStore();
  const list = moodsOn(S, k), W = 720, H = 150, P = 20, x = (t: number) => P + ((W - 2 * P) * (new Date(t).getHours() * 60 + new Date(t).getMinutes())) / 1440, y = (v: number) => H - 22 - ((H - 40) * (v - 1)) / 9;
  if (!list.length) return null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {[0, 6, 12, 18, 24].map(h => <g key={h}><line x1={P + ((W - 2 * P) * h) / 24} x2={P + ((W - 2 * P) * h) / 24} y1="8" y2={H - 20} stroke="var(--line)" /><text className="chart-text" x={P + ((W - 2 * P) * h) / 24} y={H - 6} textAnchor="middle">{pad2(h % 24)}:00</text></g>)}
      {list.length > 1 && <polyline fill="none" stroke="var(--muted)" strokeWidth="1.5" opacity=".5" points={list.map(m => `${x(m.t).toFixed(1)},${y(m.v).toFixed(1)}`).join(' ')} />}
      {list.map(m => <circle key={m.id} cx={x(m.t)} cy={y(m.v)} r="6" fill={moodColor(m.v)}><title>{`${hhmm(new Date(m.t))} · ${m.v}/10${m.tags.length ? ' · ' + m.tags.join(', ') : ''}`}</title></circle>)}
    </svg>
  );
}

function MoodLog({ k, setK, onEdit }: { k: string; setK: (k: string) => void; onEdit: (m: MoodEntry) => void }) {
  const { S, A } = useStore();
  const list = [...moodsOn(S, k)].reverse(), dt = new Date(k + 'T00:00'), avgV = dayMood(S, k);
  return (
    <>
      <div className="ch">
        <div><h3>{k === TK() ? 'Сьогодні' : `${WD[dt.getDay()]}, ${dt.getDate()} ${MON[dt.getMonth()]}`}</h3><p>{list.length ? `${list.length} ${plural(list.length, 'запис', 'записи', 'записів')} · в середньому ${avgV.toFixed(1)}/10` : 'Записів настрою немає'}</p></div>
        <div className="row" style={{ marginLeft: 'auto', gap: 6 }}>
          <button className="btn ghost cal-nav" aria-label="Попередній день" onClick={() => setK(ymd(addD(dt, -1)))}>‹</button>
          <button className="btn ghost cal-nav" aria-label="Наступний день" disabled={k >= TK()} onClick={() => setK(ymd(addD(dt, 1)))}>›</button>
        </div>
      </div>
      <MoodDay k={k} />
      <div className="list">
        {list.map(m => (
          <div className="item" key={m.id} style={{ alignItems: 'flex-start' }}>
            <span className="moodval num" style={{ background: moodColor(m.v) }}>{m.v}</span>
            <div className="t">
              <div><b className="num">{hhmm(new Date(m.t))}</b> · {moodWord(m.v)}{m.energy > 0 && <span className="muted"> · {energyWord(m.energy).toLowerCase()}</span>}</div>
              {m.tags.length > 0 && <div className="tags small">{m.tags.map(t => <span key={t}>{t}</span>)}</div>}
              {m.note && <div className="muted" style={{ fontSize: 13, marginTop: 4, whiteSpace: 'pre-wrap' }}>{m.note}</div>}
            </div>
            <button className="sqb" onClick={() => onEdit(m)} aria-label="Змінити запис настрою">Змінити</button>
            <DelBtn label="Видалити запис настрою" onDelete={() => A.delMood(m.id)} />
          </div>
        ))}
      </div>
    </>
  );
}

/** Five weeks of daily mood as coloured cells; a tap opens that day in the log. */
function MoodMonth({ k, setK }: { k: string; setK: (k: string) => void }) {
  const { S } = useStore();
  const today = TK(), start = addD(wStart(), -28);
  const days = [...Array(35)].map((_, i) => ymd(addD(start, i)));
  return (
    <>
      <div className="ch"><div><h3>Настрій за 5 тижнів</h3><p>Колір = середній настрій дня. Натисни на день, щоб відкрити записи.</p></div></div>
      <div className="moodcal">
        {DN.map(d => <span key={d}>{d}</span>)}
        {days.map(d => {
          const v = dayMood(S, d), dt = new Date(d + 'T00:00'), future = d > today;
          return (
            <button key={d} disabled={future} aria-pressed={d === k} className={d === today ? 'today' : ''} style={{ background: v ? moodColor(v) : undefined, color: v ? '#fff' : undefined }}
              title={`${dt.getDate()} ${MON[dt.getMonth()]}: ${v ? v.toFixed(1) + '/10' : 'не відмічено'}`} onClick={() => setK(d)}>
              {dt.getDate()}
            </button>
          );
        })}
      </div>
      <div className="moodlegend">{[2, 4, 6, 8, 10].map(v => <span key={v}><i style={{ background: moodColor(v) }} />{moodWord(v)}</span>)}</div>
    </>
  );
}

/** Patterns from the last 30 days: trend, time of day, tags and energy. */
function MoodInsights() {
  const { S, now } = useStore();
  const since = now - 30 * DAY, list = S.moods.filter(m => m.t >= since);
  if (list.length < 3) return <><div className="ch"><div><h3>Закономірності</h3><p>Що впливає на твій настрій</p></div></div><p className="muted">Запиши настрій хоча б кілька разів, і тут зʼявляться закономірності: коли тобі найкраще, що піднімає й опускає настрій.</p></>;
  const all = avg(list.map(m => m.v));
  const span = (a: number, b: number) => avg(S.moods.filter(m => m.t >= now - a * DAY && m.t < now - b * DAY).map(m => m.v));
  const wk = span(7, 0), prev = span(14, 7), delta = wk && prev ? wk - prev : 0;
  const PARTS: [string, (h: number) => boolean][] = [['Ранок', h => h >= 5 && h < 12], ['День', h => h >= 12 && h < 17], ['Вечір', h => h >= 17 && h < 22], ['Ніч', h => h >= 22 || h < 5]];
  const parts = PARTS.map(([l, f]) => { const v = list.filter(m => f(new Date(m.t).getHours())).map(m => m.v); return { l, v: avg(v), n: v.length }; });
  const best = [...parts].filter(p => p.n).sort((a, b) => b.v - a.v)[0];
  const byTag = new Map<string, number[]>();
  list.forEach(m => m.tags.forEach(t => byTag.set(t, [...(byTag.get(t) || []), m.v])));
  const tags = [...byTag].filter(([, v]) => v.length >= 2).map(([t, v]) => ({ t, d: avg(v) - all, n: v.length })).sort((a, b) => b.d - a.d);
  const up = tags.filter(x => x.d >= 0.3).slice(0, 3), down = tags.filter(x => x.d <= -0.3).slice(-3).reverse();
  const energy = ENERGY3.map((x, i) => { const v = list.filter(m => energyLevel(m.energy) === i + 1).map(m => m.v); return { l: x.l, v: avg(v), n: v.length }; }).filter(e => e.n);
  return (
    <>
      <div className="ch"><div><h3>Закономірності</h3><p>За останні 30 днів · {list.length} {plural(list.length, 'запис', 'записи', 'записів')}</p></div></div>
      <div className="kv">
        <div><div className="muted" style={{ fontSize: 12 }}>Середній настрій</div><div className="num" style={{ fontSize: 24, fontWeight: 600, color: moodColor(all) }}>{all.toFixed(1)}<small className="muted" style={{ fontSize: 13 }}>/10</small></div></div>
        <div><div className="muted" style={{ fontSize: 12 }}>Цей тиждень</div><div className="num" style={{ fontSize: 24, fontWeight: 600 }}>{wk ? wk.toFixed(1) : '—'}{delta !== 0 && <span className={`delta ${delta > 0 ? 'up' : 'dn'}`} style={{ marginLeft: 8 }}>{delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}</span>}</div></div>
        <div><div className="muted" style={{ fontSize: 12 }}>Найкращий час</div><div style={{ fontSize: 20, fontWeight: 600 }}>{best ? best.l : '—'}</div></div>
      </div>
      <div className="cats" style={{ marginTop: 16 }}>
        {parts.map(p => <div className="catrow" key={p.l}><span>{p.l}</span><div className="bar"><i style={{ width: (p.v / 10) * 100 + '%', background: moodColor(p.v) }} /></div><span className="num" style={{ textAlign: 'right' }}>{p.n ? p.v.toFixed(1) : '—'}</span></div>)}
      </div>
      {(up.length > 0 || down.length > 0) && (
        <div className="moodtags">
          {up.length > 0 && <div><div className="muted" style={{ fontSize: 12 }}>Піднімає настрій</div><div className="tags small">{up.map(x => <span key={x.t} className="up">{x.t} +{x.d.toFixed(1)}</span>)}</div></div>}
          {down.length > 0 && <div><div className="muted" style={{ fontSize: 12 }}>Опускає настрій</div><div className="tags small">{down.map(x => <span key={x.t} className="dn">{x.t} {x.d.toFixed(1)}</span>)}</div></div>}
        </div>
      )}
      {energy.length > 1 && <p className="muted" style={{ fontSize: 12, margin: '12px 0 0' }}>Енергія і настрій: {energy.map(e => `${e.l.toLowerCase()} → ${e.v.toFixed(1)}`).join(' · ')}</p>}
    </>
  );
}

export function Health() {
  const { S } = useStore();
  const [moodDay, setMoodDay] = useState(TK);
  const [editing, setEditing] = useState<MoodEntry | null>(null);
  const formCard = useRef<HTMLDivElement>(null);
  const startEdit = (m: MoodEntry) => { setEditing(m); setTimeout(() => formCard.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 0); };
  const keys = [...Array(14)].map((_, i) => ymd(addD(new Date(), i - 13)));
  const days = keys.map(k => S.health[k]);
  const ser = (f: 'sleep') => days.map(d => (d ? d[f] : 0));
  const av = (f: Parameters<typeof ser>[0]) => avg(ser(f).filter(x => x > 0));
  const moods = keys.map(k => dayMood(S, k)), moodAv = avg(moods.filter(x => x > 0));
  // average clock time; times after noon count as the evening before so 23:30 and 00:30 average to midnight
  const avgTime = (f: 'bed' | 'wake') => {
    const ms = days.map(d => d?.[f]).filter(Boolean).map(t => { const m = toMin(t!); return f === 'bed' && m < 720 ? m + 1440 : m; });
    if (!ms.length) return '—';
    const m = Math.round(avg(ms)) % 1440; return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
  };
  return (
    <section className="view">
      <div className="vh"><div><h2>Здоровʼя</h2><p>Відмічай щодня. Настрій можна записувати кілька разів на день. Графіки показують останні 14 днів.</p></div></div>
      <div className="card" style={{ marginTop: 18 }}><LifeTiles full /></div>
      <div className="grid" style={{ marginTop: 18 }}>
        <div className="card s5" ref={formCard}>
          <div className="ch"><div><h3>{editing ? 'Змінити запис' : 'Як ти зараз?'}</h3><p>{editing ? `Запис від ${new Date(editing.t).getDate()} ${MON[new Date(editing.t).getMonth()]}, ${hhmm(new Date(editing.t))}` : 'Запиши настрій з часом і деталями'}</p></div></div>
          <MoodForm key={editing?.id ?? 'new'} edit={editing} onDone={() => setEditing(null)} />
        </div>
        <div className="card s7"><MoodLog k={moodDay} setK={setMoodDay} onEdit={startEdit} /></div>
        <div className="card s5"><MoodMonth k={moodDay} setK={setMoodDay} /></div>
        <div className="card s7"><MoodInsights /></div>
        <div className="card s6"><div className="ch"><div><h3>Настрій</h3><p>Середній настрій {moodAv.toFixed(1)} з 10</p></div></div><Bars vals={moods.map(v => Math.round(v * 10) / 10)} max={10} color={v => moodColor(v)} unit="/10" /></div>
        <div className="card s6"><div className="ch"><div><h3>Сон</h3><p>У середньому {av('sleep').toFixed(1)} год · засинаєш о {avgTime('bed')}, прокидаєшся о {avgTime('wake')}</p></div></div><Bars vals={ser('sleep')} max={12} color="var(--sleep)" target={8} unit=" год" /></div>      </div>
    </section>
  );
}

/* ---------------- Goals ---------------- */
/** One goal: progress, its steps or number, the tasks that move it, and editing. */
function GoalItem({ g }: { g: Goal }) {
  const { S, A, update, go } = useStore();
  const [edit, setEdit] = useState(false);
  const [e, setE] = useState({ title: g.title, target: String(g.target || ''), unit: g.unit, due: g.due, area: g.area });
  const [step, setStep] = useState('');
  const [task, setTask] = useState('');
  const steps = g.steps || [], bySteps = steps.length > 0 || !g.target;
  const prog = goalProgress(g), done = prog >= 1 && (steps.length > 0 || g.target > 0), left = g.due ? daysTo(g.due) : null;
  const tasks = S.tasks.filter(t => t.goal === g.id && !t.d);
  const save = () => { A.updateGoal(g.id, { title: e.title.trim() || g.title, target: Math.max(0, +e.target || 0), unit: e.unit.trim(), due: e.due, area: e.area }); setEdit(false); };
  return (
    <div className="goal">
      <div className="row" style={{ flexWrap: 'nowrap' }}><b className="t" style={{ flex: 1, minWidth: 0 }}>{g.title}</b><span className={`tag ${done ? 'ok' : ''}`}>{done ? 'Досягнуто' : g.area}</span></div>
      <div className="bar"><i style={{ width: prog * 100 + '%', background: done ? 'var(--good)' : 'var(--accent)' }} /></div>
      <div className="row">
        <span className="num">{bySteps ? `${steps.filter(s => s.d).length} з ${steps.length} кроків` : `${fmtN(g.cur)} / ${fmtN(g.target)} ${g.unit}`}</span>
        <span className="muted" style={{ fontSize: 12 }}>{left === null ? 'без дедлайну' : left < 0 ? 'термін минув' : left === 0 ? 'дедлайн сьогодні' : 'ще ' + left + ' дн'}</span>
        <span className="row" style={{ marginLeft: 'auto', gap: 6 }}>
          {!bySteps && <><button className="sqb" aria-label="Зменшити прогрес" onClick={() => A.stepGoal(g.id, -1)}>−</button><button className="sqb" onClick={() => A.stepGoal(g.id, 1)}>+{fmtN(goalStep(g.target))}</button></>}
          <button className="sqb" onClick={() => setEdit(!edit)}>{edit ? 'Закрити' : 'Змінити'}</button>
          <DelBtn label="Видалити ціль" onDelete={() => A.delGoal(g.id)} />
        </span>
      </div>
      {(bySteps || edit) && (
        <div className="gsteps">
          {steps.map(s => (
            <div className={`item ${s.d ? 'done' : ''}`} key={s.id}>
              <button className={`chk ${s.d ? 'on' : ''}`} aria-pressed={s.d} aria-label={`Крок: ${s.t}`} onClick={() => A.toggleStep(g.id, s.id)}>{s.d && <Icon n="check" />}</button>
              <span className="t">{s.t}</span>
              <button className="x" aria-label="Видалити крок" onClick={() => A.delStep(g.id, s.id)}><Icon n="x" /></button>
            </div>
          ))}
          <input className="gin" placeholder="+ крок, напр. «написати їй у неділю»" value={step} onChange={x => setStep(x.target.value)} onKeyDown={x => { if (x.key === 'Enter') { x.preventDefault(); A.addStep(g.id, step); setStep(''); } }} aria-label="Додати крок до цілі" />
        </div>
      )}
      <div className="gtasks">
        <span className="muted" style={{ fontSize: 12 }}>Задачі для цілі{tasks.length ? '' : ': поки немає'}</span>
        {tasks.map(t => (
          <div className="item" key={t.id}>
            <button className="chk" aria-label="Виконано" onClick={() => A.toggleTask(t.id)} />
            <span className="t">{t.t}</span>{t.p === 'hi' && <span className="tag">Важливо</span>}
            <button className="x" title="Фокус на задачі" aria-label="Фокус на задачі" onClick={() => { update(s => { s.timer.task = t.t; }); go('focus'); }}><Icon n="focus" /></button>
          </div>
        ))}
        <input className="gin" placeholder="+ задача, напр. «написати 5 бізнесам»" value={task} onChange={x => setTask(x.target.value)} onKeyDown={x => { if (x.key === 'Enter') { x.preventDefault(); A.addTask(task, 'hi', g.id); setTask(''); } }} aria-label="Додати задачу для цілі" />
      </div>
      {edit && (
        <div className="gedit">
          <label className="field" htmlFor={`gt${g.id}`}>Назва<input id={`gt${g.id}`} value={e.title} onChange={x => setE({ ...e, title: x.target.value })} /></label>
          <div className="row">
            <label className="field" htmlFor={`gn${g.id}`} style={{ flex: '1 1 90px' }}>Скільки (0 = по кроках)<input id={`gn${g.id}`} type="number" min="0" value={e.target} onChange={x => setE({ ...e, target: x.target.value })} /></label>
            <label className="field" htmlFor={`gu${g.id}`} style={{ flex: '1 1 90px' }}>Одиниця<input id={`gu${g.id}`} value={e.unit} onChange={x => setE({ ...e, unit: x.target.value })} /></label>
            <label className="field" htmlFor={`gd${g.id}`} style={{ flex: '1 1 140px' }}>Дедлайн<input id={`gd${g.id}`} type="date" value={e.due} onChange={x => setE({ ...e, due: x.target.value })} /></label>
            <label className="field" htmlFor={`ga${g.id}`} style={{ flex: '1 1 120px' }}>Сфера<select id={`ga${g.id}`} value={e.area} onChange={x => setE({ ...e, area: x.target.value })}>{AREAS.map(a => <option key={a}>{a}</option>)}</select></label>
          </div>
          <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={save}>Зберегти</button>
        </div>
      )}
    </div>
  );
}

export function Goals() {
  const { S, A, update } = useStore();
  const [v, setV] = useState({ title: '', target: '', unit: '', area: AREAS[0], due: '', steps: '' });
  const [how, setHow] = useState<'num' | 'steps'>('steps');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!v.title.trim()) return;
    const steps = how === 'steps' ? v.steps.split('\n').map(s => s.trim()).filter(Boolean) : [];
    const t = how === 'num' ? +v.target : 0; if (how === 'num' && !(t > 0)) return;
    A.addGoal({ title: v.title.trim(), area: v.area, target: t, unit: how === 'num' ? v.unit.trim() : '', due: v.due, steps });
    setV({ ...v, title: '', target: '', unit: '', steps: '' });
  };
  const weakest = AREAS[S.wheel.indexOf(Math.min(...S.wheel))];
  return (
    <section className="view">
      <div className="vh"><div><h2>Цілі та баланс</h2><p>Великі цілі з прогресом і колесо балансу життя.</p></div></div>
      <div className="grid" style={{ marginTop: 18 }}>
        <div className="card s7">
          <form style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={submit}>
            <label className="field" htmlFor="gTitle">Нова ціль<input id="gTitle" required placeholder="Напр. Перший клієнт для WebHjerte" autoComplete="off" value={v.title} onChange={e => setV({ ...v, title: e.target.value })} /></label>
            <div className="field"><span>Як міряти прогрес</span>
              <div className="seg" style={{ alignSelf: 'flex-start' }}>
                <button type="button" aria-pressed={how === 'steps'} onClick={() => setHow('steps')}>Кроками</button>
                <button type="button" aria-pressed={how === 'num'} onClick={() => setHow('num')}>Числом</button>
              </div>
            </div>
            {how === 'steps' ? (
              <label className="field" htmlFor="gSteps">Кроки, по одному в рядку
                <textarea id="gSteps" rows={3} placeholder={'Скласти список 20 потенційних клієнтів\nНаписати 5 бізнесам\nВідправити пропозицію'} value={v.steps} onChange={e => setV({ ...v, steps: e.target.value })} />
              </label>
            ) : (
              <div className="row">
                <label className="field" htmlFor="gTarget" style={{ flex: '1 1 90px' }}>Скільки<input id="gTarget" type="number" min="1" required placeholder="21" value={v.target} onChange={e => setV({ ...v, target: e.target.value })} /></label>
                <label className="field" htmlFor="gUnit" style={{ flex: '1 1 90px' }}>Одиниця<input id="gUnit" placeholder="км" autoComplete="off" value={v.unit} onChange={e => setV({ ...v, unit: e.target.value })} /></label>
              </div>
            )}
            <div className="row">
              <label className="field" htmlFor="gArea" style={{ flex: '1 1 120px' }}>Сфера<select id="gArea" value={v.area} onChange={e => setV({ ...v, area: e.target.value })}>{AREAS.map(a => <option key={a}>{a}</option>)}</select></label>
              <label className="field" htmlFor="gDue" style={{ flex: '1 1 140px' }}>Дедлайн<input id="gDue" type="date" value={v.due} onChange={e => setV({ ...v, due: e.target.value })} /></label>
            </div>
            <button className="btn" style={{ alignSelf: 'flex-start' }}>Додати ціль</button>
          </form>
          <div style={{ marginTop: 12 }}>
            {S.goals.map(g => <GoalItem key={g.id} g={g} />)}
            {!S.goals.length && <p className="muted">Цілей поки немає. Додай першу вище.</p>}
          </div>
        </div>
        <div className="card s5">
          <div className="ch"><Icon n="life" className="ic" /><div><h3>Колесо балансу</h3><p>Оціни кожну сферу від 1 до 10</p></div></div>
          <Radar vals={S.wheel} />
          <p className="muted" style={{ fontSize: 12 }}>Середній бал {(sum(S.wheel) / 8).toFixed(1)} з 10. Найбільше уваги потребує: {weakest}.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {AREAS.map((a, i) => (
              <label className="sl" htmlFor={'wl' + i} key={a}><span>{a}</span>
                <input type="range" id={'wl' + i} min="1" max="10" value={S.wheel[i]} onChange={e => update(s => { s.wheel[i] = +e.target.value; })} />
                <b className="num">{S.wheel[i]}</b>
              </label>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Schedule ---------------- */
type CalView = 'day' | 'week' | 'month';
const HOUR = 44;

export function Schedule() {
  const { S, A, eventsOn, cal, refreshCal, go, now, setSheet } = useStore();
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
          <button className="btn" style={{ alignSelf: 'flex-start' }}>Додати подію</button>
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

/* ---------------- Notes ---------------- */
const noteTitle = (n: Note) => n.title.trim() || n.text.trim().split('\n')[0].slice(0, 60) || 'Без назви';
const noteDate = (t: number) => { const d = new Date(t); return ymd(d) === TK() ? hhmm(d) : `${d.getDate()} ${MON[d.getMonth()].slice(0, 3)}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`; };

/** Editor of one note. Changes are saved after a short pause and when another note is opened. */
function NoteEditor({ note, onBack }: { note: Note; onBack: () => void }) {
  const { A } = useStore();
  const [v, setV] = useState({ title: note.title, text: note.text });
  const [saved, setSaved] = useState('');
  const latest = useRef(v);
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => { A.saveNote(note.id, latest.current); dirty.current = false; setSaved(`Збережено о ${hhmm(new Date())}`); }, 400);
    return () => clearTimeout(t);
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (dirty.current) A.saveNote(note.id, latest.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const change = (p: Partial<typeof v>) => { dirty.current = true; latest.current = { ...v, ...p }; setV(latest.current); };
  return (
    <div className="noteed">
      <div className="row" style={{ gap: 8 }}>
        <button className="btn ghost noteback" onClick={onBack}><Icon n="left" />Усі нотатки</button>
        <span className="muted" style={{ fontSize: 12, marginLeft: 'auto' }}>{saved || `Змінено ${noteDate(note.updated)}`}</span>
        <button className="x" title={note.pinned ? 'Відкріпити' : 'Закріпити вгорі'} aria-pressed={!!note.pinned} aria-label="Закріпити нотатку" style={note.pinned ? { color: 'var(--accent)', opacity: 1 } : undefined} onClick={() => A.pinNote(note.id)}><Icon n="pin" /></button>
        <DelBtn label="Видалити нотатку" onDelete={() => { dirty.current = false; A.delNote(note.id); onBack(); }} />
      </div>
      <input className="notetitle" placeholder="Назва" value={v.title} onChange={e => change({ title: e.target.value })} aria-label="Назва нотатки" />
      <textarea className="notetext" placeholder="Думки, ідеї, конспект…" value={v.text} onChange={e => change({ text: e.target.value })} aria-label="Текст нотатки" autoFocus={!note.text && !note.title} />
    </div>
  );
}

export function Notes() {
  const { S, A } = useStore();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<number | null>(() => (typeof window !== 'undefined' && window.innerWidth > 760 ? S.noteList[0]?.id ?? null : null));
  const ql = q.trim().toLowerCase();
  const list = S.noteList
    .filter(n => !ql || (n.title + '\n' + n.text).toLowerCase().includes(ql))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updated - a.updated);
  const cur = S.noteList.find(n => n.id === sel) || null;
  // a note left empty is dropped when another one is opened
  const open = (id: number | null) => { if (cur && cur.id !== id) { const old = cur.id; setTimeout(() => A.dropEmptyNote(old), 0); } setSel(id); };
  return (
    <section className="view">
      <div className="vh">
        <div><h2>Нотатки</h2><p>{S.noteList.length ? `${S.noteList.length} ${plural(S.noteList.length, 'нотатка', 'нотатки', 'нотаток')}. Зберігаються автоматично.` : 'Зберігаються автоматично.'}</p></div>
        <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => { setQ(''); open(A.addNote('')); }}><Icon n="plus" />Нова нотатка</button>
      </div>
      <div className={`card notesapp${cur ? ' open' : ''}`} style={{ marginTop: 18 }}>
        <div className="notelist">
          <input className="notesearch" type="search" placeholder="Пошук у нотатках" value={q} onChange={e => setQ(e.target.value)} aria-label="Пошук у нотатках" />
          {list.map(n => (
            <button key={n.id} className={`noteitem${n.id === sel ? ' on' : ''}`} onClick={() => open(n.id)}>
              <b>{n.pinned && <Icon n="pin" />}{noteTitle(n)}</b>
              <span className="muted">{noteDate(n.updated)} · {(n.title.trim() ? n.text : n.text.split('\n').slice(1).join(' ')).trim().slice(0, 90) || 'Порожньо'}</span>
            </button>
          ))}
          {!list.length && <p className="muted" style={{ padding: '8px 4px', fontSize: 13 }}>{ql ? 'Нічого не знайдено.' : 'Нотаток поки немає. Натисни «Нова нотатка».'}</p>}
        </div>
        {cur ? <NoteEditor key={cur.id} note={cur} onBack={() => open(null)} /> : <div className="noteempty muted">Вибери нотатку зліва або створи нову.</div>}
      </div>
    </section>
  );
}
