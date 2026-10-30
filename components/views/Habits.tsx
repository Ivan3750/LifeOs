'use client';

import { useState } from 'react';
import { scoreColor } from '@/lib/score';
import { useStore } from '@/lib/store';
import { addD, DN, TK, weekdayIdx, wStart, ymd } from '@/lib/util';
import { Icon } from '../Icon';
import { DelBtn, Empty, habStreak } from '../shared';

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
        <form className="addrow" onSubmit={e => { e.preventDefault(); A.addHabit(name); setName(''); }}>
          <input id="habIn" aria-label="Нова звичка" value={name} onChange={e => setName(e.target.value)} placeholder="Нова звичка… напр. «10 хвилин медитації»" autoComplete="off" />
          <button className="btn acc" disabled={!name.trim()}>Додати</button>
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
          ) : <Empty icon="habits" title="Звичок поки немає" text="Почни з однієї маленької: 10 хвилин на день краще за ідеальний план. Напиши її вище." />}
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
