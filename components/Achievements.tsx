'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { achievementBadges, levelName, xpOf } from '@/lib/achievements';
import { Icon } from './Icon';

/** Level, experience and the badges: what has been earned and what is close. */
export function LevelCard() {
  const { S } = useStore();
  const [all, setAll] = useState(false);
  const badges = useMemo(() => achievementBadges(S), [S]);
  const x = useMemo(() => xpOf(S), [S]);
  const done = badges.filter(b => b.done).length;
  const close = badges.filter(b => !b.done).sort((a, b) => b.have / b.need - a.have / a.need);
  const shown = all ? [...badges.filter(b => b.done), ...close] : [...badges.filter(b => b.done).slice(-4), ...close.slice(0, 4)];
  return (
    <div className="card s12 levelcard">
      <div className="lv-top">
        <div className="lv-ring" style={{ ['--p' as string]: Math.round(x.pct * 100) + '%' }}><b className="num">{x.level}</b><small>рівень</small></div>
        <div className="lv-info">
          <h3>{levelName(x.level)}</h3>
          <p className="muted">{x.xp} XP · до наступного рівня ще {x.to - x.xp}. Досвід дають фокус, задачі, звички, гроші, цілі й бізнес.</p>
          <div className="bar" style={{ height: 8 }}><i style={{ width: Math.round(x.pct * 100) + '%', background: 'var(--accent)' }} /></div>
        </div>
        <button className="btn ghost sm" onClick={() => setAll(!all)}>{all ? 'Менше' : `Усі досягнення ${done}/${badges.length}`}</button>
      </div>
      <div className="badges">
        {shown.map(b => (
          <div key={b.id} className={`badge${b.done ? ' got' : ''}`} title={b.desc}>
            <span className="bi"><Icon n={b.icon} /></span>
            <b>{b.title}</b>
            {b.done ? <small>отримано</small> : <><small>{b.desc}</small><i className="bp"><u style={{ width: Math.round((b.have / b.need) * 100) + '%' }} /></i></>}
          </div>
        ))}
      </div>
    </div>
  );
}
