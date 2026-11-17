'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ACT_KINDS } from '@/lib/score';
import { liveSessions, timerLeftAt, useNow, useStore } from '@/lib/store';
import { goalFocusOn, goalTasks } from '@/lib/goals';
import { WoltCard } from '../Wolt';
import { addD, DN, fmt, hhmm, hmPlain, MON, pad2, pctW, sod, sum, TK, WD, weekdayIdx, ymd } from '@/lib/util';
import { Icon } from '../Icon';
import { DelBtn, Empty, weekMinutes } from '../shared';

/* ---------------- Focus ---------------- */
/** One focus session a day goes to a goal: suggests the most important goal task until that is done. */
export function GoalSessionBanner({ compact = false }: { compact?: boolean }) {
  const { S, update, go, toggleTimer, setTimerMode } = useStore();
  const now = useNow(30_000);
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

type Tab = 'act' | 'manual' | 'log';

export function Focus() {
  const { S, A, update, toggleTimer, resetTimer, setTimerMode, completeTimer, durOf } = useStore();
  const now = useNow(1000, S.timer.running), timerLeft = timerLeftAt(S, now);
  const T = S.timer, dur = durOf(T.mode), C = 552.9;
  const all = liveSessions(S, now);
  const a = sod(new Date()).getTime(), today = all.filter(s => s.t >= a);
  const [more, setMore] = useState(false);
  const [tab, setTab] = useState<Tab>('act');
  const sorted = [...all].sort((x, y) => y.t - x.t), recent = more ? sorted.slice(0, 40) : sorted.slice(0, 6);
  const weekMin = Math.round(sum(weekMinutes({ ...S, sessions: all })));
  const weekGoal = Math.max(1, S.goal * 60), dayLabel = (t: number) => { const d = new Date(t), k = ymd(d); return k === TK() ? 'Сьогодні' : k === ymd(addD(new Date(), -1)) ? 'Вчора' : `${DN[weekdayIdx(d)]}, ${d.getDate()} ${MON[d.getMonth()]}`; };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement?.tagName || '')) { e.preventDefault(); toggleTimer(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggleTimer]);
  const goalOpts = goalTasks(S);
  return (
    <section className="view">
      <div className="vh"><div><h2>Фокус</h2><p>Таймер Помодоро. У статистику йде весь час фокусу, навіть якщо зупинився раніше. Пробіл: старт і пауза.</p></div></div>
      <GoalSessionBanner />
      <div className="grid focusgrid">
        <div className="card s7 timercard">
          <div className="seg">
            <button aria-pressed={T.mode === 'focus'} onClick={() => setTimerMode('focus')}>Фокус {S.focusMin}</button>
            <button aria-pressed={T.mode === 'break'} onClick={() => setTimerMode('break')}>Перерва {S.breakMin}</button>
          </div>
          <div className="timer">
            <div className="face">
              <svg viewBox="0 0 200 200" aria-hidden="true">
                <circle cx="100" cy="100" r="88" fill="none" stroke="var(--bar)" strokeWidth="10" />
                <circle cx="100" cy="100" r="88" fill="none" stroke={T.mode === 'focus' ? 'var(--accent)' : 'var(--good)'} strokeWidth="10" strokeLinecap="round" transform="rotate(-90 100 100)" strokeDasharray={C} strokeDashoffset={(C * (1 - timerLeft / dur)).toFixed(1)} />
              </svg>
              <div className="in"><small>{T.mode === 'focus' ? 'Фокус' : 'Перерва'}</small><b>{fmt(timerLeft)}</b><small>{T.task || (T.mode === 'focus' ? 'Без задачі' : 'Відпочинь, розімнись')}</small></div>
            </div>
          </div>
          <div className="row timerbtns">
            <button className="btn acc" onClick={toggleTimer}><Icon n={T.running ? 'pause' : 'play'} />{T.running ? 'Пауза' : timerLeft < dur ? 'Продовжити' : 'Старт'}</button>
            <button className="btn ghost" onClick={resetTimer}>Скинути</button>
            <button className="btn ghost" onClick={() => completeTimer(true)}>Пропустити</button>
          </div>
          <label className="field" htmlFor="tTaskSel">Над чим працюєш
            <select id="tTaskSel" value={T.task} onChange={e => update(s => { s.timer.task = e.target.value; })}>
              <option value="">Без задачі</option>
              {goalOpts.length > 0 && <optgroup label="Кроки до цілей">{goalOpts.map(t => <option key={t.id} value={t.t}>{t.t}</option>)}</optgroup>}
              <optgroup label="Інші задачі">{S.tasks.filter(t => !t.d && !goalOpts.includes(t)).map(t => <option key={t.id} value={t.t}>{t.t}</option>)}</optgroup>
            </select>
          </label>
        </div>

        <div className="card s5 cardcol">
          <div className="ch" style={{ margin: 0 }}><Icon n="clock" className="ic" /><div><h3>Сьогодні</h3><p>Скільки вже зроблено</p></div></div>
          <div className="kv k3">
            <div><span className="k">Фокус</span><span className="v num">{(m => m >= 60 ? <>{Math.floor(m / 60)}<small>г</small> {m % 60}<small>хв</small></> : <>{m}<small>хв</small></>)(Math.round(sum(today.map(s => s.m))))}</span></div>
            <div><span className="k">Сесій</span><span className="v num">{today.length}</span></div>
            <div><span className="k">За тиждень</span><span className="v num">{weekMin >= 60 && <>{Math.floor(weekMin / 60)}<small>г</small> </>}{weekMin % 60}<small>хв</small></span></div>
          </div>
          <div>
            <div className="bar"><i style={{ width: pctW(weekMin, weekGoal) + '%', background: weekMin >= weekGoal ? 'var(--good)' : 'var(--accent)' }} /></div>
            <p className="help" style={{ margin: '6px 0 0' }}>{weekMin >= weekGoal ? 'Ціль тижня виконано.' : `До цілі тижня (${S.goal} год) лишилось ${hmPlain(weekGoal - weekMin)}.`}</p>
          </div>
          <div className="ch" style={{ margin: '4px 0 -6px' }}><div><h3 style={{ fontSize: 14 }}>Журнал сесій</h3></div></div>
          <div className="list log">
            {recent.map(s => { const d = new Date(s.t); return <div className="item" key={s.t}><span className="sw c1" /><span className="t">{dayLabel(s.t)}, {pad2(d.getHours())}:{pad2(d.getMinutes())}{'live' in s && <span className="muted"> · триває</span>}</span><span className="num">{Math.round(s.m)} хв</span>{!('live' in s) && <DelBtn label="Видалити сесію" onDelete={() => A.delSession(s.t)} />}</div>; })}
            {!recent.length && <Empty icon="focus" title="Ще немає сесій" text="Натисни «Старт»: час фокусу запишеться сам." />}
          </div>
          {sorted.length > 6 && <button className="linkbtn" style={{ alignSelf: 'flex-start' }} onClick={() => setMore(!more)}>{more ? 'Показати менше' : 'Показати більше'}</button>}
        </div>

        <div className="card s12 cardcol">
          <div className="tabs" role="group" aria-label="Час поза фокусом">
            <button aria-pressed={tab === 'act'} onClick={() => setTab('act')}>Справи{S.act && <span className="cnt">●</span>}</button>
            <button aria-pressed={tab === 'manual'} onClick={() => setTab('manual')}>Додати вручну</button>
            <button aria-pressed={tab === 'log'} onClick={() => setTab('log')}>Журнал справ</button>
          </div>
          {tab === 'act' && <ActTimer />}
          {tab === 'manual' && <ManualTime />}
          {tab === 'log' && <ActLog />}
        </div>
        <div className="s12"><WoltCard /></div>
      </div>
    </section>
  );
}

