'use client';

import { useState, type FormEvent } from 'react';
import { useStore } from '@/lib/store';
import { account, CUR_SIGN, fmtCur, monthPlan, potSaved, recDate } from '@/lib/money';
import { monthSeries, moneyInsights, weekdaySpend } from '@/lib/insights';
import { CATS, daysTo, DN, MONTHN, pctW, plural, TK } from '@/lib/util';
import type { AccId } from '@/lib/types';
import { Icon } from './Icon';
import { Empty } from './shared';

const num = (v: string) => +v.replace(',', '.').replace(/\s/g, '') || 0;
const kr = (n: number) => fmtCur(n, 'DKK');

/** The month with income taken into account: what came in, what went out, what may still be spent today and where the month is heading. */
export function MonthHero({ mk }: { mk: string }) {
  const { S, A } = useStore();
  const p = monthPlan(S, mk), isNow = mk === TK().slice(0, 7);
  const [rate, setRate] = useState(String(S.money.saveRate));
  const used = p.allowance > 0 ? p.spent / p.allowance : 0, pace = isNow ? (new Date().getDate() / p.days) : 1;
  const tone = used > 1 ? 'var(--m1)' : used > pace + 0.08 ? 'var(--m2)' : 'var(--good)';
  const tiles: [string, string, string, string?][] = [
    ['Дохід', '+' + kr(p.income), p.expected > 0 ? `ще очікуємо ${kr(p.expected)}` : p.income ? 'за місяць' : 'ще нічого не надійшло', 'var(--good)'],
    ['Витрати', '−' + kr(p.spent), p.avgDay ? `≈ ${kr(p.avgDay)} на день` : 'за місяць'],
    [p.net >= 0 ? 'Лишилось з доходу' : 'Мінус', (p.net >= 0 ? '+' : '−') + kr(Math.abs(p.net)), p.rate === null ? 'додай дохід, щоб рахувати' : `${Math.round(p.rate * 100)}% доходу`, p.net >= 0 ? 'var(--ink)' : 'var(--m1)'],
    ['Відкладено', kr(p.saved), p.saved ? 'у скарбнички' : 'скарбнички нижче'],
  ];
  return (
    <div className="card monthhero">
      <div className="mh-tiles">
        {tiles.map(([l, v, s, c]) => <div key={l}><span>{l}</span><b className="num" style={{ color: c }}>{v}</b><small>{s}</small></div>)}
      </div>
      {p.allowance > 0 ? (
        <div className="mh-bar">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{isNow ? `Можна витрачати ≈ ${kr(Math.max(0, p.perDay))} на день` : `Бюджет місяця ${kr(p.allowance)}`}</b>
            <span className="muted num">{kr(p.spent)} з {kr(p.allowance)}</span>
          </div>
          <div className="mh-track" role="img" aria-label={`Витрачено ${Math.round(used * 100)}% бюджету`}>
            <i style={{ width: Math.min(100, used * 100) + '%', background: tone }} />
            {isNow && <u style={{ left: pace * 100 + '%' }} title="Де має бути за графіком" />}
          </div>
          <p className="help" style={{ margin: 0 }}>
            {p.left >= 0 ? `Лишилось ${kr(p.left)}${isNow ? ` на ${p.daysLeft} ${plural(p.daysLeft, 'день', 'дні', 'днів')}` : ''}.` : `Бюджет перевищено на ${kr(-p.left)}.`}
            {p.forecast !== null && <> У такому темпі за місяць вийде <b style={{ color: p.forecast > p.allowance ? 'var(--m1)' : undefined }}>{kr(p.forecast)}</b>{p.forecast > p.allowance ? `, це на ${kr(p.forecast - p.allowance)} більше за бюджет` : ''}</>}
          </p>
        </div>
      ) : <p className="help" style={{ margin: 0 }}>Задай бюджет рахунку (кнопка «Налаштувати» на картці) або перемкни на «Від доходу».</p>}
      <div className="mh-mode">
        <div className="tabs" role="group" aria-label="Як рахувати бюджет" style={{ flex: '0 1 auto' }}>
          <button aria-pressed={S.money.budgetMode !== 'income'} onClick={() => A.setBudgetMode('fixed')}>Фіксований бюджет</button>
          <button aria-pressed={S.money.budgetMode === 'income'} onClick={() => A.setBudgetMode('income')}>Від доходу</button>
        </div>
        {S.money.budgetMode === 'income' && (
          <label className="mh-rate">Відкладати
            <input inputMode="numeric" value={rate} aria-label="Скільки відсотків доходу відкладати" onChange={e => setRate(e.target.value)} onBlur={() => A.setSaveRate(num(rate))} /> %
          </label>
        )}
        <span className="help" style={{ margin: 0, flex: 1 }}>
          {S.money.budgetMode === 'income'
            ? p.mode === 'income' ? `Бюджет = дохід місяця (з очікуваним) мінус ${S.money.saveRate}% на заощадження.` : 'Доходу ще нема, тимчасово діє фіксований бюджет.'
            : 'Бюджет задається на кожному рахунку окремо.'}
        </span>
      </div>
    </div>
  );
}

