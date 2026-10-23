'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import type { Invoice } from '@/lib/types';
import { daysInMonth, daysTo, kfmt, MON, MONTHN, money, pctW, STAGES, sum, TK, ymd } from '@/lib/util';
import { Icon } from '../Icon';
import { RevenueChart, Ring } from '../charts';
import { DelBtn, loadC, sumA } from '../shared';

const invState = (i: Invoice) => (i.paid ? 'paid' : i.due < TK() ? 'over' : 'wait');
const OPEN = ['lead', 'talk', 'proposal'];

function Head({ title, sub, children }: { title: string; sub: string; children?: React.ReactNode }) {
  return <div className="vh"><div><h2>{title}</h2><p>{sub}</p></div><div className="row" style={{ marginLeft: 'auto' }}>{children}</div></div>;
}

export function CoOverview() {
  const { S, go, setSheet } = useStore();
  const C = S.co, mk = TK().slice(0, 7);
  const paidM = sumA(C.invoices.filter(i => i.paid && i.paidAt.slice(0, 7) === mk));
  const wait = C.invoices.filter(i => invState(i) === 'wait'), over = C.invoices.filter(i => invState(i) === 'over');
  const open = C.deals.filter(d => OPEN.includes(d.stage));
  const months = [...Array(6)].map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); return d; });
  const rev = months.map(d => { const m = ymd(d).slice(0, 7); return sumA(C.invoices.filter(i => i.paid && i.paidAt.slice(0, 7) === m)); });
  const dl = daysInMonth() - new Date().getDate() + 1, left = Math.max(0, C.goal - paidM);
  const due = [
    ...C.projects.filter(p => p.status !== 'done' && p.due).map(p => ({ k: 'p' + p.id, d: p.due, t: p.name, s: 'Проєкт · ' + (p.client || ''), c: 'c1' })),
    ...C.invoices.filter(i => !i.paid).map(i => ({ k: 'i' + i.id, d: i.due, t: `${i.no} · ${money(i.amt)}`, s: 'Оплата · ' + i.client, c: 'c3' })),
  ].sort((a, b) => a.d.localeCompare(b.d)).slice(0, 6);
  const avgLoad = C.team.length ? Math.round(sum(C.team.map(m => m.load)) / C.team.length) : 0;
  const st = STAGES.map(([s, l]) => { const ds = C.deals.filter(d => d.stage === s); return { s, l, n: ds.length, sm: sumA(ds) }; }), mx = Math.max(1, ...st.map(x => x.sm));
  const won = C.deals.filter(d => d.stage === 'won').length, lost = C.deals.filter(d => d.stage === 'lost').length;
  const kpi: [string, string, string, string][] = [
    ['Виручка за місяць', money(paidM), `${Math.round((paidM / C.goal) * 100)}% від цілі`, 'var(--ink)'],
    ['Очікуємо оплату', money(sumA(wait)), `${wait.length} рахунків у роботі`, 'var(--ink)'],
    ['Прострочено', money(sumA(over)), over.length ? `${over.length} — час нагадати клієнтам` : 'Усі оплати вчасно', over.length ? 'var(--m1)' : 'var(--good)'],
    ['У воронці', money(sumA(open)), `${open.length} відкритих угод`, 'var(--ink)'],
  ];
  return (
    <section className="view">
      <Head title={C.name} sub={`${C.projects.filter(p => p.status === 'active').length} активних проєктів · ${C.team.length} у команді`}>
        <button className="btn ghost" onClick={() => setSheet({ kind: 'form', key: 'invoice' })}>+ Рахунок</button>
        <button className="btn acc" onClick={() => setSheet({ kind: 'form', key: 'deal' })}>+ Угода</button>
      </Head>
      <div className="grid" style={{ marginTop: 18 }}>
        {kpi.map(([l, v, s, c]) => <div key={l} className="card s3 stat"><div className="k">{l}</div><div className="v num" style={{ color: c }}>{v}</div><div className="k" style={{ marginTop: 4 }}>{s}</div></div>)}
      </div>
      <div className="grid" style={{ marginTop: 18 }}>
        <div className="card s8"><div className="ch"><Icon n="trend" className="ic" /><div><h3>Виручка</h3><p>Оплачені рахунки за 6 місяців · <span style={{ color: 'var(--good)' }}>пунктир — ціль</span></p></div></div><RevenueChart months={months} rev={rev} goal={C.goal} /></div>
        <div className="card s4">
          <div className="ch"><Icon n="goals" className="ic" /><div><h3>Ціль місяця</h3><p>{money(C.goal)} на {MONTHN[new Date().getMonth()].toLowerCase()}</p></div></div>
          <div style={{ maxWidth: 170, margin: '4px auto 14px' }}><Ring pct={paidM / C.goal} color="var(--accent)" label="від цілі" value={Math.round((paidM / C.goal) * 100) + '%'} /></div>
          <p className="muted" style={{ margin: 0, textAlign: 'center', fontSize: 13 }}>{left ? `Ще ${money(left)} за ${dl} дн. У воронці ${money(sumA(open))}.` : 'Ціль місяця виконано!'}</p>
        </div>
        <div className="card s6">
          <div className="ch"><Icon n="clock" className="ic" /><div><h3>Найближчі дедлайни</h3><p>Проєкти й оплати</p></div></div>
          <div className="list">
            {due.map(x => { const dd = daysTo(x.d); return <div className="item" key={x.k}><span className={`sw ${x.c}`} /><span className="t">{x.t}<br /><small className="muted">{x.s}</small></span><span className={`pillst ${dd < 0 ? 'bad' : dd <= 3 ? 'warn' : ''}`}>{dd < 0 ? `прострочено ${-dd} дн` : dd === 0 ? 'сьогодні' : `за ${dd} дн`}</span></div>; })}
            {!due.length && <p className="muted">Найближчих дедлайнів немає.</p>}
          </div>
        </div>
        <div className="card s6">
          <div className="ch"><Icon n="team" className="ic" /><div><h3>Завантаження команди</h3><p>{C.team.length ? `Середнє завантаження ${avgLoad}%` : 'Додай людей у «Команда»'}</p></div><button className="sel" onClick={() => go('team')}>Команда</button></div>
          <div className="cats">
            {C.team.map(m => <div className="catrow" key={m.id}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span><div className="bar"><i style={{ width: Math.min(100, m.load) + '%', background: loadC(m.load) }} /></div><span className="num" style={{ textAlign: 'right', color: loadC(m.load) }}>{m.load}%</span></div>)}
            {!C.team.length && <p className="muted" style={{ margin: 0 }}>Команди поки немає.</p>}
          </div>
        </div>
        <div className="card s12">
          <div className="ch"><Icon n="deals" className="ic" /><div><h3>Воронка продажів</h3><p>{won + lost ? `Конверсія ${Math.round((won / (won + lost)) * 100)}% (виграно ${won}, програно ${lost})` : 'Рухай угоди між етапами в «Угоди»'}</p></div><button className="sel" onClick={() => go('deals')}>Угоди</button></div>
          <div className="cats">
            {st.map(x => <div className="catrow" key={x.s} style={{ gridTemplateColumns: '110px minmax(0,1fr) 130px' }}><span>{x.l} <span className="muted num">{x.n}</span></span><div className="bar" style={{ height: 12 }}><i style={{ width: pctW(x.sm, mx) + '%', background: x.s === 'won' ? 'var(--good)' : 'var(--accent)' }} /></div><span className="num" style={{ textAlign: 'right' }}>{money(x.sm)}</span></div>)}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Deals() {
  const { S, A, setSheet } = useStore();
  const C = S.co, open = C.deals.filter(d => OPEN.includes(d.stage));
  return (
    <section className="view">
      <Head title="Угоди" sub={`${open.length} відкритих на ${money(sumA(open))} · виграно ${C.deals.filter(d => d.stage === 'won').length} · програно ${C.deals.filter(d => d.stage === 'lost').length}`}>
        <button className="btn acc" onClick={() => setSheet({ kind: 'form', key: 'deal' })}>+ Угода</button>
      </Head>
      <div className="kanban" style={{ marginTop: 18 }}>
        {STAGES.map(([s, l], si) => {
          const ds = C.deals.filter(d => d.stage === s);
          return (
            <div className="kcol" key={s}>
              <div className="khd"><b>{l}</b><span className="muted num">{ds.length} · {kfmt(sumA(ds))} kr.</span></div>
              {ds.map(d => (
                <div className="kcard" key={d.id}>
                  <b>{d.title}</b><small className="muted">{d.client}</small>
                  <div className="row" style={{ justifyContent: 'space-between', marginTop: 8, flexWrap: 'nowrap' }}>
                    <span className="num" style={{ fontWeight: 600 }}>{money(d.amt)}</span>
                    <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                      {si > 0 && <button className="sqb" aria-label="На попередній етап" onClick={() => A.moveDeal(d.id, -1)}><Icon n="left" /></button>}
                      {si < 3 && <>
                        <button className="sqb acc" aria-label="На наступний етап" onClick={() => A.moveDeal(d.id, 1)}><Icon n="right" /></button>
                        <button className="sqb" title="Угоду програно" aria-label="Позначити як програну" onClick={() => A.loseDeal(d.id)}><Icon n="x" /></button>
                      </>}
                    </span>
                  </div>
                </div>
              ))}
              {!ds.length && <p className="muted" style={{ fontSize: 12, margin: '6px 2px' }}>Порожньо</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ProgressSlider({ id, value }: { id: number; value: number }) {
  const { A } = useStore();
  const [v, setV] = useState(value);
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 16, fontSize: 12 }}><span className="muted">Прогрес</span><b className="num">{v}%</b></div>
      <input type="range" className="prog-range" min="0" max="100" step="5" value={v} aria-label="Прогрес"
        onChange={e => setV(+e.target.value)} onPointerUp={() => A.setProgress(id, v)} onKeyUp={() => A.setProgress(id, v)} onBlur={() => v !== value && A.setProgress(id, v)} />
    </>
  );
}

export function Projects() {
  const { S, A, setSheet } = useStore();
  const P = S.co.projects;
  return (
    <section className="view">
      <Head title="Проєкти" sub={`${P.filter(p => p.status === 'active').length} активних · ${P.filter(p => p.status === 'done').length} завершених. Тягни повзунок, щоб оновити прогрес`}>
        <button className="btn acc" onClick={() => setSheet({ kind: 'form', key: 'project' })}>+ Проєкт</button>
      </Head>
      <div className="grid" style={{ marginTop: 18 }}>
        {P.map(p => {
          const dd = p.due ? daysTo(p.due) : null;
          const stl = ({ active: ['Активний', 'ok'], paused: ['Пауза', ''], done: ['Готово', 'done'] } as const)[p.status];
          const dueTxt = p.status === 'done' ? 'завершено' : dd === null ? 'без дедлайну' : dd < 0 ? `прострочено ${-dd} дн` : dd === 0 ? 'дедлайн сьогодні' : `ще ${dd} дн`;
          const dueCls = p.status !== 'done' && dd !== null ? (dd < 0 ? 'bad' : dd <= 5 ? 'warn' : '') : '';
          return (
            <div className="card s4" key={p.id}>
              <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}><b>{p.name}</b><div className="muted" style={{ fontSize: 12 }}>{p.client}</div></div>
                <button className={`pillst ${stl[1]}`} title="Змінити статус" onClick={() => A.cycleProject(p.id)}>{stl[0]}</button>
              </div>
              <ProgressSlider key={p.progress} id={p.id} value={p.progress} />
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 12, marginTop: 10, flexWrap: 'nowrap' }}>
                <span className="muted">{p.budget ? money(p.budget) : ''}</span>
                <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}><span className={`pillst ${dueCls}`}>{dueTxt}</span><DelBtn label="Видалити проєкт" onDelete={() => A.delProject(p.id)} /></span>
              </div>
            </div>
          );
        })}
        {!P.length && <div className="card s12"><p className="muted" style={{ margin: 0 }}>Проєктів поки немає. Натисни «+ Проєкт».</p></div>}
      </div>
    </section>
  );
}

export function Invoices() {
  const { S, A, setSheet } = useStore();
  const [f, setF] = useState<'all' | 'open' | 'over' | 'paid'>('all');
  const L = S.co.invoices, mk = TK().slice(0, 7), over = L.filter(i => invState(i) === 'over'), wait = L.filter(i => invState(i) === 'wait');
  const rank = { over: 0, wait: 1, paid: 2 } as const;
  const list = L.filter(i => f === 'all' || (f === 'open' ? !i.paid : f === 'over' ? invState(i) === 'over' : i.paid))
    .sort((a, b) => rank[invState(a)] - rank[invState(b)] || (a.paid ? b.paidAt.localeCompare(a.paidAt) : a.due.localeCompare(b.due)));
  const lbl = { paid: ['Оплачено', 'ok'], wait: ['Очікує', 'warn'], over: ['Прострочено', 'bad'] } as const;
  return (
    <section className="view">
      <Head title="Рахунки" sub={`Оплачено цього місяця ${money(sumA(L.filter(i => i.paid && i.paidAt.slice(0, 7) === mk)))} · очікуємо ${money(sumA(wait))} · прострочено ${money(sumA(over))}`}>
        <button className="btn acc" onClick={() => setSheet({ kind: 'form', key: 'invoice' })}>+ Рахунок</button>
      </Head>
      <div className="card" style={{ marginTop: 18 }}>
        <div className="seg">
          {([['all', 'Усі'], ['open', 'Неоплачені'], ['over', `Прострочені${over.length ? ' ' + over.length : ''}`], ['paid', 'Оплачені']] as const).map(([k, l]) => <button key={k} aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>)}
        </div>
        <div className="list" style={{ marginTop: 10 }}>
          {list.map(i => {
            const s = invState(i), d = new Date((i.paid ? i.paidAt : i.due) + 'T00:00');
            return (
              <div className="item inv" key={i.id}>
                <span className="num muted" style={{ fontSize: 12 }}>{i.no}</span>
                <span className="t">{i.client}<br /><small className="muted">{i.paid ? 'оплачено' : 'до'} {d.getDate()} {MON[d.getMonth()]}</small></span>
                <span className="num" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{money(i.amt)}</span>
                <span className={`pillst ${lbl[s][1]}`}>{lbl[s][0]}</span>
                <button className="sqb" onClick={() => A.togglePaid(i.id)}>{i.paid ? 'Скасувати' : 'Оплачено'}</button>
                <DelBtn label="Видалити рахунок" onDelete={() => A.delInvoice(i.id)} />
              </div>
            );
          })}
          {!list.length && <p className="muted">Тут порожньо.</p>}
        </div>
      </div>
    </section>
  );
}

function LoadSlider({ id, value }: { id: number; value: number }) {
  const { A } = useStore();
  const [v, setV] = useState(value);
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', fontSize: 12, marginTop: 16 }}><span className="muted">Завантаження</span><b className="num" style={{ color: loadC(v) }}>{v}%</b></div>
      <input type="range" className="prog-range" min="0" max="120" step="5" value={v} aria-label="Завантаження"
        onChange={e => setV(+e.target.value)} onPointerUp={() => A.setLoad(id, v)} onKeyUp={() => A.setLoad(id, v)} onBlur={() => v !== value && A.setLoad(id, v)} />
    </>
  );
}

