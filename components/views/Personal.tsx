'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { goalStep, useStore } from '@/lib/store';
import { addD, AREAS, CATS, COLORS, daysInMonth, daysTo, DN, fmt, fmtN, hmPlain, MON, MONTHN, money, MOODC, pad2, pctW, plural, sod, sum, TK, toMin, WD, weekdayIdx, wStart, ymd } from '@/lib/util';
import { Icon } from '../Icon';
import { Bars, Radar } from '../charts';
import { avg, CatBars, DelBtn, habStreak, LifeTiles, monthTx, sumT } from '../shared';

/* ---------------- Focus ---------------- */
export function Focus() {
  const { S, update, timerLeft, toggleTimer, resetTimer, setTimerMode, completeTimer, durOf } = useStore();
  const T = S.timer, dur = durOf(T.mode), C = 552.9;
  const a = sod(new Date()).getTime(), today = S.sessions.filter(s => s.t >= a);
  const recent = [...S.sessions].sort((x, y) => y.t - x.t).slice(0, 12);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement?.tagName || '')) { e.preventDefault(); toggleTimer(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggleTimer]);
  return (
    <section className="view">
      <div className="vh"><div><h2>Фокус</h2><p>Таймер Помодоро. Завершені сесії одразу йдуть у статистику. Пробіл: старт і пауза.</p></div></div>
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
              {S.tasks.filter(t => !t.d).map(t => <option key={t.id} value={t.t}>{t.t}</option>)}
            </select>
          </label>
          <div className="kv">
            <div><div className="muted" style={{ fontSize: 12 }}>Сьогодні</div><div className="num" style={{ fontSize: 24, fontWeight: 600 }}>{hmPlain(sum(today.map(s => s.m)))}</div></div>
            <div><div className="muted" style={{ fontSize: 12 }}>Сесій сьогодні</div><div className="num" style={{ fontSize: 24, fontWeight: 600 }}>{today.length}</div></div>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Журнал сесій</div>
          <div className="list log">
            {recent.map(s => { const d = new Date(s.t); return <div className="item" key={s.t}><span className="sw c1" /><span className="t">{DN[weekdayIdx(d)]}, {pad2(d.getHours())}:{pad2(d.getMinutes())}</span><span className="num">{s.m} хв</span></div>; })}
            {!recent.length && <p className="muted">Ще немає сесій. Натисни «Старт».</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Tasks ---------------- */
export function Tasks() {
  const { S, A, update, go } = useStore();
  const [f, setF] = useState<'open' | 'done' | 'all'>('open');
  const [text, setText] = useState('');
  const [pri, setPri] = useState<'hi' | 'lo'>('lo');
  const open = S.tasks.filter(t => !t.d).length;
  const list = S.tasks.filter(t => f === 'all' || (f === 'done' ? t.d : !t.d)).sort((a, b) => (a.p === 'hi' ? 0 : 1) - (b.p === 'hi' ? 0 : 1));
  const submit = (e: FormEvent) => { e.preventDefault(); A.addTask(text, pri); setText(''); };
  return (
    <section className="view">
      <div className="vh"><div><h2>Задачі</h2><p>{open} відкритих із {S.tasks.length}</p></div></div>
      <div className="card" style={{ marginTop: 18 }}>
        <form className="row" onSubmit={submit}>
          <label className="field" htmlFor="taskIn" style={{ flex: '1 1 240px' }}>Нова задача<input id="taskIn" value={text} onChange={e => setText(e.target.value)} placeholder="Напр. Підготувати презентацію" autoComplete="off" /></label>
          <label className="field" htmlFor="taskPri">Пріоритет<select id="taskPri" value={pri} onChange={e => setPri(e.target.value as 'hi' | 'lo')}><option value="hi">Важливо</option><option value="lo">Звичайно</option></select></label>
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
              {t.p === 'hi' && <span className="tag">Важливо</span>}
              <button className="x" title="Фокус на задачі" aria-label="Фокус на задачі" onClick={() => { update(s => { s.timer.task = t.t; }); go('focus'); }}><Icon n="focus" /></button>
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
  const { S, A } = useStore();
  const [name, setName] = useState('');
  const ws = wStart(), ti = weekdayIdx(), k = TK(), now = new Date();
  const done = S.habits.filter(h => h.days[k]).length;
  let cnt = 0;
  S.habits.forEach(h => { for (let i = 0; i <= ti; i++) if (h.days[ymd(addD(ws, i))]) cnt++; });
  const wp = S.habits.length ? Math.round((cnt / (S.habits.length * (ti + 1))) * 100) : 0;
  return (
    <section className="view">
      <div className="vh"><div><h2>Звички</h2><p>{done} з {S.habits.length} сьогодні · {wp}% виконання за тиждень</p></div></div>
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
                  <span className="t">{h.name}</span>
                  {DN.map((d, i) => {
                    const day = addD(ws, i), key = ymd(day), on = !!h.days[key];
                    return <button key={d} className={`hc ${on ? 'on' : ''}`} disabled={day > now} aria-pressed={on} aria-label={`${h.name}, ${d}`} onClick={() => A.toggleHabit(h.id, key)}>{on && <Icon n="check" />}</button>;
                  })}
                  <span className="num" style={{ textAlign: 'center' }}>{habStreak(h.days)} дн</span>
                  <DelBtn label="Видалити звичку" onDelete={() => A.delHabit(h.id)} />
                </div>
              ))}
            </>
          ) : <p className="muted">Звичок поки немає. Додай першу вище.</p>}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Health ---------------- */