/** A few automatic observations about the month. */
export function InsightsCard({ mk }: { mk: string }) {
  const { S } = useStore();
  const list = moneyInsights(S, mk);
  if (!list.length) return null;
  return (
    <div className="card insights">
      <div className="ch"><Icon n="wave" className="ic" /><div><h3>Що показують гроші</h3><p>Підказки, які рахуються самі</p></div></div>
      <div className="insl">
        {list.map((x, i) => <div key={i} className={`ins ${x.tone}`}><span><Icon n={x.icon} /></span><p>{x.text}</p></div>)}
      </div>
    </div>
  );
}

/** Savings pots: a goal amount, what is already put aside, and quick ways to add. */
export function Pots() {
  const { S, A, toast } = useStore();
  const [adding, setAdding] = useState(false);
  const [v, setV] = useState({ name: '', target: '', due: '' });
  const [amt, setAmt] = useState<Record<number, string>>({});
  const submit = (e: FormEvent) => { e.preventDefault(); if (A.addPot({ name: v.name, target: num(v.target), due: v.due })) { setV({ name: '', target: '', due: '' }); setAdding(false); } };
  return (
    <div className="card s6 pots">
      <div className="ch"><Icon n="goals" className="ic" /><div><h3>Скарбнички</h3><p>Відкладай на мету: ці гроші не вважаються витратами</p></div><button className="sel" onClick={() => setAdding(!adding)}>{adding ? 'Закрити' : '+ Нова'}</button></div>
      {adding && (
        <form className="row potform" onSubmit={submit}>
          <label className="field" htmlFor="potN" style={{ flex: '2 1 160px' }}>На що<input id="potN" required autoFocus placeholder="Відпустка, ноутбук, подушка" value={v.name} onChange={e => setV({ ...v, name: e.target.value })} /></label>
          <label className="field" htmlFor="potT" style={{ flex: '1 1 100px' }}>Скільки, kr.<input id="potT" required inputMode="decimal" value={v.target} onChange={e => setV({ ...v, target: e.target.value })} /></label>
          <label className="field" htmlFor="potD" style={{ flex: '1 1 140px' }}>До якої дати<input id="potD" type="date" min={TK()} value={v.due} onChange={e => setV({ ...v, due: e.target.value })} /></label>
          <button className="btn acc">Створити</button>
        </form>
      )}
      {!S.money.pots.length && !adding && <Empty icon="goals" title="Скарбничок ще нема" text="Створи першу: наприклад «Подушка безпеки» чи «Поїздка». Відкладені гроші лишаються на рахунку, але не рахуються витратами." />}
      <div className="potlist">
        {S.money.pots.map(p => {
          const saved = potSaved(S, p.id), pct = Math.min(100, (saved / p.target) * 100), done = saved >= p.target;
          const months = p.due ? Math.max(1, Math.round(daysTo(p.due) / 30)) : 0;
          const need = p.due && !done ? Math.max(0, p.target - saved) / months : 0;
          const input = amt[p.id] || '';
          const quick = (n: number) => A.potMove(p.id, n);
          const custom = (sign: 1 | -1) => { const n = num(input); if (!(n > 0)) { toast('Впиши суму'); return; } A.potMove(p.id, sign * n); setAmt({ ...amt, [p.id]: '' }); };
          return (
            <div className={`pot${done ? ' done' : ''}`} key={p.id}>
              <div className="pot-h"><b>{p.name}</b><span className="num">{kr(saved)} <small>з {kr(p.target)}</small></span><button className="ib danger" title="Видалити скарбничку" aria-label="Видалити скарбничку" onClick={() => A.delPot(p.id)}><Icon n="trash" /></button></div>
              <div className="mh-track"><i style={{ width: pct + '%', background: done ? 'var(--good)' : 'var(--ink)' }} /></div>
              <p className="help" style={{ margin: 0 }}>{done ? 'Мети досягнуто!' : `Лишилось ${kr(p.target - saved)}`}{need > 0 && ` · треба ≈ ${kr(need)} на місяць до ${p.due.split('-').reverse().join('.')}`}</p>
              <div className="row potact">
                {[100, 500, 1000].map(n => <button key={n} className="sqb" onClick={() => quick(n)}>+{n}</button>)}
                <input inputMode="decimal" placeholder="своя сума" aria-label={`Сума для ${p.name}`} value={input} onChange={e => setAmt({ ...amt, [p.id]: e.target.value })} />
                <button className="sqb" onClick={() => custom(1)}>Відкласти</button>
                <button className="sqb" disabled={saved <= 0} onClick={() => custom(-1)}>Зняти</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Payments and income that repeat every month: they are added by themselves on their day. */
export function RecurringCard() {
  const { S, A } = useStore();
  const [adding, setAdding] = useState(false);
  const blank = { type: 'out' as 'in' | 'out', name: '', amt: '', day: '1', cat: CATS.out[0], acc: 'dk' as AccId };
  const [v, setV] = useState(blank);
  const mk = TK().slice(0, 7);
  const list = [...S.money.recurring].sort((a, b) => a.day - b.day);
  const month = S.money.recurring.filter(r => r.active).reduce((a, r) => a + (r.type === 'out' ? -1 : 1) * (r.acc === 'ua' ? r.amt / (S.money.uahPerDkk || 1) : r.amt), 0);
  const submit = (e: FormEvent) => { e.preventDefault(); if (A.addRecurring({ type: v.type, name: v.name, amt: num(v.amt), day: num(v.day), cat: v.cat, acc: v.acc })) { setV(blank); setAdding(false); } };
  return (
    <div className="card s6">
      <div className="ch"><Icon n="refresh" className="ic" /><div><h3>Регулярні платежі</h3><p>{list.length ? `Щомісяця в плюс чи мінус ${kr(Math.abs(month))}${month < 0 ? ' (мінус)' : ''}` : 'Зарплата, оренда, підписки: запиши раз, і далі все додається саме'}</p></div><button className="sel" onClick={() => setAdding(!adding)}>{adding ? 'Закрити' : '+ Додати'}</button></div>
      {adding && (
        <form className="row potform" onSubmit={submit}>
          <div className="tabs" role="group" aria-label="Тип" style={{ flex: '1 1 100%' }}>
            {([['out', 'Платіж'], ['in', 'Дохід']] as const).map(([k, l]) => <button type="button" key={k} aria-pressed={v.type === k} onClick={() => setV({ ...v, type: k, cat: CATS[k][0] })}>{l}</button>)}
          </div>
          <label className="field" htmlFor="rcN" style={{ flex: '2 1 150px' }}>Назва<input id="rcN" required placeholder={v.type === 'out' ? 'Оренда, Netflix, спортзал' : 'Зарплата, SU'} value={v.name} onChange={e => setV({ ...v, name: e.target.value })} /></label>
          <label className="field" htmlFor="rcA" style={{ flex: '1 1 90px' }}>Сума, {CUR_SIGN[account(S, v.acc).cur]}<input id="rcA" required inputMode="decimal" value={v.amt} onChange={e => setV({ ...v, amt: e.target.value })} /></label>
          <label className="field" htmlFor="rcD" style={{ flex: '1 1 80px' }}>Числа місяця<input id="rcD" type="number" min="1" max="31" required value={v.day} onChange={e => setV({ ...v, day: e.target.value })} /></label>
          <label className="field" htmlFor="rcC" style={{ flex: '1 1 120px' }}>Категорія<select id="rcC" value={v.cat} onChange={e => setV({ ...v, cat: e.target.value })}>{CATS[v.type].map(c => <option key={c}>{c}</option>)}</select></label>
          <label className="field" htmlFor="rcAc" style={{ flex: '1 1 120px' }}>Рахунок<select id="rcAc" value={v.acc} onChange={e => setV({ ...v, acc: e.target.value as AccId })}><option value="dk">Данський</option><option value="ua">Український</option></select></label>
          <button className="btn acc">Додати</button>
        </form>
      )}
      <div className="list">
        {list.map(r => (
          <div className={`item rec${r.active ? '' : ' off'}`} key={r.id}>
            <span className="rdate num" title="Число місяця">{r.day}</span>
            <span className="t">{r.name}<br /><small className="muted">{r.cat} · {account(S, r.acc).name.replace(' рахунок', '')}{r.active && recDate(r, mk) >= TK() ? ` · наступний ${recDate(r, mk).split('-').reverse().slice(0, 2).join('.')}` : ''}</small></span>
            <b className="num" style={{ color: r.type === 'in' ? 'var(--good)' : 'var(--ink)' }}>{r.type === 'in' ? '+' : '−'}{fmtCur(r.amt, account(S, r.acc).cur)}</b>
            <button className="switch" role="switch" aria-checked={r.active} aria-label={r.active ? 'Вимкнути' : 'Увімкнути'} onClick={() => A.toggleRecurring(r.id)}><i /></button>
            <button className="ib danger" title="Видалити" aria-label="Видалити" onClick={() => A.delRecurring(r.id)}><Icon n="trash" /></button>
          </div>
        ))}
        {!list.length && !adding && <Empty icon="refresh" title="Регулярних платежів нема" text="Додай оренду, підписки чи зарплату. Записи зʼявлятимуться самі в потрібний день, а «Від доходу» знатиме про очікуваний дохід." />}
      </div>
    </div>
  );
}

/** Income against spending for six months, and the days of the week when the money goes. */
export function Trends() {
  const { S } = useStore();
  const ms = monthSeries(S, 6), max = Math.max(1, ...ms.flatMap(m => [m.income, m.spent]));
  const wd = weekdaySpend(S), wmax = Math.max(1, ...wd);
  return (
    <div className="card s12 trends">
      <div className="tr-col">
        <div className="ch"><Icon n="trend" className="ic" /><div><h3>Дохід і витрати</h3><p>Шість місяців, у кронах</p></div><span className="legend"><i className="in" />дохід<i className="out" />витрати</span></div>
        <div className="mbars" role="img" aria-label="Дохід і витрати за шість місяців">
          {ms.map(m => (
            <div key={m.mk} className="mb" title={`${MONTHN[+m.mk.slice(5) - 1]}: дохід ${kr(m.income)}, витрати ${kr(m.spent)}`}>
              <div className="mb-b"><i className="in" style={{ height: pctW(m.income, max) + '%' }} /><i className="out" style={{ height: pctW(m.spent, max) + '%' }} /></div>
              <span>{MONTHN[+m.mk.slice(5) - 1].slice(0, 3)}</span>
              <small className="num" style={{ color: m.income - m.spent >= 0 ? 'var(--good)' : 'var(--m1)' }}>{m.income || m.spent ? (m.income - m.spent >= 0 ? '+' : '−') + Math.round(Math.abs(m.income - m.spent)) : ''}</small>
            </div>
          ))}
        </div>
      </div>
      <div className="tr-col">
        <div className="ch"><Icon n="clock" className="ic" /><div><h3>Коли ти витрачаєш</h3><p>У середньому за день тижня</p></div></div>
        <div className="wbars">
          {wd.map((v, i) => <div key={i} title={kr(v)}><i style={{ height: Math.max(3, (v / wmax) * 100) + '%', background: v === wmax && v > 0 ? 'var(--accent)' : undefined }} /><span>{DN[i]}</span></div>)}
        </div>
      </div>
    </div>
  );
}
