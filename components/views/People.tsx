'use client';

import { useState } from 'react';
import type { Person, Place } from '@/lib/types';
import { useStore } from '@/lib/store';
import { daysSince, KINDS, kindLabel, overdue, sortPlaces } from '@/lib/people';
import { fmtDate, TK } from '@/lib/util';
import { Icon } from '../Icon';
import { DelBtn, Empty } from '../shared';
import { sinceWord } from '../needs';

const toneOf = (r: number) => (r >= 1 ? 'red' : r >= 0.7 ? 'warn' : 'ok');

function PersonRow({ p }: { p: Person }) {
  const { S, A } = useStore();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: p.name, kind: p.kind, every: String(p.every), next: p.next || '', nextDate: p.nextDate || '' });
  const days = daysSince(S, p.id), tone = toneOf(overdue(S, p));
  const touches = S.touches.filter(t => t.person === p.id).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 4);
  const id = (k: string) => `pp${p.id}${k}`;
  return (
    <div className="person">
      <div className={`item hg ${tone}`}>
        <span className="ndot" aria-hidden="true" />
        <span className="t"><b>{p.name}</b><small>{kindLabel(p.kind)} · зв’язок {sinceWord(days)} · хочу раз на {p.every} дн.</small>
          {(p.next || p.nextDate) && <small className="nxt">Далі: {p.next || 'зустріч'}{p.nextDate ? ` · ${fmtDate(p.nextDate)}` : ''}</small>}</span>
        <button className="btn ghost sm" onClick={() => A.addTouch(p.id, 'msg')}>Написав</button>
        <button className="btn acc sm" onClick={() => A.addTouch(p.id, 'meet')}>Зустрівся</button>
        <button className="ib" title="Змінити" aria-label={`Змінити: ${p.name}`} aria-expanded={open} onClick={() => setOpen(!open)}><Icon n="edit" /></button>
      </div>
      {open && (
        <div className="gedit">
          <div className="fgrid">
            <label className="field" htmlFor={id('n')}>Імʼя<input id={id('n')} value={v.name} onChange={e => setV({ ...v, name: e.target.value })} /></label>
            <label className="field" htmlFor={id('k')}>Хто це<select id={id('k')} value={v.kind} onChange={e => setV({ ...v, kind: e.target.value as Person['kind'] })}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="field" htmlFor={id('e')}>Як часто, днів<input id={id('e')} type="number" min="1" max="365" value={v.every} onChange={e => setV({ ...v, every: e.target.value })} /></label>
          </div>
          <div className="fgrid">
            <label className="field" htmlFor={id('x')}>Що далі<input id={id('x')} value={v.next} placeholder="Напр. піти на каву" onChange={e => setV({ ...v, next: e.target.value })} /></label>
            <label className="field" htmlFor={id('d')}>Коли<input id={id('d')} type="date" value={v.nextDate} onChange={e => setV({ ...v, nextDate: e.target.value })} /></label>
          </div>
          {touches.length > 0 && (
            <div className="touches">
              <span className="muted" style={{ fontSize: 12 }}>Останні зустрічі й повідомлення</span>
              {touches.map(t => (
                <div className="item" key={t.id}><span className="t">{fmtDate(t.date)} · {t.kind === 'meet' ? 'зустріч' : 'повідомлення'}</span><button className="ib" aria-label="Видалити запис" title="Видалити запис" onClick={() => A.delTouch(t.id)}><Icon n="x" /></button></div>
              ))}
            </div>
          )}
          <div className="g2foot">
            <button className="btn acc sm" onClick={() => { A.updatePerson(p.id, { name: v.name, kind: v.kind, every: +v.every || p.every, next: v.next, nextDate: v.nextDate }); setOpen(false); }}>Зберегти</button>
            <DelBtn label="Видалити людину" onDelete={() => A.delPerson(p.id)} />
          </div>
        </div>
      )}
    </div>
  );
}

