'use client';

import { useState } from 'react';
import type { Need } from '@/lib/types';
import type { NeedStat } from '@/lib/needs';
import { useStore } from '@/lib/store';
import { DN, MON, plural, wStart } from '@/lib/util';
import { Icon } from '../Icon';
import { DelBtn } from '../shared';
import { DailyCard, HungerTag, NeedBar, useNeeds } from '../needs';

const DAYS_OPTS: [Need['days'], string][] = [['any', 'Будь-який день'], ['weekend', 'Вихідні'], ['weekdays', 'Будні']];

/** Everything about one need that can be changed. */
function NeedEditor({ n }: { n: Need }) {
  const { S, A } = useStore();
  const [v, setV] = useState({ goal: String(n.goal ?? ''), name: n.name, weekly: String(n.weekly), min: String(n.min), from: n.from, to: n.to, days: n.days, kw: (n.kw || []).join(', ') });
  const save = () => A.updateNeed(n.id, { name: v.name, weekly: +v.weekly || n.weekly, min: +v.min || n.min, from: v.from || n.from, to: v.to || n.to, goal: +v.goal || null, days: v.days, kw: v.kw.split(',').map(x => x.trim().toLowerCase()).filter(Boolean) });
  const id = (k: string) => `ne${n.id}${k}`;
  return (
    <div className="gedit">
      <div className="fgrid">
        <label className="field" htmlFor={id('g')}>Для цілі<select id={id('g')} value={v.goal} onChange={e => setV({ ...v, goal: e.target.value })}><option value="">Без цілі (основа)</option>{S.goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>
        <label className="field" htmlFor={id('n')}>Назва<input id={id('n')} value={v.name} onChange={e => setV({ ...v, name: e.target.value })} /></label>
        <label className="field" htmlFor={id('w')}>Разів на тиждень<input id={id('w')} type="number" min="1" max="14" value={v.weekly} onChange={e => setV({ ...v, weekly: e.target.value })} /></label>
        <label className="field" htmlFor={id('m')}>Один раз, хвилин<input id={id('m')} type="number" min="5" max="480" value={v.min} onChange={e => setV({ ...v, min: e.target.value })} /></label>
        <label className="field" htmlFor={id('d')}>Дні<select id={id('d')} value={v.days} onChange={e => setV({ ...v, days: e.target.value as Need['days'] })}>{DAYS_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="field" htmlFor={id('f')}>Зручно з<input id={id('f')} type="time" value={v.from} onChange={e => setV({ ...v, from: e.target.value })} /></label>
        <label className="field" htmlFor={id('t')}>Зручно до<input id={id('t')} type="time" value={v.to} onChange={e => setV({ ...v, to: e.target.value })} /></label>
      </div>
      <label className="field" htmlFor={id('k')}>Рахувати події календаря, у назві яких є…
        <input id={id('k')} value={v.kw} placeholder="слова через кому, напр. данськ, dansk" onChange={e => setV({ ...v, kw: e.target.value })} />
      </label>
      <p className="help">Минулі події з цими словами зараховуються самі. Слоти, додані з плану тижня, зараховуються після відмітки.</p>
      <div className="g2foot">
        <button className="btn acc sm" onClick={save}>Зберегти</button>
        <DelBtn label="Видалити потребу" onDelete={() => A.delNeed(n.id)} />
      </div>
    </div>
  );
}

function Settings() {
  const { S, A } = useStore();
  const [open, setOpen] = useState<number | null>(null);
  const [name, setName] = useState(''), [weekly, setWeekly] = useState('3');
  return (
    <div className="card s12">
      <div className="ch"><Icon n="prefs" className="ic" /><div><h3>Налаштувати потреби</h3><p>Скільки разів на тиждень, скільки триває один раз і коли зручно</p></div></div>
      <div className="list">
        {S.needs.map(n => (
          <div key={n.id} className="nset">
            <div className="item">
              <button className={`chk${n.on ? ' on' : ''}`} role="checkbox" aria-checked={n.on} aria-label={`${n.on ? 'Вимкнути' : 'Увімкнути'}: ${n.name}`} onClick={() => A.updateNeed(n.id, { on: !n.on })}>{n.on && <Icon n="check" />}</button>
              <span className={`t${n.on ? '' : ' muted'}`}>{n.name}<small>{n.weekly} {plural(n.weekly, 'раз', 'рази', 'разів')} на тиждень · {n.min} хв</small></span>
              <button className="ib" title="Змінити" aria-label={`Змінити: ${n.name}`} aria-expanded={open === n.id} onClick={() => setOpen(open === n.id ? null : n.id)}><Icon n="edit" /></button>
            </div>
            {open === n.id && <NeedEditor n={n} />}
          </div>
        ))}
      </div>
      <form className="row" style={{ marginTop: 12 }} onSubmit={e => { e.preventDefault(); if (A.addNeed({ name, weekly: +weekly || 3 })) { setName(''); setWeekly('3'); } }}>
        <label className="field" htmlFor="newNeed" style={{ flex: '1 1 180px' }}>Нова потреба<input id="newNeed" value={name} placeholder="Напр. Читання" autoComplete="off" onChange={e => setName(e.target.value)} /></label>
        <label className="field" htmlFor="newNeedW" style={{ flex: '0 1 110px' }}>Разів на тиждень<input id="newNeedW" type="number" min="1" max="14" value={weekly} onChange={e => setWeekly(e.target.value)} /></label>
        <button className="btn acc" style={{ alignSelf: 'flex-end' }}><Icon n="plus" className="icn sm" />Додати</button>
      </form>
    </div>
  );
}

function NeedRow({ st, today }: { st: NeedStat; today: number }) {
  const { A } = useStore();
  return (
    <div className={`nrow hg ${st.status}`} key={st.need.id}>
      <div className="nmain">
        <b>{st.need.name}</b>
        <HungerTag st={st} />
        <span className="muted num" style={{ fontSize: 13, marginLeft: 'auto' }}>{st.done} з {st.need.weekly}</span>
      </div>
      <NeedBar st={st} />
      <div className="nfoot">
        <span className="ndots" aria-hidden="true">{DN.map((d, i) => <i key={d} className={st.byDay[i] ? 'on' : i === today ? 'now' : ''} title={d}>{d[0]}</i>)}</span>
        <small className="muted">{st.planned ? `заплановано ще ${st.planned}` : ''}{st.planned && st.auto ? ' · ' : ''}{st.auto ? `знайдено в даних: ${st.auto}` : ''}</small>
        <span className="nact">
          {st.manual > 0 && <button className="ib" title="Забрати останню відмітку" aria-label={`Забрати відмітку: ${st.need.name}`} onClick={() => A.unlogNeed(st.need.id)}><Icon n="left" className="icn sm" /></button>}
          <button className="btn acc sm" aria-label={`Відмітити: ${st.need.name}`} onClick={() => A.logNeed(st.need.id)}><Icon n="plus" className="icn sm" />Було</button>
        </span>
      </div>
    </div>
  );
}

/** The dashboard of needs: which ones are hungry this week. */
export function Needs() {
  const { S, A, go } = useStore();
  const { stats, now } = useNeeds();
  const ws = wStart(new Date(now)), end = new Date(ws.getTime() + 6 * 864e5);
  const red = stats.filter(s => s.status === 'red').length, warn = stats.filter(s => s.status === 'warn').length;
  const today = (new Date(now).getDay() + 6) % 7;
  const linked = (g: number) => stats.filter(s => s.need.goal === g);
  const groups = [...S.goals.filter(g => linked(g.id).length).map(g => ({ id: g.id, title: g.title, items: linked(g.id) })), { id: 0, title: '', items: stats.filter(s => !s.need.goal || !S.goals.some(g => g.id === s.need.goal)) }].filter(g => g.items.length);
  return (
    <section className="view">
      <div className="grid">
        <div className="card s12">
          <div className="ch">
            <Icon n="needs" className="ic" />
            <div>
              <h3>Потреби тижня</h3>
              <p>{ws.getDate()} {MON[ws.getMonth()]} – {end.getDate()} {MON[end.getMonth()]} · {red ? `${red} ${plural(red, 'голодна', 'голодні', 'голодних')}` : warn ? `${warn} ${plural(warn, 'просить', 'просять', 'просять')} уваги` : 'усе в нормі'}</p>
            </div>
            <button className="sel" onClick={() => go('plan')}>Скласти план</button>
          </div>
          <div className="list">
            {groups.map(g => (
              <div key={g.id} className="ngroup">
                <h4>{g.id ? <>Для цілі «{g.title}»</> : 'Основа: що потрібно завжди'}{g.id > 0 && <button className="linkbtn" onClick={() => go('goals')}>до цілі</button>}</h4>
                {g.items.map(st => <NeedRow key={st.need.id} st={st} today={today} />)}
              </div>
            ))}
            {!stats.length && <p className="muted" style={{ margin: 0 }}>Усі потреби вимкнені. Увімкни їх нижче.</p>}
          </div>
          <p className="help" style={{ marginTop: 12 }}>Зелена: тиждень іде за темпом або ціль виконана. Жовта: трохи позаду. Червона: бракує так, що вже не наздогнати без окремого часу. Минулі події календаря, тренування з розділу «Тіло» і зустрічі з людей рахуються самі.</p>
        </div>

        <DailyCard cls="s12" />
        <Settings />
        {S.needs.length === 0 && <button className="btn" onClick={() => A.addNeed({ name: 'Спорт', weekly: 4 })}>Додати першу потребу</button>}
      </div>
    </section>
  );
}
