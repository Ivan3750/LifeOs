'use client';

import { useMemo, useState } from 'react';
import { useNow, useStore } from '@/lib/store';
import { catOf, dayRange, EV_CATS, eventGroups, timeLedger } from '@/lib/timeuse';
import { addD, hmPlain, plural, sod } from '@/lib/util';
import { Icon } from '../Icon';
import { Empty } from '../shared';
import { SocialCard } from '../Social';

const PERIODS = [['day', 'Сьогодні', 0], ['week', '7 днів', 6], ['month', '30 днів', 29]] as const;

/** Buttons with the categories: one tap says what an event is. */
function CatPicker({ onPick, current }: { onPick: (cat: string) => void; current?: string | null }) {
  return <div className="tags" role="group" aria-label="Що це">{EV_CATS.map(c => <button key={c.key} type="button" aria-pressed={current === c.key} onClick={() => onPick(c.key)}><i className="catdot" style={{ background: c.color }} />{c.label}</button>)}</div>;
}

export function TimePage() {
  const { S, A, eventsOn } = useStore();
  const now = useNow(60_000);
  const [period, setPeriod] = useState<(typeof PERIODS)[number][0]>('week');
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const n = PERIODS.find(p => p[0] === period)![2];
  const days = useMemo(() => dayRange(addD(sod(new Date(now)), -n), new Date(now)), [now, n]);
  const groups = eventGroups(S, days, eventsOn);
  const ledger = timeLedger(S, days, eventsOn, now);
  const asked = groups.filter(g => g.source === 'guess' || g.source === 'none');
  const guesses = asked.filter(g => g.source === 'guess');
  const known = Object.entries(S.evCats).sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));
  const evTotal = groups.reduce((a, g) => a + g.min, 0);
  const titlesOf = (cat: string) => groups.filter(g => (g.cat || 'other') === cat);

  return (
    <section className="view">
      <div className="vh"><div><h2>Час</h2><p>Куди йде твій час: події з календаря, фокус, справи, сон і соцмережі. Про незрозумілі події я питаю й запамʼятовую відповідь.</p></div></div>

      <div className="card cardcol">
        <div className="seg" role="group" aria-label="Період" style={{ alignSelf: 'flex-start' }}>
          {PERIODS.map(([k, l]) => <button key={k} aria-pressed={period === k} onClick={() => setPeriod(k)}>{l}</button>)}
        </div>
        <div className="ch" style={{ margin: 0 }}><Icon n="clock" className="ic" /><div><h3>Куди йде час</h3><p>{ledger.total ? `Усього ${hmPlain(ledger.total)} за період. Те, що збігається за часом, рахується один раз` : 'За цей період ще нема даних'}</p></div></div>
        {ledger.total > 0 && (
          <>
            <div className="stackbar" role="img" aria-label="Розподіл часу">{ledger.rows.map(r => <i key={r.key} title={`${r.label}: ${hmPlain(r.min)}`} style={{ width: (r.min / ledger.total) * 100 + '%', background: r.color }} />)}</div>
            <div className="ledger">
              {ledger.rows.map(r => {
                const cat = r.key.startsWith('ev:') ? r.key.slice(3) : null, list = cat ? titlesOf(cat) : [];
                return (
                  <div key={r.key} className="lrow">
                    <button className="lhead" disabled={!list.length} aria-expanded={open === r.key} onClick={() => setOpen(open === r.key ? null : r.key)}>
                      <i className="catdot" style={{ background: r.color }} /><span className="lname">{r.label}</span>
                      <span className="num lval">{hmPlain(r.min)}</span><span className="num lpct">{Math.round((r.min / ledger.total) * 100)}%</span>
                    </button>
                    {open === r.key && list.length > 0 && <div className="lsub">{list.map(g => <div key={g.norm}><span>{g.title}{g.count > 1 && <span className="muted"> × {g.count}</span>}</span><span className="num">{hmPlain(g.min)}</span></div>)}</div>}
                  </div>
                );
              })}
            </div>
          </>
        )}
        {!ledger.total && <Empty icon="clock" title="Ще нема що показувати" text="Додай події в розклад, запусти таймер фокусу або запиши сон, і тут зʼявиться розподіл." />}
      </div>

      <div className="card cardcol" id="ev-ask">
        <div className="ch" style={{ margin: 0 }}><Icon n="schedule" className="ic" /><div><h3>Що це за подія?</h3><p>{asked.length ? `${asked.length} ${plural(asked.length, 'назва', 'назви', 'назв')} без підтвердженої категорії. Відповідь запамʼятається, і схожі події я впізнаватиму сам` : 'Усі події за цей період мені зрозумілі'}</p></div></div>
        {guesses.length > 1 && <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => guesses.forEach(g => A.assignEvent(g.title, g.cat!))}>Підтвердити всі здогади ({guesses.length})</button>}
        <div className="askl">
          {(showAll ? asked : asked.slice(0, 5)).map(g => (
            <div className="ask" key={g.norm}>
              <div className="ask-h"><b>{g.title}</b><span className="muted">{g.count} {plural(g.count, 'раз', 'рази', 'разів')} · {hmPlain(g.min)}</span></div>
              {g.cat && <div className="ask-g"><span>Схоже на: <b>{catOf(g.cat).label}</b></span><button className="btn sm" onClick={() => A.assignEvent(g.title, g.cat!)}>Так</button></div>}
              <CatPicker current={g.cat} onPick={c => A.assignEvent(g.title, c)} />
            </div>
          ))}
        </div>
        {asked.length > 5 && <button className="linkbtn" style={{ alignSelf: 'flex-start' }} onClick={() => setShowAll(!showAll)}>{showAll ? 'Показати менше' : `Показати всі (${asked.length})`}</button>}
        {!asked.length && groups.length === 0 && <p className="help" style={{ margin: 0 }}>Подій у календарі за цей період немає.</p>}
        {evTotal > 0 && <p className="help" style={{ margin: 0 }}>Події за період: {hmPlain(evTotal)}.</p>}
      </div>

      <SocialCard />

      <div className="card cardcol">
        <div className="ch" style={{ margin: 0 }}><Icon n="map" className="ic" /><div><h3>Що я вже знаю</h3><p>Назви подій і їхні категорії. Можна змінити або прибрати</p></div></div>
        {known.length ? (
          <div className="list">
            {known.map(([norm, cat]) => (
              <div className="item known" key={norm}>
                <span className="t">{norm}</span>
                <select aria-label={`Категорія для ${norm}`} value={cat} onChange={e => A.assignEvent(norm, e.target.value)}>{EV_CATS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
                <button className="ib danger" title="Забути" aria-label={`Забути: ${norm}`} onClick={() => A.forgetEvent(norm)}><Icon n="x" /></button>
              </div>
            ))}
          </div>
        ) : <p className="help" style={{ margin: 0 }}>Поки що я нічого не запамʼятав. Відповідай на питання вище, і тут зʼявиться список.</p>}
      </div>
    </section>
  );
}
