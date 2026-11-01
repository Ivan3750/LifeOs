'use client';

import { useMemo, useState } from 'react';
import { AFFIRMATIONS, dailySet, flatAffirmations } from '@/lib/affirmations';
import { TK } from '@/lib/util';
import { Icon } from './Icon';

const TODAY = 'today';

/** Affirmations on the home page: the morning ten for today, or any theme. Read one aloud, then do one real thing. */
export function AffirmationsCard() {
  const day = TK();
  const [mode, setMode] = useState<string>(TODAY);
  const [i, setI] = useState(0);
  const pool = useMemo(() => (mode === TODAY ? dailySet(day, 10) : flatAffirmations(mode)), [mode, day]);
  const cur = pool[Math.min(i, pool.length - 1)];
  const group = AFFIRMATIONS.find(g => g.key === cur.group);
  const pick = (m: string) => { setMode(m); setI(0); };
  const step = (d: number) => setI(x => (x + d + pool.length) % pool.length);
  const shuffle = () => setI(x => (pool.length > 1 ? (x + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length : x));

  return (
    <div className="card s12 affcard">
      <div className="ch">
        <Icon n="flame" className="ic" />
        <div><h3>Афірмації</h3><p>Прочитай уголос, а потім зроби одну реальну дію</p></div>
        <span className="sel num">{i + 1} / {pool.length}</span>
      </div>
      <div className="affchips" role="tablist" aria-label="Тема афірмацій">
        <button role="tab" aria-selected={mode === TODAY} onClick={() => pick(TODAY)}>На сьогодні</button>
        {AFFIRMATIONS.map(g => <button key={g.key} role="tab" aria-selected={mode === g.key} onClick={() => pick(g.key)}><span aria-hidden="true">{g.emoji}</span> {g.title.split(':')[0]}</button>)}
      </div>
      <div className="affbody">
        <button className="rnd" aria-label="Попередня афірмація" onClick={() => step(-1)}><Icon n="left" /></button>
        <div className="afftext" aria-live="polite">
          <q key={cur.text}>{cur.text}</q>
          {group && <small>{group.emoji} {group.title}</small>}
        </div>
        <button className="rnd" aria-label="Наступна афірмація" onClick={() => step(1)}><Icon n="right" /></button>
      </div>
      <div className="affactions">
        <button className="btn ghost sm" onClick={shuffle}><Icon n="refresh" />Інша</button>
        {mode === TODAY && <span className="muted">Десять фраз на ранок, щодня нові</span>}
      </div>
    </div>
  );
}
