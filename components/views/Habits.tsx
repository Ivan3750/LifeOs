'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { addD, DN, TK, weekdayIdx, wStart, ymd } from '@/lib/util';
import { Icon } from '../Icon';
import { DelBtn, Empty, habStreak } from '../shared';
import { QuitSection } from './Quit';

export function Habits() {
  const { S, A, setSheet } = useStore();
  const [name, setName] = useState('');
  const [off, setOff] = useState(0);
  const ws = addD(wStart(), off * 7), ti = off === 0 ? weekdayIdx() : 6, k = TK(), now = new Date();
  const habits = S.habits.filter(h => !h.paused), resting = S.habits.filter(h => h.paused), hide = S.ui.hideMetrics;
  const done = habits.filter(h => h.days[k]).length;
  let cnt = 0;
  habits.forEach(h => { for (let i = 0; i <= ti; i++) if (h.days[ymd(addD(ws, i))]) cnt++; });
  const wp = habits.length ? Math.round((cnt / (habits.length * (ti + 1))) * 100) : 0;
  const we = addD(ws, 6), wLabel = off === 0 ? 'Цей тиждень' : `${ws.getDate()}.${String(ws.getMonth() + 1).padStart(2, '0')} – ${we.getDate()}.${String(we.getMonth() + 1).padStart(2, '0')}`;
  // completion of the last 8 weeks, oldest first, to look back at
  const hist = [...Array(8)].map((_, j) => {
    const w0 = addD(wStart(), (off - 7 + j) * 7); let c = 0, n = 0;
    habits.forEach(h => { for (let i = 0; i < 7; i++) { const d = addD(w0, i); if (d > now) continue; n++; if (h.days[ymd(d)]) c++; } });
    return { w0, p: n ? Math.round((c / n) * 100) : null };
  });
  return (
    <section className="view">
      <div className="vh"><div><h2>Звички</h2><p>{hide ? wLabel : `${done} з ${habits.length} сьогодні · ${wp}% виконання: ${wLabel.toLowerCase()}`}</p></div>
        <div className="hnav">
          <button className="btn ghost cal-nav" aria-label="Попередній тиждень" onClick={() => setOff(off - 1)}>‹</button>
          <button className="btn ghost" disabled={off === 0} onClick={() => setOff(0)}>Сьогодні</button>
          <button className="btn ghost cal-nav" aria-label="Наступний тиждень" disabled={off === 0} onClick={() => setOff(off + 1)}>›</button>
        </div></div>
      <div className="card" style={{ marginTop: 18 }}>
        <form className="addrow" onSubmit={e => { e.preventDefault(); A.addHabit(name); setName(''); }}>
          <input id="habIn" aria-label="Нова звичка" value={name} onChange={e => setName(e.target.value)} placeholder="Нова звичка… напр. «10 хвилин медитації»" autoComplete="off" />
          <button className="btn acc" disabled={!name.trim()}>Додати</button>
        </form>
        <div style={{ marginTop: 18, overflowX: 'auto' }}>
          {habits.length ? (
            <>
              <div className="habrow head"><span />{DN.map((d, i) => <span key={d} className={i === ti ? 'today' : ''}>{d}</span>)}<span>{hide ? '' : 'Серія'}</span><span /></div>
              {habits.map(h => (
                <div className="habrow" key={h.id}>
                  <button className="t" style={{ textAlign: 'left' }} title="Натисни, щоб перейменувати" onClick={() => setSheet({ kind: 'form', key: 'editHabit', init: { id: String(h.id), name: h.name } })}>{h.name}</button>
                  {DN.map((d, i) => {
                    const day = addD(ws, i), key = ymd(day), on = !!h.days[key];
                    return <button key={d} className={`hc ${on ? 'on' : ''}`} disabled={day > now} aria-pressed={on} aria-label={`${h.name}, ${d}`} onClick={() => A.toggleHabit(h.id, key)}>{on && <Icon n="check" />}</button>;
                  })}
                  <span className="num" style={{ textAlign: 'center' }}>{hide ? '' : `${habStreak(h.days, S)} дн`}</span>
                  <span style={{ display: 'inline-flex', gap: 2 }}><button className="ib" title="Поставити на паузу" aria-label={`Пауза: ${h.name}`} onClick={() => A.pauseHabit(h.id, true)}><Icon n="pause" /></button><DelBtn label="Видалити звичку" onDelete={() => A.delHabit(h.id)} /></span>
                </div>
              ))}
            </>
          ) : <Empty icon="habits" title="Звичок поки немає" text="Почни з однієї маленької: 10 хвилин на день краще за ідеальний план. Напиши її вище." />}
        </div>
        {habits.length > 0 && !hide && (
          <div className="scorehist" style={{ marginTop: 18 }}>
            {hist.map(h => (
              <button key={+h.w0} aria-pressed={+h.w0 === +ws} title={`Тиждень з ${h.w0.getDate()}.${String(h.w0.getMonth() + 1).padStart(2, '0')}: ${h.p ?? '—'}%`} onClick={() => setOff(Math.round((+h.w0 - +wStart()) / 6048e5))}>
                <i style={{ height: Math.max(3, (h.p ?? 0) * 0.44), background: 'var(--accent)', opacity: h.p === null ? 0.25 : 0.45 + 0.55 * (h.p / 100) }} /><span>{h.w0.getDate()}.{String(h.w0.getMonth() + 1).padStart(2, '0')}</span><b className="num">{h.p ?? '—'}</b>
              </button>
            ))}
          </div>
        )}
      </div>
      {habits.length > 0 && !hide && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="ch"><Icon n="habits" className="ic" /><div><h3>Останні 5 тижнів</h3><p>Чим насиченіший квадрат, тим більше звичок виконано того дня</p></div></div>
          <div className="hheat" role="img" aria-label="Виконання звичок за 5 тижнів">
            {DN.map(d => <span key={d} className="hd">{d[0]}</span>)}
            {[...Array(35)].map((_, i) => {
              const day = addD(wStart(), i - 28), key = ymd(day), n = habits.filter(h => h.days[key]).length, p = n / habits.length, future = day > now;
              return <i key={key} className={key === k ? 'today' : ''} title={`${day.getDate()}.${String(day.getMonth() + 1).padStart(2, '0')}: ${n} з ${habits.length}`} style={{ opacity: future ? 0.12 : n ? 0.3 + 0.7 * p : 0.12 }} />;
            })}
          </div>
        </div>
      )}
      {resting.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="ch"><Icon n="pause" className="ic" /><div><h3>На паузі</h3><p>Нічого не рахується, нічого не накопичується</p></div></div>
          <div className="list">
            {resting.map(h => <div className="item" key={h.id}><span className="t">{h.name}</span><button className="btn ghost sm" onClick={() => A.pauseHabit(h.id, false)}>Повернути</button></div>)}
          </div>
        </div>
      )}
      <QuitSection />
    </section>
  );
}

/* ---------------- Health ---------------- */
