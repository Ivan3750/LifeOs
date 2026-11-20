'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import type { AutoIdea } from '@/lib/types';
import { EFFORT, potential, PRIORITY, ranked, repeating, STATUS, weeklyMinutes } from '@/lib/automation';
import { hmPlain } from '@/lib/util';
import { Icon } from '../Icon';
import { DelBtn, Empty } from '../shared';

function Row({ a }: { a: AutoIdea }) {
  const { A } = useStore();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ mins: a.mins ? String(a.mins) : '', perWeek: a.perWeek ? String(a.perWeek) : '' });
  const w = weeklyMinutes(a), id = (k: string) => `au${a.id}${k}`;
  return (
    <div className="autorow">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{a.title}</b>
          {a.what && <p className="help" style={{ margin: '2px 0 0' }}>{a.what}</p>}
        </div>
        <span className={`pri ${a.status === 'done' ? 'done' : a.priority === 'high' ? 'high' : ''}`}>{a.status === 'done' ? STATUS.done : `Пріоритет: ${PRIORITY[a.priority].toLowerCase()}`}</span>
      </div>
      <div className="meta">
        <span>Складність: {EFFORT[a.effort].toLowerCase()}</span>
        <span>· {w !== null ? `ручна робота ≈ ${hmPlain(w)} на тиждень (за твоєю оцінкою)` : 'час не вказано'}</span>
        <span>· помічено разів: {a.seen}</span>
        <span>· {STATUS[a.status].toLowerCase()}</span>
      </div>
      <div className="row">
        <button className="btn ghost sm" onClick={() => A.seenAuto(a.id)}>Знову вручну</button>
        {a.status !== 'doing' && a.status !== 'done' && <button className="btn ghost sm" onClick={() => A.updateAuto(a.id, { status: 'doing' })}>Беруся</button>}
        {a.status !== 'done' ? <button className="btn ghost sm" onClick={() => A.updateAuto(a.id, { status: 'done' })}>Автоматизовано</button> : <button className="btn ghost sm" onClick={() => A.updateAuto(a.id, { status: 'idea' })}>Повернути</button>}
        <button className="btn ghost sm" aria-expanded={open} onClick={() => setOpen(!open)}>Змінити</button>
        <DelBtn label="Видалити можливість" onDelete={() => A.delAuto(a.id)} />
      </div>
      {open && (
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field" htmlFor={id('m')} style={{ flex: '1 1 110px' }}>Хвилин за раз<input id={id('m')} type="number" min="0" inputMode="numeric" value={v.mins} onChange={e => setV({ ...v, mins: e.target.value })} /></label>
          <label className="field" htmlFor={id('p')} style={{ flex: '1 1 110px' }}>Разів на тиждень<input id={id('p')} type="number" min="0" inputMode="numeric" value={v.perWeek} onChange={e => setV({ ...v, perWeek: e.target.value })} /></label>
          <label className="field" htmlFor={id('e')} style={{ flex: '1 1 120px' }}>Складність<select id={id('e')} value={a.effort} onChange={e => A.updateAuto(a.id, { effort: e.target.value as AutoIdea['effort'] })}>{(Object.keys(EFFORT) as AutoIdea['effort'][]).map(k => <option key={k} value={k}>{EFFORT[k]}</option>)}</select></label>
          <label className="field" htmlFor={id('r')} style={{ flex: '1 1 120px' }}>Пріоритет<select id={id('r')} value={a.priority} onChange={e => A.updateAuto(a.id, { priority: e.target.value as AutoIdea['priority'] })}>{(Object.keys(PRIORITY) as AutoIdea['priority'][]).map(k => <option key={k} value={k}>{PRIORITY[k]}</option>)}</select></label>
          <button className="btn acc sm" onClick={() => { A.updateAuto(a.id, { mins: +v.mins || 0, perWeek: +v.perWeek || 0 }); setOpen(false); }}>Зберегти</button>
        </div>
      )}
    </div>
  );
}