export function Health() {
  const { S } = useStore();
  const days = [...Array(14)].map((_, i) => S.health[ymd(addD(new Date(), i - 13))]);
  const ser = (f: 'sleep' | 'mood' | 'water' | 'steps' | 'workout') => days.map(d => (d ? d[f] : 0));
  const av = (f: Parameters<typeof ser>[0]) => avg(ser(f).filter(x => x > 0));
  return (
    <section className="view">
      <div className="vh"><div><h2>Здоровʼя</h2><p>Відмічай щодня. Графіки показують останні 14 днів.</p></div></div>
      <div className="card" style={{ marginTop: 18 }}><LifeTiles full /></div>
      <div className="grid" style={{ marginTop: 18 }}>
        <div className="card s4"><div className="ch"><div><h3>Сон</h3><p>У середньому {av('sleep').toFixed(1)} год</p></div></div><Bars vals={ser('sleep')} max={12} color="var(--sleep)" target={8} unit=" год" /></div>
        <div className="card s4"><div className="ch"><div><h3>Настрій</h3><p>Середній настрій {av('mood').toFixed(1)} з 5</p></div></div><Bars vals={ser('mood')} max={5} color={v => (v ? MOODC[Math.round(v) - 1] : 'var(--bar)')} unit="/5" /></div>
        <div className="card s4"><div className="ch"><div><h3>Вода</h3><p>У середньому {av('water').toFixed(1)} склянок</p></div></div><Bars vals={ser('water')} max={12} color="var(--water)" target={8} unit=" скл." /></div>
        <div className="card s6"><div className="ch"><div><h3>Кроки</h3><p>У середньому {fmtN(Math.round(av('steps')))} кроків</p></div></div><Bars vals={ser('steps')} max={Math.max(10000, ...ser('steps'))} color="var(--accent)" target={8000} unit="" /></div>
        <div className="card s6"><div className="ch"><div><h3>Тренування</h3><p>{ser('workout').filter(x => x > 0).length} активних днів із 14</p></div></div><Bars vals={ser('workout')} max={Math.max(60, ...ser('workout'))} color="var(--good)" target={30} unit=" хв" /></div>
      </div>
    </section>
  );
}

