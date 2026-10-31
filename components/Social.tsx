'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { PLATFORMS, SOCIAL_WHY, socialGoal, socialOn, socialPeriod } from '@/lib/social';
import { DN, hmPlain, pctW, TK, weekdayIdx } from '@/lib/util';
import { Icon } from './Icon';
import { DelBtn } from './shared';

const barColor = (m: number, g: number) => (g > 0 && m > g ? 'var(--m1)' : g > 0 && m > g * 0.8 ? 'var(--accent)' : 'var(--good)');

/** Time on social media: quick log, today against the limits, the week, and what the time was for. */
export function SocialCard() {
  const { S, A } = useStore();
  const k = TK(), d = socialOn(S, k), w = socialPeriod(S, 7);
  const [platform, setPlatform] = useState<string>('Instagram');
  const [why, setWhy] = useState('');
  const [cmp, setCmp] = useState(false);
  const [custom, setCustom] = useState('');
  const log = (min: number) => { if (A.addSocial({ platform, min, why, cmp })) { setCmp(false); setCustom(''); } };
  const platforms = [...new Set([...PLATFORMS, ...Object.keys(S.socialGoals), ...S.social.map(x => x.platform)])];
  const whyTotal = Object.values(w.why).reduce((a, b) => a + b, 0);
  const pre = w.perDay.slice(-7);
  const maxDay = Math.max(60, ...pre.map(p => p.total));
  return (
    <div className="card cardcol" id="social">
      <div className="ch" style={{ margin: 0 }}><Icon n="wave" className="ic" /><div><h3>Соцмережі</h3><p>Скільки часу йде на скрол і на що саме</p></div></div>

      <div className="socwhy">
        <b>Це не про те, що весь цей час марний.</b> Там є навчання, розваги, інформація. Проблема в іншому: легко потрапити в порівняння: чужий успішний бізнес, чужі гроші й результати, «AI замінить усіх». Тоді починаєш оцінювати власне життя через чужі відео. Тому рекомендація така: Instagram до 30 хв на день, YouTube до 60. Це не заборона, а спосіб бачити, скільки йде і чи після цього тобі краще. Ліміти можна змінити нижче.
      </div>

      <div>
        <div className="subh" style={{ margin: '0 0 10px' }}>Записати час</div>
        <div className="tags" role="group" aria-label="Платформа">{platforms.map(p => <button key={p} type="button" aria-pressed={platform === p} onClick={() => setPlatform(p)}>{p}</button>)}</div>
        <div className="tags" role="group" aria-label="Для чого" style={{ marginTop: 8 }}>
          {SOCIAL_WHY.map(x => <button key={x} type="button" aria-pressed={why === x} onClick={() => setWhy(why === x ? '' : x)}>{x}</button>)}
        </div>
        <label className="check" style={{ marginTop: 10 }}>
          <input type="checkbox" checked={cmp} onChange={e => setCmp(e.target.checked)} />
          <span className="box">{cmp && <Icon n="check" />}</span>Після цього порівняв себе з іншими
        </label>
        <div className="row" style={{ marginTop: 10 }}>
          {[5, 15, 30, 60].map(m => <button key={m} className="btn ghost sm" onClick={() => log(m)}>+{m} хв</button>)}
          <input className="tinyin" style={{ width: 110 }} type="number" min="1" max="720" inputMode="numeric" placeholder="Своя, хв" aria-label="Своя кількість хвилин" value={custom} onChange={e => setCustom(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') log(+custom); }} />
          <button className="btn sm" disabled={!(+custom > 0)} onClick={() => log(+custom)}>Додати</button>
        </div>
      </div>

      <div>
        <div className="subh" style={{ margin: '0 0 10px' }}>Сьогодні й ліміти</div>
        <div className="sclist">
          {platforms.filter(p => d.by[p] || socialGoal(S, p) > 0).map(p => {
            const m = d.by[p] || 0, g = socialGoal(S, p);
            return (
              <div className="sc" key={p}>
                <div className="sc-h"><b>{p}</b><span className="num">{m} хв{g > 0 ? ` / ${g}` : ''}</span></div>
                <div className="bar"><i style={{ width: g > 0 ? pctW(m, g) + '%' : '100%', background: g > 0 ? barColor(m, g) : 'var(--bar)' }} /></div>
                <label className="sc-g">Ліміт, хв на день<input type="number" min="0" max="600" inputMode="numeric" defaultValue={g || ''} placeholder="без ліміту" key={p + g} onBlur={e => { const n = +e.target.value || 0; if (n !== g) A.setSocialGoal(p, n); }} /></label>
              </div>
            );
          })}
        </div>
        {d.list.length > 0 && (
          <div className="list" style={{ marginTop: 8 }}>
            {[...d.list].reverse().map(x => (
              <div className="item" key={x.id}>
                <span className="t">{x.platform} · {x.min} хв{x.why && <span className="muted"> · {x.why.toLowerCase()}</span>}</span>
                <button className={`chipbtn${x.cmp ? ' on' : ''}`} aria-pressed={!!x.cmp} title="Порівняв себе з іншими" onClick={() => A.toggleCompare(x.id)}>порівняв</button>
                <DelBtn label="Видалити запис" onDelete={() => A.delSocial(x.id)} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="subh" style={{ margin: '0 0 10px' }}>Тиждень</div>
        <div className="kv k3">
          <div><span className="k">Усього</span><span className="v num">{w.total ? hmPlain(w.total) : '—'}</span></div>
          <div><span className="k">Понад ліміт</span><span className="v num">{w.overDays}<small>{w.overDays === 1 ? 'день' : 'днів'}</small></span></div>
          <div><span className="k">Порівняння</span><span className="v num">{w.compared}<small>{w.compared === 1 ? 'день' : 'днів'}</small></span></div>
        </div>
        <div className="scbars" aria-label="Хвилини по днях">
          {pre.map(p => { const dt = new Date(p.k + 'T00:00'); return <div key={p.k} className={p.k === k ? 'today' : ''} title={`${p.k}: ${p.total} хв`}><i style={{ height: Math.max(3, (p.total / maxDay) * 64), background: p.over > 0 ? 'var(--m1)' : p.total ? 'var(--good)' : 'var(--bar)' }} /><span>{DN[weekdayIdx(dt)]}</span></div>; })}
        </div>
        {whyTotal > 0 && (
          <div className="cats" style={{ marginTop: 14 }}>
            {Object.entries(w.why).sort((a, b) => b[1] - a[1]).map(([x, m]) => <div className="catrow" key={x}><span>{x}</span><div className="bar"><i style={{ width: pctW(m, whyTotal) + '%' }} /></div><span className="num" style={{ textAlign: 'right' }}>{hmPlain(m)}</span></div>)}
          </div>
        )}
        {w.compared >= 2 && <p className="help" style={{ margin: '12px 0 0' }}>Уже {w.compared} {w.compared < 5 ? 'дні' : 'днів'} цього тижня ти ловив себе на порівнянні. Якщо після відео тобі гірше, а не краще, це знак: закрий застосунок і зроби один крок до власної цілі.</p>}
      </div>
    </div>
  );
}