function PlaceRow({ p }: { p: Place }) {
  const { A } = useStore();
  const [pick, setPick] = useState(false);
  return (
    <div className="item place">
      <span className="t"><b>{p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer">{p.name}</a> : p.name}</b>
        <small>{[p.what, p.was ? `був ${fmtDate(p.was)}` : 'ще не був', p.going ? `іду ${fmtDate(p.going)}` : ''].filter(Boolean).join(' · ')}</small>
        {pick && <input type="date" aria-label={`Коли іду: ${p.name}`} defaultValue={p.going || ''} onChange={e => { A.updatePlace(p.id, { going: e.target.value }); setPick(false); }} />}
      </span>
      <button className="btn ghost sm" onClick={() => A.visitPlace(p.id)}>Був</button>
      <button className="ib" title="Коли іду" aria-label={`Коли іду: ${p.name}`} aria-pressed={pick} onClick={() => setPick(!pick)}><Icon n="schedule" /></button>
      <DelBtn label="Видалити місце" onDelete={() => A.delPlace(p.id)} />
    </div>
  );
}

/** People and places: who is in your life, when you last talked and what is next; clubs and communities with the day you were there or go. It opens as a window from the home page and the daily minimum. */
export function PeopleBody() {
  const { S, A } = useStore();
  const [f, setF] = useState({ name: '', kind: 'friend' as Person['kind'], every: '14', last: '' });
  const [pl, setPl] = useState({ name: '', what: '', url: '', going: '' });
  const ranked = [...S.people].sort((a, b) => overdue(S, b) - overdue(S, a) || a.name.localeCompare(b.name));
  return (
    <section className="peoplesheet">
      <div className="grid">
        <div className="card s7">
          <div className="ch"><Icon n="team" className="ic" /><div><h3>Люди</h3><p>Хто в тебе є, коли востаннє спілкувались і що далі. Найдовше без зв’язку: зверху</p></div></div>
          <div className="list">
            {ranked.map(p => <PersonRow key={p.id} p={p} />)}
            {!ranked.length && <Empty icon="team" title="Поки нікого" text="Додай 3–5 людей, з якими хочеш бути на зв’язку. Тоді щодня я підкажу, кому написати." />}
          </div>
          <form className="pform" onSubmit={e => { e.preventDefault(); if (A.addPerson({ name: f.name, kind: f.kind, every: +f.every || 14, last: f.last })) setF({ ...f, name: '', last: '' }); }}>
            <label className="field" htmlFor="pnName" style={{ flex: '2 1 160px' }}>Нова людина<input id="pnName" value={f.name} placeholder="Імʼя" autoComplete="off" onChange={e => setF({ ...f, name: e.target.value })} /></label>
            <label className="field" htmlFor="pnKind" style={{ flex: '1 1 120px' }}>Хто це<select id="pnKind" value={f.kind} onChange={e => { const k = e.target.value as Person['kind']; setF({ ...f, kind: k, every: String(KINDS.find(x => x[0] === k)![2]) }); }}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="field" htmlFor="pnEvery" style={{ flex: '1 1 90px' }}>Раз на, днів<input id="pnEvery" type="number" min="1" max="365" value={f.every} onChange={e => setF({ ...f, every: e.target.value })} /></label>
            <label className="field" htmlFor="pnLast" style={{ flex: '1 1 140px' }}>Востаннє<input id="pnLast" type="date" value={f.last} max={TK()} onChange={e => setF({ ...f, last: e.target.value })} /></label>
            <button className="btn acc" style={{ alignSelf: 'flex-end' }}><Icon n="plus" className="icn sm" />Додати</button>
          </form>
        </div>

        <div className="card s5">
          <div className="ch"><Icon n="map" className="ic" /><div><h3>Клуби й спільноти</h3><p>Де можна бути серед людей: коли був і коли йдеш</p></div></div>
          <div className="list">
            {sortPlaces(S.places).map(p => <PlaceRow key={p.id} p={p} />)}
            {!S.places.length && <Empty icon="map" title="Список порожній" text="Додай клуб, спільноту чи церкву у твоєму місті. Візит зарахується як спілкування." />}
          </div>
          <form className="pform" onSubmit={e => { e.preventDefault(); if (A.addPlace(pl)) setPl({ name: '', what: '', url: '', going: '' }); }}>
            <label className="field" htmlFor="plName" style={{ flex: '1 1 100%' }}>Нове місце<input id="plName" value={pl.name} placeholder="Назва" autoComplete="off" onChange={e => setPl({ ...pl, name: e.target.value })} /></label>
            <label className="field" htmlFor="plWhat" style={{ flex: '1 1 120px' }}>Що це<input id="plWhat" value={pl.what} placeholder="клуб, спорт, церква…" onChange={e => setPl({ ...pl, what: e.target.value })} /></label>
            <label className="field" htmlFor="plGoing" style={{ flex: '1 1 140px' }}>Коли іду<input id="plGoing" type="date" value={pl.going} onChange={e => setPl({ ...pl, going: e.target.value })} /></label>
            <label className="field" htmlFor="plUrl" style={{ flex: '1 1 100%' }}>Посилання<input id="plUrl" type="url" value={pl.url} placeholder="https://…" onChange={e => setPl({ ...pl, url: e.target.value })} /></label>
            <button className="btn acc"><Icon n="plus" className="icn sm" />Додати</button>
          </form>
        </div>
      </div>
    </section>
  );
}
