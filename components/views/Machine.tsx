'use client';

import { useState } from 'react';
import type { Machine as MachineT } from '@/lib/types';
import { useNow, useStore } from '@/lib/store';
import { daysLeft, machinePlan } from '@/lib/machine';
import { fmtDate, fmtN, plural, wStart, ymd } from '@/lib/util';
import { Icon } from '../Icon';
import { DelBtn, Empty } from '../shared';

const kr = (n: number) => `${fmtN(Math.round(n))} кр`;

/** A bar «done of target» for one number of the week. */
function Part({ label, done, target, text }: { label: string; done: number; target: number; text: string }) {
  const w = target > 0 ? Math.min(100, (done / target) * 100) : 100;
  return (
    <div className="mpart">
      <div className="lab"><span>{label}</span><span className="num">{text}</span></div>
      <div className={`nbar hg ${w >= 100 ? 'ok' : 'warn'}`}><i style={{ width: w + '%' }} /></div>
    </div>
  );
}

function MachineCard({ m }: { m: MachineT }) {
  const { A } = useStore();
  const now = useNow(60_000), at = new Date(now);
  const p = machinePlan(m, at), left = daysLeft(m);
  const [edit, setEdit] = useState(false);
  const { S } = useStore();
  const [v, setV] = useState({ goal: String(m.goal ?? ''), title: m.title, target: String(m.target), saved: String(m.saved), due: m.due, price: String(m.price), conv: String(m.conv) });
  const [sum, setSum] = useState('');
  const ws = ymd(wStart(at));
  const recent = m.log.filter(l => l.date >= ws).sort((a, b) => b.date.localeCompare(a.date));
  const id = (k: string) => `mc${m.id}${k}`;
  const pct = Math.round(p.share * 100);
  return (
    <div className="card s12 machine">
      <div className="ch">
        <Icon n="trend" className="ic" />
        <div><h3>{m.title}</h3><p>{p.done ? 'Ціль досягнуто' : `Бракує ${kr(p.now)}${m.due ? ` · до ${fmtDate(m.due)}${left !== null && left >= 0 ? ` (${left} ${plural(left, 'день', 'дні', 'днів')})` : ' · термін минув'}` : ''}`}</p></div>
        {m.url && <a className="sel" href={m.url} target="_blank" rel="noopener noreferrer">Дашборд</a>}
      </div>

      {!p.done && (
        <>
          <div className="funnel" aria-label="Від суми до дій">
            <div><small>Потрібно</small><b className="num">{kr(p.left)}</b></div>
            <Icon n="arrow" />
            <div><small>Клієнтів</small><b className="num">{p.clients}</b><em>по {kr(m.price)}</em></div>
            <Icon n="arrow" />
            <div><small>Лідів</small><b className="num">{p.leads}</b><em>конверсія {p.conv.pct}%{p.conv.real ? ' (за твоїми даними)' : ''}</em></div>
            <Icon n="arrow" />
            <div className="hot"><small>На тиждень</small><b className="num">{p.perWeek.leads} {plural(p.perWeek.leads, 'лід', 'ліди', 'лідів')}</b><em>{p.perWeek.clients} {plural(p.perWeek.clients, 'клієнт', 'клієнти', 'клієнтів')} · {p.weeksLeft} {plural(p.weeksLeft, 'тиждень', 'тижні', 'тижнів')}</em></div>
          </div>

          <div className="mweek">
            <h4>Цього тижня до «{m.title}» зроблено {pct}%</h4>
            <Part label="Ліди" done={p.week.leads} target={p.perWeek.leads} text={`${p.week.leads} з ${p.perWeek.leads}`} />
            <Part label="Клієнти" done={p.week.clients} target={p.perWeek.clients} text={`${p.week.clients} з ${p.perWeek.clients}`} />
            <Part label="Гроші" done={p.week.money} target={p.perWeek.money} text={`${fmtN(p.week.money)} з ${fmtN(p.perWeek.money)}`} />
          </div>
        </>
      )}

      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn" onClick={() => A.logMachine(m.id, { leads: 1 })}><Icon n="plus" className="icn sm" />Лід</button>
        <button className="btn acc" onClick={() => A.logMachine(m.id, { clients: 1, money: m.price })}><Icon n="plus" className="icn sm" />Клієнт · +{fmtN(m.price)}</button>
        <form className="row" style={{ gap: 6 }} onSubmit={e => { e.preventDefault(); const n = Math.round(+sum.replace(',', '.')); if (n) { A.logMachine(m.id, { money: n }); setSum(''); } }}>
          <input aria-label="Отримано грошей" className="gin" style={{ margin: 0, width: 110 }} inputMode="decimal" placeholder="+ гроші" value={sum} onChange={e => setSum(e.target.value)} />
          <button className="btn ghost sm" disabled={!sum}>Додати</button>
        </form>
      </div>

      {recent.length > 0 && (
        <div className="touches">
          <span className="muted" style={{ fontSize: 12 }}>Записи цього тижня</span>
          {recent.map(l => (
            <div className="item" key={l.id}>
              <span className="t">{fmtDate(l.date)} · {[l.leads && `${l.leads} ${plural(l.leads, 'лід', 'ліди', 'лідів')}`, l.clients && `${l.clients} ${plural(l.clients, 'клієнт', 'клієнти', 'клієнтів')}`, l.money && kr(l.money)].filter(Boolean).join(', ')}</span>
              <button className="ib" aria-label="Видалити запис" title="Видалити запис" onClick={() => A.delMachineLog(m.id, l.id)}><Icon n="x" /></button>
            </div>
          ))}
        </div>
      )}

      {edit && (
        <div className="gedit">
          <div className="fgrid">
            <label className="field" htmlFor={id('o')}>Для цілі<select id={id('o')} value={v.goal} onChange={e => setV({ ...v, goal: e.target.value })}><option value="">Без цілі</option>{S.goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>
            <label className="field" htmlFor={id('t')}>Назва<input id={id('t')} value={v.title} onChange={e => setV({ ...v, title: e.target.value })} /></label>
            <label className="field" htmlFor={id('g')}>Скільки потрібно, кр<input id={id('g')} type="number" min="1" value={v.target} onChange={e => setV({ ...v, target: e.target.value })} /></label>
            <label className="field" htmlFor={id('s')}>Вже є, кр<input id={id('s')} type="number" min="0" value={v.saved} onChange={e => setV({ ...v, saved: e.target.value })} /></label>
            <label className="field" htmlFor={id('d')}>До якого дня<input id={id('d')} type="date" value={v.due} onChange={e => setV({ ...v, due: e.target.value })} /></label>
            <label className="field" htmlFor={id('p')}>Скільки приносить клієнт, кр<input id={id('p')} type="number" min="1" value={v.price} onChange={e => setV({ ...v, price: e.target.value })} /></label>
            <label className="field" htmlFor={id('c')}>Лідів, що стають клієнтами, %<input id={id('c')} type="number" min="1" max="100" value={v.conv} onChange={e => setV({ ...v, conv: e.target.value })} /></label>
          </div>
          <button className="btn acc sm" style={{ alignSelf: 'flex-start' }} onClick={() => { A.updateMachine(m.id, { goal: +v.goal || null, title: v.title, target: +v.target, saved: +v.saved || 0, due: v.due, price: +v.price, conv: +v.conv }); setEdit(false); }}>Зберегти</button>
        </div>
      )}
      <div className="g2foot">
        <button className="btn ghost sm" onClick={() => setEdit(!edit)}><Icon n="edit" />{edit ? 'Закрити' : 'Змінити'}</button>
        <DelBtn label="Видалити ціль" onDelete={() => A.delMachine(m.id)} />
      </div>
    </div>
  );
}

function NewMachine({ first }: { first: boolean }) {
  const { S, A } = useStore();
  const [open, setOpen] = useState(first);
  const [v, setV] = useState({ goal: '', title: '', target: '', saved: '', due: '', price: '', conv: '20', url: '' });
  if (!open) return <button className="moretoggle" onClick={() => setOpen(true)}><Icon n="plus" className="icn sm" /><span>Нова ціль з грошима</span></button>;
  return (
    <div className="card s12">
      <div className="ch"><Icon n="goals" className="ic" /><div><h3>Нова ціль з грошима</h3><p>Скажи, скільки потрібно, і я розкладу на клієнтів, лідів і тиждень</p></div></div>
      <form className="cardcol" onSubmit={e => { e.preventDefault(); if (A.addMachine({ title: v.title, target: +v.target, saved: +v.saved || 0, due: v.due, price: +v.price, conv: +v.conv || 20, url: v.url, goal: +v.goal || undefined })) { setV({ goal: '', title: '', target: '', saved: '', due: '', price: '', conv: '20', url: '' }); setOpen(false); } }}>
        <div className="fgrid">
          <label className="field" htmlFor="nmO">Для цілі<select id="nmO" value={v.goal} onChange={e => setV({ ...v, goal: e.target.value })}><option value="">Без цілі</option>{S.goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>
          <label className="field" htmlFor="nmT">Що це<input id="nmT" value={v.title} placeholder="Машина" autoComplete="off" required onChange={e => setV({ ...v, title: e.target.value })} /></label>
          <label className="field" htmlFor="nmG">Скільки потрібно, кр<input id="nmG" type="number" min="1" required value={v.target} onChange={e => setV({ ...v, target: e.target.value })} /></label>
          <label className="field" htmlFor="nmS">Вже є, кр<input id="nmS" type="number" min="0" value={v.saved} onChange={e => setV({ ...v, saved: e.target.value })} /></label>
          <label className="field" htmlFor="nmD">До якого дня<input id="nmD" type="date" required value={v.due} onChange={e => setV({ ...v, due: e.target.value })} /></label>
          <label className="field" htmlFor="nmP">Скільки приносить один клієнт, кр<input id="nmP" type="number" min="1" required value={v.price} onChange={e => setV({ ...v, price: e.target.value })} /></label>
          <label className="field" htmlFor="nmC">Скільки лідів стає клієнтами, %<input id="nmC" type="number" min="1" max="100" value={v.conv} onChange={e => setV({ ...v, conv: e.target.value })} /></label>
        </div>
        <label className="field" htmlFor="nmU">Посилання на дашборд WebHjerte (необовʼязково)<input id="nmU" type="url" value={v.url} placeholder="https://…" onChange={e => setV({ ...v, url: e.target.value })} /></label>
        <div className="row"><button className="btn acc">Розкласти на тиждень</button>{!first && <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Скасувати</button>}</div>
      </form>
    </div>
  );
}

/** A goal that is a sum of money: the sum → clients → leads → this week's actions, and how much of this week is done. */
export function Machine() {
  const { S } = useStore();
  return (
    <section className="view">
      <div className="grid">
        {S.machines.map(m => <MachineCard key={m.id} m={m} />)}
        {!S.machines.length && <div className="card s12"><Empty icon="trend" title="Ціль → дії на тиждень" text="Машина, подорож, подушка безпеки: скільки це клієнтів, скільки лідів і що зробити цього тижня. Роботу записуєш тут, одним дотиком (дашборд WebHjerte поки що вносиш вручну)." /></div>}
        <NewMachine first={!S.machines.length} key={S.machines.length ? 'more' : 'first'} />
        {S.machines.length > 0 && <p className="help s12" style={{ gridColumn: 'span 12' }}>Тижневу норму рахую на початок тижня, тож вона не відсувається, коли ти працюєш. Коли ліди й клієнти записані 10 разів і більше, беру твою справжню конверсію замість здогадки.</p>}
      </div>
    </section>
  );
}