const DAY_MS = 864e5;
const hms = (sec: number) => `${Math.floor(sec / 3600)}:${pad2(Math.floor(sec / 60) % 60)}:${pad2(sec % 60)}`;

/** Stopwatch for errands: start when you leave, stop when you are back. */
function ActTimer() {
  const { S, A, go } = useStore();
  const now = useNow(1000, !!S.act);
  const [kind, setKind] = useState(ACT_KINDS[0]);
  const [title, setTitle] = useState('');
  const a = S.act;
  return (
    <div className="cardcol">
      <p className="help" style={{ margin: 0 }}>Пішов у магазин чи по справах? Запусти відлік, щоб цей час не губився.</p>
      {a ? (
        <>
          <div className="actrun"><span className="dot" /><div><b>{a.kind}{a.title && <span className="muted"> · {a.title}</span>}</b><small>з {hhmm(new Date(a.start))}</small></div><span className="num">{hms(Math.max(0, Math.round((now - a.start) / 1000)))}</span></div>
          <div className="row">
            {a.kind === 'Wolt'
              ? <button className="btn acc" onClick={() => go('wolt')}><Icon n="check" />Завершити в Wolt</button>
              : <button className="btn acc" onClick={A.stopAct}><Icon n="check" />Завершити</button>}
            <button className="btn ghost" onClick={A.cancelAct}>Скасувати</button>
          </div>
        </>
      ) : (
        <>
          <div className="tags">{ACT_KINDS.map(k => <button type="button" key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{k}</button>)}</div>
          <label className="field" htmlFor="actTitle">Що саме (необовʼязково)<input id="actTitle" placeholder="Напр.: Netto, пошта, банк" value={title} onChange={e => setTitle(e.target.value)} autoComplete="off" /></label>
          <button className="btn acc startact" onClick={() => { A.startAct(kind, title); setTitle(''); }}><Icon n="play" />Почати відлік</button>
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
    <form className="cardcol" onSubmit={submit}>
      <p className="help" style={{ margin: 0 }}>Забув запустити таймер? Впиши, коли почав і закінчив.</p>
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
      <button className="btn acc startact">Додати</button>
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
    <div>
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