/** What in the business is done by hand again and again and could be automated. Numbers are the person's own; none are guessed. */
export function Automation() {
  const { S, A } = useStore();
  const [f, setF] = useState({ title: '', what: '', mins: '', perWeek: '', effort: 'mid' as AutoIdea['effort'], priority: 'mid' as AutoIdea['priority'] });
  const list = ranked(S.co.auto), pot = potential(S.co.auto), rep = repeating(S);
  return (
    <section className="view">
      <div className="vh"><div><h2>Автоматизація</h2><p>Що в роботі робиться вручну знову й знову. Менше ручної праці, більше вільного часу</p></div></div>
      <div className="grid">
        <div className="card s5">
          <div className="ch"><Icon n="plus" className="ic" /><div><h3>Нова можливість</h3><p>Що можна автоматизувати</p></div></div>
          <form className="stack" onSubmit={e => { e.preventDefault(); if (A.addAuto({ title: f.title, what: f.what, mins: +f.mins || 0, perWeek: +f.perWeek || 0, effort: f.effort, priority: f.priority })) setF({ ...f, title: '', what: '', mins: '', perWeek: '' }); }}>
            <label className="field" htmlFor="auT">Назва<input id="auT" value={f.title} placeholder="Напр. виставлення рахунків клієнтам" onChange={e => setF({ ...f, title: e.target.value })} /></label>
            <label className="field" htmlFor="auW">Що саме робиться вручну<textarea id="auW" rows={2} value={f.what} onChange={e => setF({ ...f, what: e.target.value })} /></label>
            <div className="row">
              <label className="field" htmlFor="auM" style={{ flex: '1 1 110px' }}>Хвилин за раз<input id="auM" type="number" min="0" inputMode="numeric" value={f.mins} placeholder="не знаю" onChange={e => setF({ ...f, mins: e.target.value })} /></label>
              <label className="field" htmlFor="auP" style={{ flex: '1 1 110px' }}>Разів на тиждень<input id="auP" type="number" min="0" inputMode="numeric" value={f.perWeek} placeholder="не знаю" onChange={e => setF({ ...f, perWeek: e.target.value })} /></label>
            </div>
            <div className="row">
              <label className="field" htmlFor="auE" style={{ flex: '1 1 120px' }}>Складність<select id="auE" value={f.effort} onChange={e => setF({ ...f, effort: e.target.value as AutoIdea['effort'] })}>{(Object.keys(EFFORT) as AutoIdea['effort'][]).map(k => <option key={k} value={k}>{EFFORT[k]}</option>)}</select></label>
              <label className="field" htmlFor="auR" style={{ flex: '1 1 120px' }}>Пріоритет<select id="auR" value={f.priority} onChange={e => setF({ ...f, priority: e.target.value as AutoIdea['priority'] })}>{(Object.keys(PRIORITY) as AutoIdea['priority'][]).map(k => <option key={k} value={k}>{PRIORITY[k]}</option>)}</select></label>
            </div>
            <button className="btn acc" style={{ alignSelf: 'flex-start' }} disabled={!f.title.trim()}>Додати</button>
            <p className="help">Якщо не знаєш, скільки це займає, залиш порожнім. Я не вгадую час, а лише рахую те, що ти вказав.</p>
          </form>
        </div>
        <div className="card s7">
          <div className="ch"><Icon n="trend" className="ic" /><div><h3>Можливості</h3>
            <p>{pot.open ? (pot.known ? `Вручну це займає ≈ ${hmPlain(pot.minutes)} на тиждень (за ${pot.known} з ${pot.open} оцінок, які ти вказав)` : `${pot.open} без оцінки часу`) : 'Поки порожньо'}</p></div></div>
          {list.map(a => <Row key={a.id} a={a} />)}
          {!list.length && <Empty icon="refresh" title="Можливостей поки немає" text="Додай те, що робиш вручну частіше за раз на тиждень. Навіть одна справа вже корисна." />}
        </div>
        {rep.length > 0 && (
          <div className="card s12">
            <div className="ch"><Icon n="refresh" className="ic" /><div><h3>Схоже, це повторюється</h3><p>Задачі, які трапляються знову й знову, або позначені як повторювані</p></div></div>
            <div className="list">
              {rep.map(r => (
                <div className="item" key={r.title}>
                  <span className="t"><b>{r.title}</b><small>{r.rep ? 'повторювана задача' : `у задачах ${r.times} р.`}</small></span>
                  <button className="btn ghost sm" onClick={() => A.addAuto({ title: r.title })}>До можливостей</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
