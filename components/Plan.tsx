'use client';

import { useMemo } from 'react';
import { useNow, useStore } from '@/lib/store';
import { planDay, weekView, type PlanBlock } from '@/lib/plan';
import { hmPlain, plural, TK } from '@/lib/util';
import { Icon } from './Icon';

const KIND: Record<PlanBlock['kind'], { c: string; label: string }> = {
  focus: { c: 'c1', label: 'Фокус' },
  move: { c: 'c3', label: 'Рух' },
  wind: { c: 'c4', label: 'Вечір' },
};

/** The plan of today, laid out from the free windows, the tasks that are due, how rested you are and your own best hours. One tap puts it in the calendar. */
export function PlanCard() {
  const { S, A, eventsOn } = useStore();
  const now = useNow(60_000), k = TK();
  const minute = Math.floor(now / 6e4);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const p = useMemo(() => planDay(S, k, eventsOn(k), now), [S, eventsOn, k, minute]);
  const mine = S.events.filter(e => e.date === k);
  const inCal = (b: PlanBlock) => mine.some(e => e.s === b.s && e.e === b.e);
  const todo = p.blocks.filter(b => !inCal(b));
  const addAll = () => { for (const b of todo) A.addEvent({ title: b.task ? `${KIND[b.kind].label}: ${b.task}` : b.title, date: k, s: b.s, e: b.e, c: KIND[b.kind].c }); };
  return (
    <div className="card s12 cardcol">
      <div className="ch" style={{ margin: 0 }}>
        <Icon n="clock" className="ic" />
        <div><h3>План на сьогодні</h3><p>{p.modeWhy}</p></div>
        {todo.length > 0 && <button className="btn ghost sm" onClick={addAll}>Додати в календар</button>}
      </div>
      {p.blocks.length > 0 ? (
        <div className="planlist">
          {p.blocks.map(b => (
            <div className={`planrow ${b.kind}`} key={b.s + b.title}>
              <b className="num">{b.s}–{b.e}</b>
              <div><strong>{b.title}</strong><small>{b.why}</small></div>
            </div>
          ))}
        </div>
      ) : <p className="help" style={{ margin: 0 }}>На сьогодні нічого планувати: вільних вікон нема, або день позначено вихідним.</p>}
      {p.notes.map(n => <p className="help" style={{ margin: 0 }} key={n}>{n}</p>)}
      {p.target > 0 && <p className="help" style={{ margin: 0 }}>У плані {hmPlain(p.planned)} фокусу із бажаних {hmPlain(p.target)}. {p.peak.known ? `Найкращі години за твоїми сесіями: ${p.peak.from}:00–${p.peak.to}:00.` : ''}</p>}
    </div>
  );
}

const TONE = { good: 'var(--good)', warn: 'var(--accent)', info: 'var(--muted)' };

/** The week: will the deadlines fit, is the weekly goal on track, where is the month's money going, and what changed against last week. */
export function WeekCard() {
  const { S, go, eventsOn } = useStore();
  const now = useNow(60_000), minute = Math.floor(now / 6e4);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const w = useMemo(() => weekView(S, eventsOn, new Date(now)), [S, eventsOn, minute]);
  const pct = w.focus.goal ? Math.min(100, (w.focus.done / w.focus.goal) * 100) : 0, fpct = w.focus.goal ? Math.min(100, (w.focus.forecast / w.focus.goal) * 100) : 0;
  return (
    <div className="card s12 cardcol">
      <div className="ch" style={{ margin: 0 }}><Icon n="clock" className="ic" /><div><h3>Тиждень наперед</h3><p>Чи вміщаються терміни у вільний час, як іде ціль тижня і що змінилось проти минулого тижня</p></div></div>
      <div className="weekstrip">
        {w.days.map(d => (
          <div className={`wd ${d.state}`} key={d.k}>
            <b>{d.label}</b>
            <span className="num">{d.work ? hmPlain(d.free) : 'вихідний'}</span>
            <small>{d.due ? `${d.due} ${plural(d.due, 'термін', 'терміни', 'термінів')}` : '—'}</small>
          </div>
        ))}
      </div>
      <div>
        <div className="cover-h"><b>Фокус тижня</b><span className="num">{hmPlain(w.focus.done)} із {hmPlain(w.focus.goal)}</span></div>
        <div className="bar" style={{ position: 'relative' }}><i style={{ width: fpct + '%', background: 'var(--bar)', position: 'absolute' }} /><i style={{ width: pct + '%', position: 'absolute' }} /></div>
        <small className="help">{w.focus.known ? `Прогноз за твоїм темпом: ${hmPlain(w.focus.forecast)}` : 'Тиждень тільки почався: прогноз зʼявиться після першого робочого дня'}{w.focus.daysLeft ? `, лишилось ${w.focus.daysLeft} ${plural(w.focus.daysLeft, 'робочий день', 'робочі дні', 'робочих днів')}` : ''}</small>
      </div>
      {w.money && (
        <div>
          <div className="cover-h"><b>Гроші місяця</b><span className="num">{w.money.spent} kr.{w.money.budget ? ` із ${w.money.budget}` : ''}</span></div>
          <small className="help">Прогноз до кінця місяця: ~{w.money.forecast} kr.{w.money.budget ? (w.money.forecast > w.money.budget ? ' Це більше за бюджет.' : ' У межах бюджету.') : ''}</small>
        </div>
      )}
      {w.deltas.length > 0 && (
        <div className="deltas">
          {w.deltas.map(d => (
            <button key={d.label} className="delta-row" onClick={() => go(d.to)}>
              <i style={{ background: TONE[d.tone] }} /><span>{d.label}</span><b className="num">{d.now}</b><small>було {d.before}</small>
            </button>
          ))}
        </div>
      )}
      {w.steps.length > 0 && (
        <div><b>Що зробити цього тижня</b><ol className="steps">{w.steps.map(s => <li key={s}>{s}</li>)}</ol></div>
      )}
    </div>
  );
}

/** When the automatic collector last sent something (nothing is shown until it has). */
export function AutoLine() {
  const { S } = useStore();
  const now = useNow(60_000);
  if (!S.ingest) return null;
  const min = Math.max(0, Math.round((now - S.ingest.at) / 6e4));
  const when = min < 1 ? 'щойно' : min < 60 ? `${min} хв тому` : min < 1440 ? `${Math.round(min / 60)} год тому` : `${Math.round(min / 1440)} дн тому`;
  return <p className="help" style={{ margin: 0 }}>Автозбір: останні дані прийшли {when} ({S.ingest.n} {plural(S.ingest.n, 'запис', 'записи', 'записів')} від {S.ingest.source}).</p>;
}
