'use client';

import { useEffect, useState } from 'react';
import { liveSessions, useStore } from '@/lib/store';
import { dayScore, freeTime, lastDays, scoreColor, scoreWord } from '@/lib/score';
import { addD, DAY, DN, hhmm, MON, MONTHN, money, pctW, plural, sod, toMin, TK, WD, weekdayIdx, wStart, ymd } from '@/lib/util';
import { Icon } from '../Icon';
import { FocusArea, Rhythm, Ring } from '../charts';
import { CatBars, dayMinutes, habStreak, LifeTiles, monthTx, streak, sumT, weekMinutes } from '../shared';

const QUOTES: [string, string, string][] = [['Маленькі кроки', 'щодня', 'дають великий результат.'], ['Фокус —', 'це вміння', 'сказати «ні» зайвому.'], ['Краще', 'зроблено,', 'ніж ідеально.'], ['Сьогоднішня', 'робота —', 'завтрашня свобода.']];

function greet(name: string) {
  const h = new Date().getHours();
  return (h < 5 ? 'Доброї ночі' : h < 12 ? 'Доброго ранку' : h < 18 ? 'Доброго дня' : 'Доброго вечора') + ', ' + name;
}

function NextEvent() {
  const { eventsOn, now } = useStore();
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

function Hero() {
  const { S, go } = useStore();
  const [qi, setQi] = useState(0);
  useEffect(() => { const t = setInterval(() => setQi(i => (i + 1) % QUOTES.length), 7000); return () => clearInterval(t); }, []);
  const q = QUOTES[qi];
  return (
    <div className="hero s8 hero-wrap">
      <div className="sun" />
      <svg className="hills" viewBox="0 0 800 160" preserveAspectRatio="none"><path d="M0 120 L90 80 L170 110 L260 60 L360 105 L430 85 L520 118 L610 70 L700 100 L800 80 L800 160 L0 160Z" fill="#170C07" opacity=".55" /><path d="M0 140 L120 110 L220 135 L330 100 L450 140 L560 115 L680 140 L800 120 L800 160 L0 160Z" fill="#0F0805" /></svg>
      <div className="eyebrow">{greet(S.name)}{S.demo && <span className="demo">Демо-дані</span>}</div>
      <h1>Зроби сьогодні вартим</h1>
      <p>Фокус, звички, здоровʼя, гроші й цілі в одному місці. Все рахується наживо.</p>
      <NextEvent />
      <button className="cta" onClick={() => go('focus')}>Почати фокус <Icon n="arrow" /></button>
      <div className="glass g-cap" aria-hidden="true"><Icon n="cap" /></div>
      <div className="glass g-quote"><q>{q[0]} <span>{q[1]}</span> {q[2]}</q><div className="prog"><i key={qi} style={{ width: '100%', transition: 'width 7s linear' }} /></div></div>
    </div>
  );
}

export function SchedCard() {
  const { eventsOn, now, go } = useStore();
  const [day, setDay] = useState(() => sod(new Date()));
  const isToday = ymd(day) === TK();
  const H0 = 8 * 60, H1 = 20 * 60, span = H1 - H0;
  const all = eventsOn(ymd(day)), allDay = all.filter(e => e.allDay), timed = all.filter(e => !e.allDay);
  const lanes: number[] = [];
  const n = new Date(now), m = n.getHours() * 60 + n.getMinutes();
  return (
    <div className="sched s4 sched-wrap">
      <div className="hd">
        <b>{WD[day.getDay()].slice(0, 3)}, {day.getDate()} {MON[day.getMonth()]}</b>
        <button className="chip" style={{ opacity: isToday ? 1 : 0.7 }} onClick={() => setDay(sod(new Date()))}>Сьогодні</button>
        <button className="rnd" aria-label="Попередній день" onClick={() => setDay(d => addD(d, -1))}><Icon n="left" /></button>
        <button className="rnd" aria-label="Наступний день" onClick={() => setDay(d => addD(d, 1))}><Icon n="right" /></button>
      </div>
      {allDay.length > 0 && <div className="allday">{allDay.map(e => <span key={e.id} title={e.title}>{e.title}</span>)}</div>}
      <div className="tlwrap" style={{ flex: 1, display: 'flex', overflowX: 'auto', position: 'relative', zIndex: 1 }}>
        <div className="tl">
          <div className="hours">{['08', '10', '12', '14', '16', '18', '20'].map(h => <span key={h}>{h}:00</span>)}</div>
          {timed.map(e => {
            const s = Math.max(toMin(e.s), H0), en = Math.min(Math.max(toMin(e.e), s + 30), H1);
            if (en <= H0 || s >= H1) return null;
            let lane = lanes.findIndex(x => x <= s); if (lane < 0) { lane = lanes.length; lanes.push(0); } lanes[lane] = en;
            const lp = ((s - H0) / span) * 100, wp = Math.max(((en - s) / span) * 100, 17);
            return <div key={e.id} className={`ev ${e.ext ? 'ext' : e.c}`} title={e.location ? `${e.title} · ${e.location}` : e.title} style={{ left: Math.min(lp, 83) + '%', width: wp + '%', top: 24 + (lane % 3) * 42 }}>{e.title}<small>{e.s}–{e.e}</small></div>;
          })}
          {!all.length && <div className="empty">Подій немає. <button style={{ textDecoration: 'underline', color: 'inherit' }} onClick={() => go('schedule')}>Додати</button></div>}
          {isToday && m >= H0 && m <= H1 && <div className="now" style={{ left: ((m - H0) / span) * 100 + '%' }} />}
        </div>
      </div>
      <svg className="ridge" viewBox="0 0 400 70" preserveAspectRatio="none"><path d="M0 50 L60 30 L110 46 L170 18 L240 44 L300 26 L360 40 L400 30 L400 70 L0 70Z" fill="var(--night-2)" /></svg>
    </div>
  );
}

function HeatMap() {
  const { S, now } = useStore();
  const ws = wStart().getTime(), grid = [...Array(5)].map(() => Array(28).fill(0) as number[]), n = new Date(now), ti = weekdayIdx(n);
  S.sessions.forEach(s => {
    const i = Math.floor((sod(s.t).getTime() - ws) / DAY); if (i < 0 || i > 6) return;
    let h = new Date(s.t).getHours(); h = (h + 24 - 6) % 24; if (h >= 20) return;
    grid[Math.floor(h / 4)][i * 4 + (h % 4)] += s.m;
  });
  const nh = (n.getHours() + 24 - 6) % 24;
  return (
    <div className="heat">
      <div className="ylab"><span>06:00</span><span>10:00</span><span>14:00</span><span>18:00</span><span>22:00</span></div>
      <div>
        <div className="dots">
          {grid.map((row, r) => row.map((mm, c) => {
            const l = mm >= 45 ? 3 : mm >= 25 ? 2 : mm > 0 ? 1 : 0;
            const isNow = nh < 20 && Math.floor(nh / 4) === r && c === ti * 4 + (nh % 4);
            return <i key={r + '-' + c} className={`${l ? 'l' + l : ''}${isNow ? ' nowcell' : ''}`} title={`${DN[Math.floor(c / 4)]}, ${String((6 + r * 4 + (c % 4)) % 24).padStart(2, '0')}:00 · ${mm} хв`} />;
          }))}
        </div>
        <div className="xlab">{DN.map((d, i) => <span key={d} className={i === ti ? 'today' : ''}>{d}</span>)}</div>
      </div>
      <div className="legend"><span><i style={{ background: 'var(--accent)' }} />Висока</span><span><i style={{ background: 'var(--accent-2)' }} />Середня</span><span><i style={{ background: 'var(--bar)' }} />Низька</span></div>
    </div>
  );
}

const hrs = (m: number) => { const h = m / 60; return h >= 10 || Number.isInteger(Math.round(h * 10) / 10) ? String(Math.round(h * 10) / 10) : (Math.round(h * 10) / 10).toFixed(1); };

/** Focus time against the free time left by the calendar, e.g. 5/7 hours. */
function FreeTimeCard() {
  const { S, eventsOn, now, go } = useStore();
  const live = liveSessions(S, now), k = TK();
  const t = freeTime(S, k, eventsOn(k), live, now);
  const pct = t.free ? Math.round((t.worked / t.free) * 100) : 0;
  const week = lastDays(7).map(d => ({ d, ...freeTime(S, d, eventsOn(d), live, now) }));
  const maxFree = Math.max(60, ...week.map(w => w.free));
  return (
    <div className="card s7">
      <div className="ch"><Icon n="clock" className="ic" /><div><h3>Вільний час і робота</h3><p>Скільки з вільних від календаря годин ти працював</p></div><button className="sel" onClick={() => go('prefs')}>День {S.dayStart}–{S.dayEnd}</button></div>
      <div className="bigstat"><span className="v num">{hrs(t.worked)}<small>/</small>{hrs(t.free)}<small>год</small></span><span className={`delta ${pct >= 60 ? 'up' : 'dn'}`}>{pct}%</span></div>
      <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
        День {hhmm(new Date(t.start))}–{hhmm(new Date(t.fullEnd))}{S.health[k]?.wake ? ' (від часу, коли прокинувся)' : ''}.{' '}
        {t.blockers.length
          ? <>Події забирають {hrs(t.busyDay)} год: {t.blockers.map(b => `${b.title} ${b.s}–${b.e}`).join(', ')}.</>
          : 'Подій у календарі на цей час немає.'}
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

/** Day score 0–100 with what it is made of. */
function ScoreCard() {
  const { S, eventsOn, now, go } = useStore();
  const live = liveSessions(S, now), k = TK();
  const sc = dayScore(S, k, eventsOn(k), live, now);
  const hist = lastDays(7).map(d => ({ d, v: d === k ? sc.total : dayScore(S, d, eventsOn(d), live, now).total }));
  const weak = [...sc.parts].sort((a, b) => a.got / a.max - b.got / b.max)[0];
  const to: Record<string, string> = { focus: 'focus', sleep: 'health', habits: 'habits', mood: 'health', money: 'money' };
  return (
    <div className="card s5">
      <div className="ch"><Icon n="trophy" className="ic" /><div><h3>Оцінка дня</h3><p>100 — усе супер, 0 — дуже погано</p></div></div>
      <div className="score">
        <div className="scorebig" style={{ ['--sc' as string]: scoreColor(sc.total) }}>
          <b className="num">{sc.total}</b><small>/100</small>
          <span>{scoreWord(sc.total)}</span>
        </div>
        <div className="scoreparts">
          {sc.parts.map(p => (
            <button key={p.key} className="sp" onClick={() => go(to[p.key])} title={p.hint}>
              <span>{p.label}</span>
              <div className="bar"><i style={{ width: (p.got / p.max) * 100 + '%', background: p.got / p.max >= 0.7 ? 'var(--good)' : p.got / p.max >= 0.4 ? 'var(--accent-2)' : 'var(--m1)' }} /></div>
              <em className="num">{Math.round(p.got)}/{p.max}</em>
            </button>
          ))}
        </div>
      </div>
      {weak && weak.got < weak.max && <p className="muted" style={{ fontSize: 12, margin: '12px 0 0' }}>Найбільше балів можна додати: <b style={{ color: 'var(--ink)' }}>{weak.label.toLowerCase()}</b> ({weak.hint})</p>}
      <div className="scorehist">
        {hist.map(h => { const dt = new Date(h.d + 'T00:00'); return <div key={h.d} className={h.d === k ? 'today' : ''} title={`${dt.getDate()} ${MON[dt.getMonth()]}: ${h.v}/100`}><i style={{ height: Math.max(3, h.v * 0.44), background: scoreColor(h.v) }} /><span>{DN[weekdayIdx(dt)]}</span><b className="num">{h.v}</b></div>; })}
      </div>
    </div>
  );
}

export function Home() {
  const { S, A, go } = useStore();
  const ti = weekdayIdx(), w = weekMinutes(S), lw = weekMinutes(S, -1), tot = w.reduce((a, b) => a + b, 0);
  const lwSoFar = lw.slice(0, ti + 1).reduce((a, b) => a + b, 0), pct = lwSoFar ? Math.round(((tot - lwSoFar) / lwSoFar) * 100) : 0;
  const ws = wStart().getTime(), blocks = [...Array(7)].map(() => Array(6).fill(0) as number[]);
  S.sessions.forEach(s => { const i = Math.floor((sod(s.t).getTime() - ws) / DAY); if (i >= 0 && i < 7) blocks[i][Math.floor(new Date(s.t).getHours() / 4)] += s.m; });
  const goalMin = S.goal * 60, tdone = S.tasks.filter(t => t.d).length, tall = S.tasks.length || 1, st = streak(S);
  const k = TK(), hDone = S.habits.filter(h => h.days[k]).length;
  const mt = monthTx(S), out = sumT(mt, 'out'), b = S.money.budget;
  const gs = [...S.goals].sort((a, c) => c.cur / c.target - a.cur / a.target).slice(0, 4);
  return (
    <section className="view">
      <div className="grid">
        <Hero />
        <SchedCard />

        <div className="card s12">
          <div className="ch"><Icon n="life" className="ic" /><div><h3>Сьогодні</h3><p>Вода, сон, настрій, рух і гроші. Одне натискання, і все пораховано</p></div><button className="sel" onClick={() => go('health')}>Здоровʼя</button></div>
          <LifeTiles full={false} />
        </div>

        <ScoreCard />
        <FreeTimeCard />

        <div className="card s4">
          <div className="ch"><Icon n="clock" className="ic" /><div><h3>Час фокусу</h3><p>Глибока робота за тиждень</p></div><span className="sel">Цей тиждень</span></div>
          <div className="bigstat"><span className="v num">{Math.floor(tot / 60) > 0 && <>{Math.floor(tot / 60)}<small>год</small></>}{tot % 60}<small>хв</small></span><span className={`delta ${pct >= 0 ? 'up' : 'dn'}`}>{pct >= 0 ? '↑ ' : '↓ '}{Math.abs(pct)}%</span></div>
          <div className="muted" style={{ fontSize: 12 }}>порівняно з минулим тижнем</div>
          <FocusArea week={w} today={ti} />
        </div>
        <div className="card s8">
          <div className="ch"><Icon n="wave" className="ic" /><div><h3>Ритм навчання</h3><p>Фокус по 4-годинних блоках, лінія = години за день</p></div><span className="sel">Цей тиждень</span></div>
          <div className="hscroll"><Rhythm blocks={blocks} today={ti} /></div>
        </div>

        <div className="card s7">
          <div className="ch"><Icon n="map" className="ic" /><div><h3>Карта фокусу</h3><p>Кожна точка = година тижня. Коли ти найбільш зосереджений</p></div><span className="sel">Цей тиждень</span></div>
          <HeatMap />
        </div>
        <div className="card s5">
          <div className="ch"><Icon n="trend" className="ic" /><div><h3>Результати</h3><p>Баланс твоєї активності</p></div><span className="sel">Цей тиждень</span></div>
          <div className="rings">
            <div><Ring pct={tot / goalMin} color="var(--good)" label="Ціль тижня" value={Math.round((tot / goalMin) * 100) + '%'} /></div>
            <div><Ring pct={tdone / tall} color="var(--ink)" label="Задачі" value={Math.round((tdone / tall) * 100) + '%'} /></div>
            <div><Ring pct={st / 7} color="var(--accent)" label="Серія" value={st + ' дн'} /></div>
          </div>
        </div>

        <div className="card s4">
          <div className="ch"><Icon n="habits" className="ic" /><div><h3>Звички</h3><p>{S.habits.length ? `${hDone} з ${S.habits.length} сьогодні` : 'Додай першу звичку'}</p></div><button className="sel" onClick={() => go('habits')}>Усі</button></div>
          <div className="list">
            {S.habits.slice(0, 6).map(h => {
              const on = !!h.days[k];
              return <div className="item" key={h.id}><button className={`chk ${on ? 'on' : ''}`} aria-pressed={on} aria-label={`Відмітити: ${h.name}`} onClick={() => A.toggleHabit(h.id)}>{on && <Icon n="check" />}</button><span className="t">{h.name}</span><span className="muted num" style={{ fontSize: 12 }}>{habStreak(h.days)} дн</span></div>;
            })}
            {!S.habits.length && <p className="muted">Звичок поки немає.</p>}
          </div>
        </div>
        <div className="card s4">
          <div className="ch"><Icon n="money" className="ic" /><div><h3>Фінанси</h3><p>{MONTHN[new Date().getMonth()]}, витрати</p></div><button className="sel" onClick={() => go('money')}>Деталі</button></div>
          <div className="bigstat"><span className="v num" style={{ fontSize: 28 }}>{money(out)}</span><span className="muted">з {money(b)}</span></div>
          <div className="bar" style={{ margin: '10px 0 16px' }}><i style={{ width: pctW(out, b) + '%', background: out > b ? 'var(--m1)' : 'var(--accent)' }} /></div>
          <div className="cats"><CatBars tx={mt} limit={4} /></div>
        </div>
        <div className="card s4">
          <div className="ch"><Icon n="goals" className="ic" /><div><h3>Цілі</h3><p>Прогрес до великого</p></div><button className="sel" onClick={() => go('goals')}>Усі</button></div>
          {gs.map(g => (
            <div key={g.id} style={{ marginBottom: 14 }}>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 13, flexWrap: 'nowrap' }}><span className="t" style={{ minWidth: 0 }}>{g.title}</span><span className="num muted">{Math.round(Math.min(1, g.cur / g.target) * 100)}%</span></div>
              <div className="bar" style={{ marginTop: 6 }}><i style={{ width: pctW(g.cur, g.target) + '%', background: g.cur >= g.target ? 'var(--good)' : 'var(--ink)' }} /></div>
            </div>
          ))}
          {!gs.length && <p className="muted">Постав першу ціль у розділі «Цілі».</p>}
        </div>

        <div className="card s12 streak">
          <Icon n="trophy" className="ic" />
          <div>
            <h3>{st ? `Ти тримаєш серію ${st} ${plural(st, 'день', 'дні', 'днів')} поспіль!` : 'Почни нову серію сьогодні'}</h3>
            <p>{st ? 'Не зупиняйся: стабільність дає результат.' : 'Одна сесія фокусу, і перший вогник засвітиться.'}</p>
          </div>
          <div className="flames">
            {DN.map((d, i) => { const on = dayMinutes(S, addD(wStart(), i)) > 0; return <div key={d} className={`flame ${on ? 'on' : ''} ${i === ti ? 'today' : ''}`}><i><Icon n="flame" /></i><span>{d}</span></div>; })}
          </div>
          <button className="btn" onClick={() => go('focus')}>Продовжити <Icon n="arrow" /></button>
        </div>
      </div>
    </section>
  );
}

