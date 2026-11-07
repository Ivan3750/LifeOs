'use client';

import { useState } from 'react';
import { useNow, useStore } from '@/lib/store';
import { addD, plural, ymd } from '@/lib/util';
import { BAD_DAY, MOMENTS, SECTORS, TALKS_GOAL, emptyLife, lifeOn, lifeScore, lifeWeek, recoveryFor, sectorHint, weakest } from '@/lib/life';
import { Icon } from './Icon';

const n1 = (v: number) => String(v).replace('.', ',');

/** The evening look at the day by six sectors of life. The score is the plain mean, so no sector buys back another. */
export function LifeCard() {
  const { S, A } = useStore();
  const now = useNow(60_000);
  const today = ymd(new Date(now)), yest = ymd(addD(new Date(now), -1));
  const [k, setK] = useState(today);
  const d = lifeOn(S, k) || emptyLife(), score = lifeScore(lifeOn(S, k)), low = weakest(lifeOn(S, k));
  const rec = recoveryFor(S, today), w = lifeWeek(S, new Date(now));
  const set = (v: Parameters<typeof A.setLife>[1]) => A.setLife(k, v);
  return (
    <div className="card s12 cardcol">
      <div className="ch" style={{ margin: 0 }}>
        <Icon n="life" className="ic" />
        <div><h3>Як я прожив день</h3><p>Не скільки зробив, а наскільки добре прожив. Шість сфер, і жодна не купує право на хороший день за рахунок інших</p></div>
        <div className="seg">
          <button aria-pressed={k === yest} onClick={() => setK(yest)}>Вчора</button>
          <button aria-pressed={k === today} onClick={() => setK(today)}>Сьогодні</button>
        </div>
      </div>

      {rec.on && k === today && (
        <div className="recovery">
          <b>Режим відновлення</b>
          <span>Вчора було {n1(rec.score)}/10. Сьогодні нічого не надолужуй: сон, одна важлива задача, рух, людина, нормальний вечір.{rec.next ? ` Ти казав, що допоможе: «${rec.next}».` : ''}</span>
        </div>
      )}

      <div className="lifegrid">
        {SECTORS.map(s => {
          const hint = sectorHint(S, k, s.key);
          return (
            <div className="lifeRow" key={s.key}>
              <div className="lifeHead"><b>{s.icon} {s.label}</b><small>{hint ? `${s.what} · ${hint}` : s.what}</small></div>
              <div className="lifechips" role="group" aria-label={s.label}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <button key={n} className={d[s.key] === n ? 'on' : ''} aria-pressed={d[s.key] === n} onClick={() => set({ [s.key]: d[s.key] === n ? 0 : n })}>{n}</button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="lifeScore">
        <div><span>Оцінка дня</span><b className="num">{score === null ? '—' : n1(score)}<i>/10</i></b></div>
        <p>{score === null ? 'Постав хоча б чотири сфери, і я порахую день.' : low && score < 10 ? `Найнижче: ${low.icon} ${low.label} (${low.v}). Чому сьогодні не 10? Це не вирок, а підказка, де перекіс.` : 'Рівний день.'}</p>
      </div>

      <div className="lifeMoments">
        <div>
          <b>😊 Хороші моменти</b>
          <div className="seg wrap">{MOMENTS.map((m, i) => <button key={m} aria-pressed={d.moments === i && i > 0} onClick={() => set({ moments: i })}>{m}</button>)}</div>
        </div>
        <div>
          <b>💬 Живі розмови сьогодні</b>
          <div className="stepper">
            <button className="btn ghost sm" onClick={() => set({ talks: d.talks - 1 })} disabled={d.talks <= 0}>−</button>
            <span className="num">{d.talks}</span>
            <button className="btn ghost sm" onClick={() => set({ talks: d.talks + 1 })}>+</button>
            <small>маленькі теж рахуються: слово після пар, повідомлення другу</small>
          </div>
        </div>
      </div>

      <div className="lifeText" key={k}>
        <label>Що сьогодні було хорошого? Один рядок<input defaultValue={d.moment} maxLength={280} placeholder="Після VIA довго говорив із другом і реально сміявся" onBlur={e => e.target.value !== d.moment && set({ moment: e.target.value.trim() })} /></label>
        <label>Чому сьогодні не 10?<input defaultValue={d.why} maxLength={280} onBlur={e => e.target.value !== d.why && set({ why: e.target.value.trim() })} /></label>
        <label>Що одна річ зробить завтра кращим?<input defaultValue={d.next} maxLength={280} onBlur={e => e.target.value !== d.next && set({ next: e.target.value.trim() })} /></label>
      </div>

      {w.days > 0 && (
        <div className="lifeWeek">
          <div className="cover-h"><b>7 днів по сферах</b><span className="num">{w.avg === null ? '' : `середнє ${n1(w.avg)}/10`}</span></div>
          {w.avgs.map(a => (
            <div className="lw" key={a.key}><span>{a.icon} {a.label}</span><div className="bar"><i style={{ width: (a.avg ?? 0) * 10 + '%', background: a.avg !== null && a.avg < 5 ? 'var(--accent)' : 'var(--good)' }} /></div><b className="num">{a.avg === null ? '—' : n1(a.avg)}</b></div>
          ))}
          <p className="help" style={{ margin: '6px 0 0' }}>
            Живих розмов цього тижня: {w.talks} із {TALKS_GOAL} {plural(TALKS_GOAL, 'бажаної', 'бажаних', 'бажаних')}. {w.talks < TALKS_GOAL ? 'Мета не результат, а експозиція: дівчата теж просто люди.' : 'Так тримати.'}
          </p>
          {w.note && <p className="help" style={{ margin: 0 }}>{w.note}</p>}
          {w.best.length > 0 && <p className="help" style={{ margin: 0 }}>Нещодавні хороші моменти: {w.best.map(b => '«' + b + '»').join(' · ')}</p>}
          <p className="help" style={{ margin: 0 }}>LifeOS це GPS, а не начальник. Оцінка до {BAD_DAY}/10 не про те, що ти поганий, а про те, де підправити завтра.</p>
        </div>
      )}
    </div>
  );
}
