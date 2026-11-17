'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { AFFIRMATIONS, dailySet, FINAL_ORDERS, flatAffirmations, type Affirmation } from '@/lib/affirmations';
import { useStore } from '@/lib/store';
import { TK } from '@/lib/util';
import { Icon } from './Icon';
import { Burst } from './Burst';

const TODAY = 'today', FAV = 'fav', OWN = 'own', RITUAL = 3;

/** A stable small number from a string, to pick the same line for the same day. */
const pickBy = (s: string, n: number) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % Math.max(1, n); };

/** Affirmations as a morning ritual: read three aloud, mark them, then do one real thing. Favourites and your own lines are kept. */
export function AffirmationsCard() {
  const { S, A, go, setSheet } = useStore();
  const day = TK(), aff = S.aff ?? { own: [], fav: [], read: {} };
  const [mode, setMode] = useState<string>(TODAY);
  const [i, setI] = useState(0);
  const [draft, setDraft] = useState('');
  const read = aff.read[day] ?? [];
  const pool = useMemo<Affirmation[]>(() => {
    if (mode === TODAY) {
      const base = dailySet(day, 8), own = aff.own.map(text => ({ text, group: OWN }));
      // one or two of your own lines go into the day, so the ritual is partly yours
      return own.length ? [...base.slice(0, 7), own[pickBy(day, own.length)], ...base.slice(7)] : base;
    }
    if (mode === FAV) return aff.fav.map(text => ({ text, group: AFFIRMATIONS.find(g => g.items.includes(text))?.key ?? OWN }));
    if (mode === OWN) return aff.own.map(text => ({ text, group: OWN }));
    return flatAffirmations(mode);
  }, [mode, day, aff.own, aff.fav]);
  const cur = pool[Math.min(i, pool.length - 1)];
  const group = AFFIRMATIONS.find(g => g.key === cur?.group);
  const pick = (m: string) => { setMode(m); setI(0); };
  const step = (d: number) => setI(x => (x + d + pool.length) % Math.max(1, pool.length));
  const shuffle = () => setI(x => (pool.length > 1 ? (x + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length : x));
  const done = read.length >= RITUAL, isRead = !!cur && read.includes(cur.text), fav = !!cur && aff.fav.includes(cur.text);
  const faith = S.needs.find(n => n.key === 'faith'), people = S.people.length > 0;
  const nextAct: Record<string, { label: string; run: () => void }> = {
    business: S.machines.length ? { label: 'Записати лід чи клієнта', run: () => go('machine') } : { label: 'Фокус на WebHjerte', run: () => go('focus') },
    character: { label: 'Фокус 25 хвилин', run: () => go('focus') },
    ambition: { label: 'Фокус 25 хвилин', run: () => go('focus') },
    health: { label: 'Склянка води', run: () => A.addH('water', 1) },
    faith: faith ? { label: 'Відмітити: Віра', run: () => A.logNeed(faith.id) } : { label: 'Відкрити цілі', run: () => go('goals') },
    learning: { label: 'Фокус 25 хвилин', run: () => go('focus') },
    anela: { label: people ? 'Написати комусь теплого' : 'Додати людину', run: () => setSheet({ kind: 'people' }) },
    ukraine: { label: 'Одна нова дія', run: () => A.toggleDaily('nov') },
    humor: { label: 'Записати настрій', run: () => go('health') },
    future: { label: 'Подивитись на цілі', run: () => go('goals') },
    own: { label: 'Одна нова дія', run: () => A.toggleDaily('nov') },
  };
  const act = cur ? nextAct[cur.group] ?? nextAct.character : undefined;
  const markRead = () => { if (!cur) return; A.readAff(cur.text); if (pool.length > 1) step(1); };
  const add = (e: FormEvent) => { e.preventDefault(); if (A.addAffOwn(draft)) setDraft(''); };
  const order = FINAL_ORDERS[pickBy(day, FINAL_ORDERS.length)];

  return (
    <div className={`card s12 affcard${done ? ' ritual' : ''}`}>
      <div className="ch">
        <Icon n="flame" className="ic" />
        <div><h3>Афірмації</h3><p>{done ? 'Ритуал виконано: це крок. Тепер одна реальна дія' : `Прочитай уголос ${RITUAL}, відміть кожну. Прочитано: ${Math.min(read.length, RITUAL)} з ${RITUAL}`}</p></div>
        <span className="affdots" aria-label={`Прочитано ${read.length} з ${RITUAL}`}>{[...Array(RITUAL)].map((_, d) => <i key={d} className={d < read.length ? 'on' : ''} />)}</span>
      </div>
      {done && <Burst />}
      <div className="affchips" role="tablist" aria-label="Тема афірмацій">
        <button role="tab" aria-selected={mode === TODAY} onClick={() => pick(TODAY)}>На сьогодні</button>
        <button role="tab" aria-selected={mode === FAV} onClick={() => pick(FAV)}>♥ Улюблені{aff.fav.length ? ` · ${aff.fav.length}` : ''}</button>
        <button role="tab" aria-selected={mode === OWN} onClick={() => pick(OWN)}>✎ Мої{aff.own.length ? ` · ${aff.own.length}` : ''}</button>
        {AFFIRMATIONS.map(g => <button key={g.key} role="tab" aria-selected={mode === g.key} onClick={() => pick(g.key)}><span aria-hidden="true">{g.emoji}</span> {g.title.split(':')[0]}</button>)}
      </div>

      {cur ? (
        <>
          <div className="affbody">
            <button className="rnd" aria-label="Попередня афірмація" onClick={() => step(-1)}><Icon n="left" /></button>
            <div className={`afftext${isRead ? ' read' : ''}`} aria-live="polite">
              <q key={cur.text}>{cur.text}</q>
              <small>{group ? `${group.emoji} ${group.title}` : '✎ Моя афірмація'} · {Math.min(i, pool.length - 1) + 1} з {pool.length}</small>
            </div>
            <button className="rnd" aria-label="Наступна афірмація" onClick={() => step(1)}><Icon n="right" /></button>
          </div>
          <div className="affactions">
            <button className={`btn ${isRead ? 'ghost' : 'acc'}`} onClick={markRead} aria-pressed={isRead}><Icon n="check" />{isRead ? 'Прочитано' : 'Прочитав уголос'}</button>
            <button className={`ib big${fav ? ' on' : ''}`} aria-pressed={fav} aria-label={fav ? 'Прибрати з улюблених' : 'В улюблені'} title="Улюблена" onClick={() => A.toggleAffFav(cur.text)}>{fav ? '♥' : '♡'}</button>
            <button className="btn ghost sm" onClick={shuffle}><Icon n="refresh" />Інша</button>
          </div>
        </>
      ) : (
        <p className="muted" style={{ textAlign: 'center', margin: '18px 0' }}>{mode === FAV ? 'Тут будуть афірмації, які ти відмітиш серцем.' : 'Тут будуть твої власні слова. Додай першу нижче.'}</p>
      )}

      {done && act && (
        <div className="affnext">
          <div><small>Наказ собі на сьогодні</small><b>{order}</b></div>
          <button className="btn acc" onClick={act.run}><Icon n="arrow" />{act.label}</button>
        </div>
      )}

      {mode === OWN && (
        <form className="affadd" onSubmit={add}>
          <input aria-label="Моя афірмація" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Напиши своїми словами: «Я…»" maxLength={240} />
          <button className="btn acc" disabled={!draft.trim()}>Додати</button>
        </form>
      )}
      {mode === OWN && aff.own.length > 0 && <div className="list">{aff.own.map(t => <div className="item" key={t}><span className="t">{t}</span><button className="ib danger" aria-label="Видалити" title="Видалити" onClick={() => A.delAffOwn(t)}><Icon n="trash" /></button></div>)}</div>}
    </div>
  );
}
