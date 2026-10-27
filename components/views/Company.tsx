'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import type { Invoice } from '@/lib/types';
import type { Lead, LeadStatus } from '@/lib/types';
import { addD, daysInMonth, daysTo, kfmt, LEAD_SOURCES, LEAD_STATUS, MON, MONTHN, money, pctW, STAGES, sum, TK, ymd } from '@/lib/util';
import { Icon } from '../Icon';
import { RevenueChart, Ring } from '../charts';
import { DelBtn, loadC, sumA } from '../shared';

const invState = (i: Invoice) => (i.paid ? 'paid' : i.due < TK() ? 'over' : 'wait');
const OPEN = ['lead', 'talk', 'proposal'];

const edit = (setSheet: ReturnType<typeof useStore>['setSheet'], key: string, init: Record<string, string>) => setSheet({ kind: 'form', key, init });
const STAGE_P: Record<string, number> = { lead: 0.1, talk: 0.3, proposal: 0.6 };
const sumV = (a: Lead[]) => a.reduce((t, l) => t + (l.value || 0), 0);
const monthKey = (d: string) => d.slice(0, 7);

/** Ad spend, leads and results of one month (or all time when mk is empty), per channel and in total. */
function adStats(S: ReturnType<typeof useStore>['S'], mk = '') {
  const ads = S.co.ads.filter(a => !mk || monthKey(a.date) === mk), leads = S.co.leads.filter(l => !mk || monthKey(l.created) === mk);
  const spend = sumA(ads), clients = leads.filter(l => l.status === 'won');
  const channels = [...new Set([...ads.map(a => a.channel), ...leads.map(l => l.source)])].map(c => {
    const sp = sumA(ads.filter(a => a.channel === c)), ls = leads.filter(l => l.source === c), cl = ls.filter(l => l.status === 'won');
    return { c, spend: sp, leads: ls.length, clients: cl.length, value: sumV(cl), cpl: ls.length && sp ? sp / ls.length : null };
  }).sort((a, b) => b.spend - a.spend || b.leads - a.leads);
  return { spend, leads: leads.length, clients: clients.length, wonValue: sumV(clients), cpl: leads.length && spend ? spend / leads.length : null, cac: clients.length && spend ? spend / clients.length : null, channels };
}

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
  const todo = C.leads.filter(l => l.next && l.next <= TK() && l.status !== 'won' && l.status !== 'dead').sort((a, b) => a.next.localeCompare(b.next));
  const ad = adStats(S, mk), roi = ad.spend ? (paidM - ad.spend) / ad.spend : null;
  const forecast = open.reduce((a, d) => a + d.amt * (STAGE_P[d.stage] ?? 0), 0);
  const kpi: [string, string, string, string][] = [
    ['Виручка за місяць', money(paidM), `${Math.round((paidM / C.goal) * 100)}% від цілі`, 'var(--ink)'],
    ['Очікуємо оплату', money(sumA(wait)), `${wait.length} рахунків у роботі`, 'var(--ink)'],
    ['Прострочено', money(sumA(over)), over.length ? `${over.length} — час нагадати клієнтам` : 'Усі оплати вчасно', over.length ? 'var(--m1)' : 'var(--good)'],
    ['У воронці', money(sumA(open)), `${open.length} відкритих угод · прогноз ≈ ${money(forecast)}`, 'var(--ink)'],
  ];
  return (
    <section className="view">
      <Head title={C.name} sub={`${C.projects.filter(p => p.status === 'active').length} активних проєктів · ${C.team.length} у команді`}>
        <button className="btn ghost" onClick={() => setSheet({ kind: 'form', key: 'invoice' })}>+ Рахунок</button>
        <button className="btn ghost" onClick={() => setSheet({ kind: 'form', key: 'lead' })}>+ Клієнт</button>
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
          <div className="ch"><Icon n="leads" className="ic" /><div><h3>Звʼязатися сьогодні</h3><p>{todo.length ? `${todo.length} ${todo.length === 1 ? 'клієнт чекає' : 'клієнтів чекають'} на відповідь` : 'Усіх, кому треба, вже написано'}</p></div><button className="sel" onClick={() => go('leads')}>Клієнти</button></div>
          <div className="list">
            {todo.slice(0, 5).map(l => { const dd = daysTo(l.next); return <div className="item" key={l.id}><span className="sw c4" /><span className="t">{l.name}<br /><small className="muted">{LEAD_STATUS.find(x => x[0] === l.status)![1]} · {l.source}{l.value ? ' · ' + money(l.value) : ''}</small></span><span className={`pillst ${dd < 0 ? 'bad' : 'warn'}`}>{dd < 0 ? `прострочено ${-dd} дн` : 'сьогодні'}</span></div>; })}
            {!todo.length && <p className="muted">Додай потенційних клієнтів у розділі «Клієнти».</p>}
          </div>
        </div>
        <div className="card s6">
          <div className="ch"><Icon n="ads" className="ic" /><div><h3>Реклама цього місяця</h3><p>Скільки витрачено і що це дало</p></div><button className="sel" onClick={() => go('ads')}>Реклама</button></div>
          <div className="bigstat"><span className="v num">{money(ad.spend)}</span><span className="muted">{ad.leads} лідів · {ad.clients} клієнтів</span></div>
          <div className="woltstats" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', marginTop: 12 }}>
            <div><span>Ціна ліда</span><b className="num">{ad.cpl === null ? '—' : money(ad.cpl)}</b></div>
            <div><span>Ціна клієнта</span><b className="num">{ad.cac === null ? '—' : money(ad.cac)}</b></div>
            <div><span>Окупність</span><b className="num" style={{ color: roi === null ? undefined : roi >= 0 ? 'var(--good)' : 'var(--m1)' }}>{roi === null ? '—' : (roi >= 0 ? '+' : '') + Math.round(roi * 100) + '%'}</b></div>
          </div>
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
  const C = S.co, open = C.deals.filter(d => OPEN.includes(d.stage)), lost = C.deals.filter(d => d.stage === 'lost');
  return (
    <section className="view">
      <Head title="Угоди" sub={`${open.length} відкритих на ${money(sumA(open))} (прогноз ≈ ${money(open.reduce((a, d) => a + d.amt * (STAGE_P[d.stage] ?? 0), 0))}) · виграно ${C.deals.filter(d => d.stage === 'won').length} · програно ${C.deals.filter(d => d.stage === 'lost').length}`}>
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
                      <button className="sqb" title="Змінити або видалити" aria-label={`Змінити: ${d.title}`} onClick={() => edit(setSheet, 'editDeal', { id: String(d.id), title: d.title, client: d.client, amt: String(d.amt), stage: d.stage })}>⋯</button>
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
      {lost.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="ch"><div><h3>Програні угоди</h3><p>{lost.length} на {money(sumA(lost))}. Поверни в роботу або видали</p></div></div>
          <div className="list">
            {lost.map(d => <div className="item" key={d.id}><span className="t">{d.title}<br /><small className="muted">{d.client}</small></span><span className="num muted">{money(d.amt)}</span><button className="sqb" onClick={() => A.restoreDeal(d.id)}>Повернути</button><button className="sqb" onClick={() => edit(setSheet, 'editDeal', { id: String(d.id), title: d.title, client: d.client, amt: String(d.amt), stage: d.stage })}>Змінити</button><DelBtn label="Видалити угоду" onDelete={() => A.delDeal(d.id)} /></div>)}
          </div>
        </div>
      )}
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
                <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}><span className={`pillst ${dueCls}`}>{dueTxt}</span><button className="sqb" aria-label={`Змінити проєкт ${p.name}`} onClick={() => edit(setSheet, 'editProject', { id: String(p.id), name: p.name, client: p.client, budget: String(p.budget || ''), due: p.due })}>Змінити</button><DelBtn label="Видалити проєкт" onDelete={() => A.delProject(p.id)} /></span>
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
  const { S, A, setSheet, toast } = useStore();
  const [f, setF] = useState<'all' | 'open' | 'over' | 'paid'>('all');
  const remind = (i: Invoice) => {
    const text = `Добрий день! Нагадую про рахунок ${i.no} на ${money(i.amt)}, термін оплати був ${i.due}. Підкажіть, будь ласка, коли очікувати оплату?`;
    navigator.clipboard?.writeText(text).then(() => toast('Текст нагадування скопійовано'), () => toast(text));
  };
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
                {s === 'over' && <button className="sqb" title="Скопіювати текст нагадування" onClick={() => remind(i)}>Нагадати</button>}
                <button className="sqb" onClick={() => edit(setSheet, 'editInvoice', { id: String(i.id), client: i.client, amt: String(i.amt), due: i.due })}>Змінити</button>
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
              <button className="sqb" aria-label={`Змінити ${m.name}`} onClick={() => edit(setSheet, 'editMember', { id: String(m.id), name: m.name, role: m.role })}>⋯</button>
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

