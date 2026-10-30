'use client';

import { useState, type FormEvent } from 'react';
import { liveSessions, useNow, useStore } from '@/lib/store';
import { fmtCur } from '@/lib/money';
import { hhmm, MON, pad2, TK } from '@/lib/util';
import { dailyEarnings, hoursToGoal, periodStart, shifts, WOLT, woltStats, type WoltPeriod } from '@/lib/wolt';
import { Icon } from '../Icon';
import { DelBtn, Empty } from '../shared';

const hm = (h: number) => (h >= 1 ? `${Math.floor(h)} год ${Math.round((h % 1) * 60)} хв` : `${Math.round(h * 60)} хв`);
const clock = (sec: number) => `${Math.floor(sec / 3600)}:${pad2(Math.floor(sec / 60) % 60)}:${pad2(sec % 60)}`;
const num = (v: string) => Math.max(0, +v.replace(',', '.') || 0);

/** The shift itself: start it, watch it, and finish it with what it brought. */
function ShiftHero() {
  const { S, A, go } = useStore();
  const live = S.act?.kind === WOLT ? S.act : null, other = S.act && !live ? S.act : null;
  const now = useNow(1000, !!live);
  const week = woltStats(S, periodStart('week'), now);
  const [finishing, setFinishing] = useState(false);
  const [f, setF] = useState({ earned: '', orders: '', km: '' });
  const sec = live ? Math.max(0, Math.round((now - live.start) / 1000)) : 0;
  const guess = live && week.perHour ? Math.round((sec / 3600) * week.perHour) : 0;
  const finish = (e: FormEvent) => { e.preventDefault(); A.finishShift({ earned: num(f.earned), orders: Math.round(num(f.orders)), km: num(f.km) }); setFinishing(false); setF({ earned: '', orders: '', km: '' }); };
  return (
    <div className={`card shifthero${live ? ' live' : ''}`}>
      <div className="sh-top"><span className="ic woltic">W</span><span>{live ? 'Зміна триває' : 'Режим Wolt'}</span>{live && <span className="livedot" />}</div>
      {live ? (
        <>
          <div className="sh-time num">{clock(sec)}</div>
          <p className="sh-sub">Почав о {hhmm(new Date(live.start))}{guess > 0 && <> · за твоїм темпом уже ≈ <b>{fmtCur(guess, 'DKK')}</b></>}</p>
          {finishing ? (
            <form className="sh-form" onSubmit={finish}>
              <label className="field" htmlFor="shE">Заробіток, kr. (з чайовими)<input id="shE" autoFocus type="number" inputMode="decimal" min="0" step="any" placeholder="0" value={f.earned} onChange={e => setF({ ...f, earned: e.target.value })} /></label>
              <label className="field" htmlFor="shO">Замовлень<input id="shO" type="number" inputMode="numeric" min="0" placeholder="0" value={f.orders} onChange={e => setF({ ...f, orders: e.target.value })} /></label>
              <label className="field" htmlFor="shK">Км<input id="shK" type="number" inputMode="decimal" min="0" step="any" placeholder="0" value={f.km} onChange={e => setF({ ...f, km: e.target.value })} /></label>
              <div className="row" style={{ flex: '1 1 100%' }}>
                <button className="btn acc">Зберегти зміну</button>
                <button type="button" className="btn ghost" onClick={() => setFinishing(false)}>Ще їду</button>
              </div>
              <p className="help" style={{ margin: 0, flex: '1 1 100%' }}>Заробіток автоматично запишеться в Фінанси як дохід «Wolt».</p>
            </form>
          ) : (
            <div className="row">
              <button className="btn acc" onClick={() => setFinishing(true)}><Icon n="check" />Завершити зміну</button>
              <button className="btn ghost" onClick={A.cancelAct}>Скасувати</button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="sh-title">{week.hours ? `Цього тижня ${hm(week.hours)} і ${fmtCur(week.earned, 'DKK')}` : 'Виходиш на доставку?'}</div>
          <p className="sh-sub">Запусти зміну, а в кінці впиши, скільки заробив. Решту (за годину, за замовлення, тиждень) порахую я.</p>
          <div className="row">
            <button className="btn acc" disabled={!!other} onClick={() => A.startAct(WOLT, 'Зміна')}><Icon n="play" />Почати зміну</button>
            {other && <span className="sh-sub" style={{ margin: 0 }}>Зараз іде «{other.kind}». <button className="linkbtn" onClick={() => go('focus')}>Завершити там</button></span>}
          </div>
        </>
      )}
    </div>
  );
}

function Goal({ earned, perHour }: { earned: number; perHour: number }) {
  const { S, A } = useStore();
  const goal = S.woltGoal || 0, [v, setV] = useState(goal ? String(goal) : '');
  const pct = goal ? Math.min(100, Math.round((earned / goal) * 100)) : 0, need = hoursToGoal(goal, earned, perHour);
  return (
    <div className="card woltgoal">
      <div className="ch" style={{ marginBottom: 10 }}><Icon n="goals" className="ic" /><div><h3>Ціль на тиждень</h3><p>Скільки хочеш заробити на Wolt</p></div></div>
      <label className="field" htmlFor="wg">Сума, kr.<input id="wg" type="number" inputMode="numeric" min="0" step="100" placeholder="напр. 2000" value={v} onChange={e => setV(e.target.value)} onBlur={() => A.setWoltGoal(num(v))} /></label>
      {goal > 0 && (
        <>
          <div className="bar" style={{ margin: '14px 0 8px', height: 8 }}><i style={{ width: pct + '%', background: pct >= 100 ? 'var(--good)' : '#00B2D6' }} /></div>
          <p className="help" style={{ margin: 0 }}>{earned >= goal ? <>Ціль досягнуто: <b>{fmtCur(earned, 'DKK')}</b>.</> : <>Заробив {fmtCur(earned, 'DKK')} з {fmtCur(goal, 'DKK')}. {need > 0 ? <>За твоїм темпом лишилось ≈ <b>{hm(need)}</b> їзди.</> : 'Попрацюй ще, і з’явиться розрахунок часу.'}</>}</p>
        </>
      )}
    </div>
  );
}

function ManualShift() {
  const { A } = useStore();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(() => ({ date: TK(), s: hhmm(new Date(Date.now() - 36e5 * 3)), e: hhmm(new Date()), earned: '', orders: '', km: '' }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const start = new Date(`${v.date}T${v.s}`).getTime(), end = new Date(`${v.date}T${v.e}`).getTime();
    if (A.addShift({ start, end, earned: num(v.earned), orders: Math.round(num(v.orders)), km: num(v.km) })) setOpen(false);
  };
  if (!open) return <button className="linkbtn" onClick={() => setOpen(true)}>+ Додати зміну, яку не засікав</button>;
  return (
    <form className="row manual" onSubmit={submit}>
      <label className="field" htmlFor="msD">Дата<input id="msD" type="date" value={v.date} max={TK()} onChange={e => setV({ ...v, date: e.target.value })} /></label>
      <label className="field" htmlFor="msS">З<input id="msS" type="time" value={v.s} onChange={e => setV({ ...v, s: e.target.value })} /></label>
      <label className="field" htmlFor="msE">До<input id="msE" type="time" value={v.e} onChange={e => setV({ ...v, e: e.target.value })} /></label>
      <label className="field" htmlFor="msM">Заробіток, kr.<input id="msM" type="number" min="0" step="any" value={v.earned} onChange={e => setV({ ...v, earned: e.target.value })} /></label>
      <label className="field" htmlFor="msO">Замовлень<input id="msO" type="number" min="0" value={v.orders} onChange={e => setV({ ...v, orders: e.target.value })} /></label>
      <button className="btn acc">Додати</button>
      <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Скасувати</button>
    </form>
  );
}

export function WoltPage() {
  const { S, A } = useStore();
  const live = S.act?.kind === WOLT ? S.act : null;
  const now = useNow(30_000, !!live || S.timer.running);
  const [period, setPeriod] = useState<WoltPeriod>('week');
  const from = periodStart(period), st = woltStats(S, from, now, live || undefined);
  const week = woltStats(S, periodStart('week'), now, live || undefined);
  const days = dailyEarnings(S, 14), maxE = Math.max(1, ...days.map(d => d.earned));
  const list = shifts(S).slice(0, 12);
  const focusH = liveSessions(S, now).filter(s => s.t >= (from || 0)).reduce((a, s) => a + s.m, 0) / 60;
  const share = st.hours + focusH ? Math.round((st.hours / (st.hours + focusH)) * 100) : 0;
  const tiles: [string, string][] = [
    ['Час за кермом', hm(st.hours)], ['Заробіток', fmtCur(st.earned, 'DKK')], ['За годину', st.perHour ? fmtCur(st.perHour, 'DKK') : '—'],
    ['Замовлень', st.orders ? String(st.orders) : '—'], ['За замовлення', st.perOrder ? fmtCur(st.perOrder, 'DKK') : '—'], ['Замовлень за годину', st.ordersPerHour ? st.ordersPerHour.toFixed(1) : '—'],
  ];
  return (
    <section className="view">
      <div className="vh"><div><h2>Wolt</h2><p>Зміни, заробіток і скільки коштує година твого часу.</p></div></div>
      <div className="woltgrid">
        <ShiftHero />
        <Goal earned={week.earned} perHour={week.perHour} />
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="row tbar">
          <div className="tabs" role="group" aria-label="Період">
            {([['week', 'Тиждень'], ['month', 'Місяць'], ['all', 'Увесь час']] as const).map(([k, l]) => <button key={k} aria-pressed={period === k} onClick={() => setPeriod(k)}>{l}</button>)}
          </div>
        </div>
        <div className="wstats">
          {tiles.map(([l, v]) => <div key={l}><span>{l}</span><b className="num">{v}</b></div>)}
          {st.km > 0 && <div><span>Кілометрів</span><b className="num">{Math.round(st.km)}</b></div>}
        </div>
        {st.hours + focusH > 0 && (
          <div style={{ marginTop: 16 }}>
            <div className="woltbar" title={`Wolt ${share}% · свій бізнес ${100 - share}%`}><i className="w" style={{ width: share + '%' }} /><i className="f" style={{ width: 100 - share + '%' }} /></div>
            <p className="help" style={{ marginTop: 8 }}>З часу на роботу <b>{share}%</b> іде на Wolt, <b>{100 - share}%</b> на свою справу (фокус).{st.perHour > 0 && <> Година доставки дає <b>{fmtCur(st.perHour, 'DKK')}</b>: щоб година на проєкти була вигіднішою, її треба оцінювати вище.</>}</p>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="ch"><Icon n="trend" className="ic" /><div><h3>Останні 14 днів</h3><p>Скільки заробляв щодня</p></div></div>
        <div className="wdays" role="img" aria-label="Заробіток за 14 днів">
          {days.map(d => (
            <div key={d.d} className="wd" title={`${d.d}: ${fmtCur(d.earned, 'DKK')}${d.hours ? ` за ${hm(d.hours)}` : ''}`}>
              <b className="num">{d.earned ? Math.round(d.earned) : ''}</b>
              <i style={{ height: Math.max(d.earned ? 6 : 2, (d.earned / maxE) * 90) }} className={d.earned ? 'on' : ''} />
              <span>{+d.d.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="ch"><Icon n="clock" className="ic" /><div><h3>Зміни</h3><p>Останні {list.length || ''}</p></div></div>
        <div className="list">
          {list.map(a => {
            const h = (a.end - a.start) / 36e5, d = new Date(a.start);
            return (
              <div className="item shiftrow" key={a.id}>
                <span className="t"><b>{d.getDate()} {MON[d.getMonth()]}</b><br /><small className="muted">{hhmm(d)}–{hhmm(new Date(a.end))} · {hm(h)}</small></span>
                <span className="sr-n num">{a.orders ? `${a.orders} замовл.` : ''}</span>
                <span className="sr-n num">{a.earned ? fmtCur(a.earned, 'DKK') : '—'}</span>
                <span className="sr-n num muted">{a.earned && h > 0.2 ? `${fmtCur(a.earned / h, 'DKK')}/год` : ''}</span>
                <DelBtn label="Видалити зміну" onDelete={() => A.delShift(a.id)} />
              </div>
            );
          })}
          {!list.length && <Empty icon="wolt" title="Змін ще не було" text="Натисни «Почати зміну» зверху або додай минулу зміну вручну." />}
        </div>
        <div style={{ marginTop: 14 }}><ManualShift /></div>
      </div>
    </section>
  );

}