/* ---------------- Money ---------------- */
export function Money() {
  const { S, A, update } = useStore();
  const [type, setType] = useState<'out' | 'in'>('out');
  const [amt, setAmt] = useState('');
  const [cat, setCat] = useState(CATS.out[0]);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(TK());
  const [budget, setBudget] = useState(String(S.money.budget));
  const n = new Date(), mt = monthTx(S), inc = sumT(mt, 'in'), out = sumT(mt, 'out'), b = S.money.budget, dl = daysInMonth() - n.getDate() + 1;
  const submit = (e: FormEvent) => { e.preventDefault(); A.addTx(type, +amt.replace(',', '.'), cat, note, date || TK()); setAmt(''); setNote(''); };
  return (
    <section className="view">
      <div className="vh"><div><h2>Фінанси</h2><p>{MONTHN[n.getMonth()]} {n.getFullYear()} · до кінця місяця {dl} дн · суми в данських кронах</p></div></div>
      <div className="grid" style={{ marginTop: 18 }}>
        {([['Дохід', money(inc), 'var(--good)'], ['Витрати', money(out), 'var(--ink)'], ['Баланс', money(inc - out), inc - out >= 0 ? 'var(--good)' : 'var(--m1)']] as const).map(([k, v, c]) => (
          <div key={k} className="card s3 stat"><div className="k">{k}</div><div className="v num" style={{ color: c }}>{v}</div></div>
        ))}
        <div className="card s3 stat">
          <div className="k">Залишок бюджету</div>
          <div className="v num" style={{ color: b - out < 0 ? 'var(--m1)' : 'var(--ink)' }}>{money(b - out)}</div>
          <div className="bar" style={{ marginTop: 10 }}><i style={{ width: pctW(out, b) + '%' }} /></div>
          <div className="k" style={{ marginTop: 6 }}>≈ {money(Math.max(0, b - out) / dl)} на день</div>
        </div>
      </div>
      <div className="grid" style={{ marginTop: 18 }}>
        <form className="card s5" style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={submit}>
          <div className="seg" style={{ alignSelf: 'flex-start' }}>
            {([['out', 'Витрата'], ['in', 'Дохід']] as const).map(([k, l]) => <button type="button" key={k} aria-pressed={type === k} onClick={() => { setType(k); setCat(CATS[k][0]); }}>{l}</button>)}
          </div>
          <div className="row">
            <label className="field" htmlFor="txAmt" style={{ flex: '1 1 120px' }}>Сума, kr.<input id="txAmt" type="number" min="1" step="any" inputMode="decimal" required placeholder="120" value={amt} onChange={e => setAmt(e.target.value)} /></label>
            <label className="field" htmlFor="txCat" style={{ flex: '1 1 140px' }}>Категорія<select id="txCat" value={cat} onChange={e => setCat(e.target.value)}>{CATS[type].map(c => <option key={c}>{c}</option>)}</select></label>
          </div>
          <label className="field" htmlFor="txNote">Коментар<input id="txNote" placeholder="Кава з друзями" autoComplete="off" value={note} onChange={e => setNote(e.target.value)} /></label>
          <div className="row">
            <label className="field" htmlFor="txDate" style={{ flex: '1 1 140px' }}>Дата<input id="txDate" type="date" required value={date} onChange={e => setDate(e.target.value)} /></label>
            <label className="field" htmlFor="budget" style={{ flex: '1 1 140px' }}>Бюджет на місяць, kr.<input id="budget" type="number" min="0" step="100" value={budget} onChange={e => setBudget(e.target.value)} onBlur={() => update(s => { s.money.budget = Math.max(0, +budget || 0); })} /></label>
          </div>
          <button className="btn" style={{ alignSelf: 'flex-start' }}>Записати</button>
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>Швидше: Ctrl K і введи «-45 кава».</p>
        </form>
        <div className="card s7"><div className="ch"><div><h3>Куди йдуть гроші</h3><p>Витрати за категоріями цього місяця</p></div></div><div className="cats"><CatBars tx={mt} limit={8} /></div></div>
        <div className="card s12">
          <div className="ch"><div><h3>Записи місяця</h3></div></div>
          <div className="list">
            {[...mt].sort((a, c) => c.date.localeCompare(a.date) || c.id - a.id).map(t => {
              const d = new Date(t.date + 'T00:00');
              return (
                <div className="item" key={t.id}>
                  <span className={`sw ${t.type === 'in' ? 'c3' : 'c1'}`} />
                  <span className="muted num" style={{ fontSize: 12, minWidth: 48 }}>{d.getDate()} {MON[d.getMonth()].slice(0, 3)}</span>
                  <span className="t">{t.cat}{t.note && <span className="muted"> · {t.note}</span>}</span>
                  <span className="num" style={{ fontWeight: 600, whiteSpace: 'nowrap', color: t.type === 'in' ? 'var(--good)' : 'var(--ink)' }}>{t.type === 'in' ? '+' : '−'}{money(t.amt)}</span>
                  <button className="x" aria-label="Видалити запис" onClick={() => A.delTx(t.id)}><Icon n="x" /></button>
                </div>
              );
            })}
            {!mt.length && <p className="muted">Записів цього місяця немає.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Goals ---------------- */
export function Goals() {
  const { S, A, update } = useStore();
  const [v, setV] = useState({ title: '', target: '', unit: '', area: AREAS[0], due: '' });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = +v.target; if (!v.title.trim() || !(t > 0)) return;
    A.addGoal({ title: v.title.trim(), area: v.area, target: t, unit: v.unit.trim(), due: v.due });
    setV({ ...v, title: '', target: '', unit: '' });
  };
  const weakest = AREAS[S.wheel.indexOf(Math.min(...S.wheel))];
  return (
    <section className="view">
      <div className="vh"><div><h2>Цілі та баланс</h2><p>Великі цілі з прогресом і колесо балансу життя.</p></div></div>
      <div className="grid" style={{ marginTop: 18 }}>
        <div className="card s7">
          <form style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={submit}>
            <label className="field" htmlFor="gTitle">Нова ціль<input id="gTitle" required placeholder="Напр. Пробігти напівмарафон" autoComplete="off" value={v.title} onChange={e => setV({ ...v, title: e.target.value })} /></label>
            <div className="row">
              <label className="field" htmlFor="gTarget" style={{ flex: '1 1 90px' }}>Скільки<input id="gTarget" type="number" min="1" required placeholder="21" value={v.target} onChange={e => setV({ ...v, target: e.target.value })} /></label>
              <label className="field" htmlFor="gUnit" style={{ flex: '1 1 90px' }}>Одиниця<input id="gUnit" placeholder="км" autoComplete="off" value={v.unit} onChange={e => setV({ ...v, unit: e.target.value })} /></label>
              <label className="field" htmlFor="gArea" style={{ flex: '1 1 120px' }}>Сфера<select id="gArea" value={v.area} onChange={e => setV({ ...v, area: e.target.value })}>{AREAS.map(a => <option key={a}>{a}</option>)}</select></label>
              <label className="field" htmlFor="gDue" style={{ flex: '1 1 140px' }}>Дедлайн<input id="gDue" type="date" value={v.due} onChange={e => setV({ ...v, due: e.target.value })} /></label>
            </div>
            <button className="btn" style={{ alignSelf: 'flex-start' }}>Додати ціль</button>
          </form>
          <div style={{ marginTop: 12 }}>
            {S.goals.map(g => {
              const done = g.cur >= g.target, left = g.due ? daysTo(g.due) : null;
              return (
                <div className="goal" key={g.id}>
                  <div className="row" style={{ flexWrap: 'nowrap' }}><b className="t" style={{ flex: 1, minWidth: 0 }}>{g.title}</b><span className={`tag ${done ? 'ok' : ''}`}>{done ? 'Досягнуто' : g.area}</span></div>
                  <div className="bar"><i style={{ width: pctW(g.cur, g.target) + '%', background: done ? 'var(--good)' : 'var(--accent)' }} /></div>
                  <div className="row">
                    <span className="num">{fmtN(g.cur)} / {fmtN(g.target)} {g.unit}</span>
                    <span className="muted" style={{ fontSize: 12 }}>{left === null ? '' : left < 0 ? 'термін минув' : left === 0 ? 'дедлайн сьогодні' : 'ще ' + left + ' дн'}</span>
                    <span className="row" style={{ marginLeft: 'auto', gap: 6 }}>
                      <button className="sqb" aria-label="Зменшити прогрес" onClick={() => A.stepGoal(g.id, -1)}>−</button>
                      <button className="sqb" onClick={() => A.stepGoal(g.id, 1)}>+{fmtN(goalStep(g.target))}</button>
                      <DelBtn label="Видалити ціль" onDelete={() => A.delGoal(g.id)} />
                    </span>
                  </div>
                </div>
              );
            })}
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
export function Schedule() {
  const { S, A, eventsOn, cal, refreshCal, go } = useStore();
  const [v, setV] = useState({ title: '', date: TK(), s: '10:00', e: '11:00', c: 'c1' });
  const [err, setErr] = useState('');
  const days = [...Array(14)].map((_, i) => ymd(addD(new Date(), i)));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (toMin(v.e) <= toMin(v.s)) { setErr('Кінець має бути пізніше за початок.'); return; }
    setErr('');
    if (A.addEvent({ ...v, title: v.title.trim() })) setV({ ...v, title: '' });
  };
  const hasCal = S.icalUrls.length > 0 || cal.state === 'ok';
  return (
    <section className="view">
      <div className="vh">
        <div><h2>Розклад</h2><p>Твої події і підключені календарі на 14 днів уперед.</p></div>
        <div className="row" style={{ marginLeft: 'auto' }}>
          <CalStatusChip />
          {hasCal ? <button className="btn ghost" onClick={refreshCal}><Icon n="refresh" />Оновити</button> : <button className="btn ghost" onClick={() => go('prefs')}><Icon n="link" />Підключити календар</button>}
        </div>
      </div>
      <div className="grid" style={{ marginTop: 18 }}>
        <form className="card s5" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignSelf: 'start' }} onSubmit={submit}>
          <label className="field" htmlFor="evTitle">Назва<input id="evTitle" required placeholder="Лекція, зустріч, спорт…" autoComplete="off" value={v.title} onChange={e => setV({ ...v, title: e.target.value })} /></label>
          <label className="field" htmlFor="evDate">Дата<input type="date" id="evDate" required value={v.date} onChange={e => setV({ ...v, date: e.target.value })} /></label>
          <div className="row">
            <label className="field" htmlFor="evStart" style={{ flex: 1 }}>Початок<input type="time" id="evStart" required value={v.s} onChange={e => setV({ ...v, s: e.target.value })} /></label>
            <label className="field" htmlFor="evEnd" style={{ flex: 1 }}>Кінець<input type="time" id="evEnd" required value={v.e} onChange={e => setV({ ...v, e: e.target.value })} /></label>
          </div>
          <label className="field" htmlFor="evColor">Колір<select id="evColor" value={v.c} onChange={e => setV({ ...v, c: e.target.value })}>{COLORS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          {err && <p className="muted" style={{ margin: 0, fontSize: 12, color: 'var(--m1)' }}>{err}</p>}
          <button className="btn" style={{ alignSelf: 'flex-start' }}>Додати подію</button>
          <p className="help">Події з підключених календарів позначені «Календар». Їх змінюють у самому календарі, тут вони лише для перегляду.</p>
        </form>
        <div className="card s7">
          <div className="list">
            {days.map((d, di) => {
              const evs = eventsOn(d); if (!evs.length) return null;
              const dt = new Date(d + 'T00:00');
              return (
                <div key={d}>
                  <div className="muted" style={{ fontSize: 12, margin: `${di ? 16 : 0}px 0 4px` }}>{d === TK() ? 'Сьогодні' : WD[dt.getDay()]}, {dt.getDate()} {MON[dt.getMonth()]}</div>
                  {evs.map(e => (
                    <div className="item" key={e.id}>
                      <span className={`sw ${e.ext ? 'c4' : e.c}`} style={e.ext ? { background: 'var(--cal)' } : undefined} />
                      <span className="num muted" style={{ fontSize: 12, minWidth: 82 }}>{e.allDay ? 'Весь день' : `${e.s}–${e.e}`}</span>
                      <span className="t">{e.title}{e.location && <span className="muted"> · {e.location}</span>}</span>
                      {e.ext ? <span className="pillst cal">Календар</span> : <button className="x" aria-label="Видалити подію" onClick={() => A.delEvent(e.localId!)}><Icon n="x" /></button>}
                    </div>
                  ))}
                </div>
              );
            })}
            {days.every(d => !eventsOn(d).length) && <p className="muted">На найближчі два тижні подій немає.</p>}
          </div>
        </div>
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
export function Notes() {
  const { S, update } = useStore();
  const [text, setText] = useState(S.notes);
  const [saved, setSaved] = useState('');
  useEffect(() => {
    if (text === S.notes) return;
    const t = setTimeout(() => { update(s => { s.notes = text; }); const n = new Date(); setSaved(`Збережено о ${pad2(n.getHours())}:${pad2(n.getMinutes())}`); }, 400);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="view">
      <div className="vh"><div><h2>Нотатки</h2><p>{saved || 'Зберігаються автоматично в цьому браузері.'}</p></div></div>
      <textarea className="notes" style={{ marginTop: 18 }} placeholder="Думки, ідеї, конспект…" value={text} onChange={e => setText(e.target.value)} aria-label="Нотатки" />
    </section>
  );
}