export function Team() {
  const { S, A, setSheet } = useStore();
  const M = S.co.team, avg = M.length ? Math.round(sum(M.map(m => m.load)) / M.length) : 0, hot = M.filter(m => m.load >= 100);
  return (
    <section className="view">
      <Head title="Команда" sub={M.length ? `${M.length} людей · середнє завантаження ${avg}%${hot.length ? ` · перевантажені: ${hot.map(m => m.name).join(', ')}` : ''}` : 'Додай першу людину в команду'}>
        <button className="btn acc" onClick={() => setSheet({ kind: 'form', key: 'member' })}>+ Учасник</button>
      </Head>
      <div className="grid" style={{ marginTop: 18 }}>
        {M.map(m => (
          <div className="card s3 member" key={m.id}>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <span className="ava">{(m.name.trim()[0] || '?').toUpperCase()}</span>
              <div style={{ flex: 1, minWidth: 0 }}><b>{m.name}</b><div className="muted" style={{ fontSize: 12 }}>{m.role}</div></div>
              <DelBtn label="Видалити з команди" onDelete={() => A.delMember(m.id)} />
            </div>
            <LoadSlider key={m.load} id={m.id} value={m.load} />
          </div>
        ))}
        {!M.length && <div className="card s12"><p className="muted" style={{ margin: 0 }}>Команди поки немає.</p></div>}
      </div>
    </section>
  );
}
