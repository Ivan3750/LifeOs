'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { weekKey } from '@/lib/needs';
import { RATING_WORDS, suggest } from '@/lib/review';
import { addD, fmtDate, ymd } from '@/lib/util';
import { useWeek } from '../needs';
import { Icon } from '../Icon';
import { Empty } from '../shared';

/** The Sunday review: a mark from 1 to 5 for each need, then one or two changes for the next week. */
export function Review() {
  const { S, A, go } = useStore();
  const [prev, setPrev] = useState(false);
  const { stats, wsT } = useWeek(prev ? -1 : 0), ws = new Date(wsT), wk = weekKey(ws), end = addD(ws, 6);
  const r = S.reviews[wk], ratings = r?.ratings || {};
  const rated = stats.filter(s => ratings[s.need.id]).length;
  const sg = suggest(stats, ratings);
  const accepted = new Set(r?.accepted || []);
  if (!stats.length) return <section className="view"><div className="grid"><div className="card s12"><Empty icon="needs" title="Немає потреб" text="Увімкни потреби, щоб оцінити тиждень."><button className="btn acc" onClick={() => go('needs')}>До потреб</button></Empty></div></div></section>;
  return (
    <section className="view">
      <div className="grid">
        <div className="card s7">
          <div className="ch">
            <Icon n="check" className="ic" />
            <div><h3>Огляд тижня · 5 хвилин</h3><p>{fmtDate(wk)} – {fmtDate(ymd(end))}. Оціни кожну потребу від 1 до 5: чи вистачило</p></div>
          </div>
          <div className="subtabs" role="tablist" style={{ marginBottom: 12 }}>
            <button role="tab" aria-selected={!prev} onClick={() => setPrev(false)}>Цей тиждень</button>
            <button role="tab" aria-selected={prev} onClick={() => setPrev(true)}>Минулий</button>
          </div>
          <div className="list">
            {stats.map(st => (
              <div className="item rate" key={st.need.id}>
                <span className="t"><b>{st.need.name}</b><small>зроблено {st.done} з {st.need.weekly}</small></span>
                <div className="rbtns" role="radiogroup" aria-label={`Оцінка: ${st.need.name}`}>
                  {[1, 2, 3, 4, 5].map(n => <button key={n} role="radio" aria-checked={ratings[st.need.id] === n} title={RATING_WORDS[n]} className={`rb r${n}`} onClick={() => A.rateNeed(wk, st.need.id, n)}>{n}</button>)}
                </div>
              </div>
            ))}
          </div>
          <p className="help" style={{ marginTop: 10 }}>1: дуже бракує · 3: так собі · 5: вдосталь</p>
        </div>

        <div className="card s5">
          <div className="ch"><Icon n="flag" className="ic" /><div><h3>Що змінити</h3><p>Одна-дві речі, не десять</p></div></div>
          {rated === 0 && <p className="muted" style={{ margin: 0 }}>Постав хоч кілька оцінок, і я запропоную зміни на наступний тиждень.</p>}
          {rated > 0 && !sg.length && <p style={{ margin: 0 }}>Нічого міняти. Оцінки й зроблене сходяться. Так і лишаємо.</p>}
          <div className="list">
            {sg.map(x => (
              <div className="item sugg" key={x.id}>
                <span className="t">{x.text}</span>
                {accepted.has(x.id) ? <span className="muted" style={{ fontSize: 12 }}>Прийнято</span> : <button className="btn acc sm" onClick={() => A.applySuggestion(wk, x)}>Прийняти</button>}
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn" disabled={rated === 0} onClick={() => A.finishReview(wk)}><Icon n="check" className="icn sm" />{r?.done ? 'Огляд збережено' : 'Готово'}</button>
            <button className="btn ghost" onClick={() => go('plan')}>План наступного тижня</button>
          </div>
        </div>
      </div>
    </section>
  );
}