const LEAD_NEXT: Partial<Record<LeadStatus, LeadStatus>> = { new: 'contacted', contacted: 'replied', replied: 'meeting' };
const leadCls = (st: LeadStatus) => (st === 'won' ? 'ok' : st === 'dead' ? '' : st === 'meeting' ? 'warn' : 'done');

export function Leads() {
  const { S, setSheet } = useStore();
  const [f, setF] = useState<'live' | 'today' | 'won' | 'dead' | 'all'>('live');
  const [q, setQ] = useState('');
  const L = S.co.leads, live = L.filter(l => l.status !== 'won' && l.status !== 'dead'), today = TK();
  const due = live.filter(l => l.next && l.next <= today);
  const ql = q.trim().toLowerCase();
  const list = L.filter(l => f === 'all' || (f === 'live' ? live.includes(l) : f === 'today' ? due.includes(l) : l.status === f))
    .filter(l => !ql || `${l.name} ${l.contact} ${l.source} ${l.note}`.toLowerCase().includes(ql))
    .sort((a, b) => (a.next || '9999').localeCompare(b.next || '9999') || b.id - a.id);
  const won = L.filter(l => l.status === 'won').length, closed = won + L.filter(l => l.status === 'dead').length;
  const bySource = LEAD_SOURCES.map(c => ({ c, n: L.filter(l => l.source === c).length, w: L.filter(l => l.source === c && l.status === 'won').length })).filter(x => x.n).sort((a, b) => b.n - a.n);
  const contactLink = (c: string) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) ? 'mailto:' + c : /^\+?[\d\s()-]{7,}$/.test(c) ? 'tel:' + c.replace(/[^\d+]/g, '') : /^@\w+$/.test(c) ? '' : /^https?:\/\//.test(c) ? c : '');
  return (
    <section className="view">
      <Head title="Можливі клієнти" sub={`${live.length} у роботі на ${money(sumV(live))} · ${due.length ? `треба звʼязатися: ${due.length}` : 'нічого термінового'} · ${closed ? `конверсія ${Math.round((won / closed) * 100)}%` : 'ще нічого не закрито'}`}>
        <button className="btn acc" onClick={() => setSheet({ kind: 'form', key: 'lead' })}>+ Клієнт</button>
      </Head>
      <div className="grid" style={{ marginTop: 18 }}>
        <div className="card s12">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="seg">
              {([['live', `У роботі ${live.length}`], ['today', `Звʼязатися ${due.length}`], ['won', 'Клієнти'], ['dead', 'Не цікаво'], ['all', 'Усі']] as const).map(([k, l]) => <button key={k} aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>)}
            </div>
            <input className="txsearch" placeholder="Пошук: імʼя, контакт, нотатка…" value={q} onChange={e => setQ(e.target.value)} aria-label="Пошук клієнтів" />
          </div>
          <div className="list" style={{ marginTop: 10 }}>
            {list.map(l => <LeadRow key={l.id} l={l} link={contactLink(l.contact)} />)}
            {!list.length && <p className="muted">{ql ? 'Нічого не знайдено.' : L.length ? 'У цьому фільтрі порожньо.' : 'Поки нікого. Натисни «+ Клієнт» і запиши, кому ти написав або хто тобою зацікавився.'}</p>}
          </div>
        </div>
        {bySource.length > 0 && (
          <div className="card s12">
            <div className="ch"><Icon n="trend" className="ic" /><div><h3>Звідки приходять клієнти</h3><p>Скільки людей і скільки з них стали клієнтами</p></div></div>
            <div className="cats">
              {bySource.map(x => <div className="catrow" key={x.c} style={{ gridTemplateColumns: '130px minmax(0,1fr) 80px' }}><span>{x.c}</span><div className="bar"><i style={{ width: pctW(x.n, bySource[0].n) + '%' }} /></div><span className="num" style={{ textAlign: 'right' }}>{x.n} / {x.w}</span></div>)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function LeadRow({ l, link }: { l: Lead; link: string }) {
  const { A, setSheet } = useStore();
  const dd = l.next ? daysTo(l.next) : null, lbl = LEAD_STATUS.find(x => x[0] === l.status)![1], nx = LEAD_NEXT[l.status];
  return (
    <div className="item lead">
      <span className="t">
        <b>{l.name}</b>{' '}
        {l.contact && (link ? <a href={link} className="muted" style={{ fontSize: 12 }}>{l.contact}</a> : <span className="muted" style={{ fontSize: 12 }}>{l.contact}</span>)}
        <br /><small className="muted">{l.source}{l.value ? ' · ' + money(l.value) : ''}{l.note ? ' · ' + l.note : ''}</small>
      </span>
      {dd !== null && <span className={`pillst ${dd < 0 ? 'bad' : dd === 0 ? 'warn' : ''}`}>{dd < 0 ? `прострочено ${-dd} дн` : dd === 0 ? 'сьогодні' : `за ${dd} дн`}</span>}
      <span className={`pillst ${leadCls(l.status)}`}>{lbl}</span>
      <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
        {nx && <button className="sqb acc" title={`Статус: ${LEAD_STATUS.find(x => x[0] === nx)![1]}`} onClick={() => { A.setLeadStatus(l.id, nx); if (l.next && l.next <= TK()) A.updateLead(l.id, { next: ymd(addD(new Date(), 3)) }); }}>{LEAD_STATUS.find(x => x[0] === nx)![1]} →</button>}
        {l.status !== 'won' && l.status !== 'dead' && <button className="sqb" title="Створити угоду в воронці" onClick={() => A.leadToDeal(l.id)}>В угоду</button>}
        {l.status !== 'won' && l.status !== 'dead' && <button className="sqb" title="Відкласти на 3 дні" onClick={() => A.updateLead(l.id, { next: ymd(addD(new Date(), 3)) })}>+3 дн</button>}
        {(l.status === 'won' || l.status === 'dead') && <button className="sqb" onClick={() => A.setLeadStatus(l.id, 'new')}>Відновити</button>}
        {l.status !== 'dead' && l.status !== 'won' && <button className="sqb" title="Не цікаво" aria-label="Позначити, що не цікаво" onClick={() => A.setLeadStatus(l.id, 'dead')}><Icon n="x" /></button>}
        <button className="sqb" aria-label={`Змінити: ${l.name}`} onClick={() => edit(setSheet, 'editLead', { id: String(l.id), name: l.name, contact: l.contact, source: l.source, status: l.status, value: String(l.value || ''), next: l.next, note: l.note })}>⋯</button>
        <DelBtn label="Видалити клієнта" onDelete={() => A.delLead(l.id)} />
      </span>
    </div>
  );
}

export function Ads() {
  const { S, A, setSheet } = useStore();
  const [range, setRange] = useState<'month' | 'all'>('month');
  const mk = TK().slice(0, 7), st = adStats(S, range === 'month' ? mk : ''), paid = sumA(S.co.invoices.filter(i => i.paid && (range === 'all' || i.paidAt.slice(0, 7) === mk)));
  const roi = st.spend ? (paid - st.spend) / st.spend : null;
  const list = S.co.ads.filter(a => range === 'all' || monthKey(a.date) === mk).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const mx = Math.max(1, ...st.channels.map(c => c.spend));
  const months = [...Array(6)].map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); return ymd(d).slice(0, 7); });
  const byMonth = months.map(m => sumA(S.co.ads.filter(a => monthKey(a.date) === m))), mmx = Math.max(1, ...byMonth);
  const kpi: [string, string, string][] = [
    ['Витрачено', money(st.spend), `${list.length} записів`],
    ['Ліди', String(st.leads), st.cpl === null ? 'ціна ліда — немає даних' : `ціна ліда ${money(st.cpl)}`],
    ['Клієнти', String(st.clients), st.cac === null ? 'ціна клієнта — немає даних' : `ціна клієнта ${money(st.cac)}`],
    ['Окупність', roi === null ? '—' : (roi >= 0 ? '+' : '') + Math.round(roi * 100) + '%', `оплачено ${money(paid)} проти ${money(st.spend)} реклами`],
  ];
  return (
    <section className="view">
      <Head title="Реклама" sub={`${range === 'month' ? MONTHN[new Date().getMonth()] : 'За весь час'}: ${money(st.spend)} витрат · ліди рахуються з розділу «Клієнти» за полем «Звідки»`}>
        <div className="seg">{([['month', 'Цей місяць'], ['all', 'Весь час']] as const).map(([k, l]) => <button key={k} aria-pressed={range === k} onClick={() => setRange(k)}>{l}</button>)}</div>
        <button className="btn acc" onClick={() => setSheet({ kind: 'form', key: 'ad' })}>+ Витрата</button>
      </Head>
      <div className="grid" style={{ marginTop: 18 }}>
        {kpi.map(([l, v, sub]) => <div key={l} className="card s3 stat"><div className="k">{l}</div><div className="v num" style={{ color: l === 'Окупність' && roi !== null ? (roi >= 0 ? 'var(--good)' : 'var(--m1)') : 'var(--ink)' }}>{v}</div><div className="k" style={{ marginTop: 4 }}>{sub}</div></div>)}
        <div className="card s7">
          <div className="ch"><Icon n="ads" className="ic" /><div><h3>За каналами</h3><p>Витрати, ліди й ціна одного ліда</p></div></div>
          <div className="cats">
            {st.channels.map(c => <div className="catrow" key={c.c} style={{ gridTemplateColumns: '110px minmax(0,1fr) auto' }}><span>{c.c}</span><div className="bar"><i style={{ width: pctW(c.spend, mx) + '%' }} /></div><span className="num" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(c.spend)} · {c.leads} л. · {c.cpl === null ? '—' : money(c.cpl)}</span></div>)}
            {!st.channels.length && <p className="muted" style={{ margin: 0 }}>Запиши першу витрату на рекламу.</p>}
          </div>
        </div>
        <div className="card s5">
          <div className="ch"><Icon n="trend" className="ic" /><div><h3>Динаміка</h3><p>Витрати на рекламу за 6 місяців</p></div></div>
          <div className="cats">
            {months.map((m, i) => <div className="catrow" key={m} style={{ gridTemplateColumns: '70px minmax(0,1fr) 80px' }}><span>{MONTHN[+m.slice(5) - 1].slice(0, 3)}</span><div className="bar"><i style={{ width: pctW(byMonth[i], mmx) + '%', background: m === mk ? 'var(--accent)' : 'var(--ink)' }} /></div><span className="num" style={{ textAlign: 'right' }}>{money(byMonth[i])}</span></div>)}
          </div>
        </div>
        <div className="card s12">
          <div className="ch"><div><h3>Витрати</h3><p>Усі записи за вибраний період</p></div></div>
          <div className="list">
            {list.map(a => { const d = new Date(a.date + 'T00:00'); return (
              <div className="item inv" key={a.id}>
                <span className="num muted" style={{ fontSize: 12 }}>{d.getDate()} {MON[d.getMonth()]}</span>
                <span className="t">{a.channel}{a.note && <span className="muted"> · {a.note}</span>}</span>
                <span className="num" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{money(a.amt)}</span>
                <button className="sqb" onClick={() => edit(setSheet, 'editAd', { id: String(a.id), channel: a.channel, amt: String(a.amt), date: a.date, note: a.note })}>Змінити</button>
                <DelBtn label="Видалити запис" onDelete={() => A.delAd(a.id)} />
              </div>
            ); })}
            {!list.length && <p className="muted">За цей період витрат немає.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
