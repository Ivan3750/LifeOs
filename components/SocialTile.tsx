'use client';

import { useStore } from '@/lib/store';
import { socialGoal, socialOn } from '@/lib/social';
import { hmPlain, pctW, TK } from '@/lib/util';

/** Today's minutes on social media with a quick +15 / +30, for the home page. */
export function SocialTile() {
  const { S, A, go } = useStore();
  const d = socialOn(S, TK());
  const limit = Object.values(S.socialGoals).reduce((a, b) => a + (b > 0 ? b : 0), 0);
  const worst = Object.entries(d.by).filter(([p, m]) => socialGoal(S, p) > 0 && m > socialGoal(S, p)).map(([p]) => p)[0];
  return (
    <div className="tile">
      <div className="lab"><span>Соцмережі</span><span>{limit ? `ліміт ${hmPlain(limit)}` : 'без лімітів'}</span></div>
      <div className="tv num">{d.total ? hmPlain(d.total) : '—'}</div>
      <div className="bar"><i style={{ width: pctW(d.total, limit || 90) + '%', background: d.over > 0 ? 'var(--m1)' : 'var(--good)' }} /></div>
      <div className="muted" style={{ fontSize: 11 }}>{worst ? `${worst}: понад ліміт` : d.total ? 'у межах лімітів' : 'ще нічого не записано'}</div>
      <div className="step"><button onClick={() => go('time')}>Відкрити</button><button onClick={() => A.addSocial({ platform: 'Instagram', min: 15 })}>+15 Insta</button></div>
    </div>
  );
}
