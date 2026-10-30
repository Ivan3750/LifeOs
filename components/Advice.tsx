'use client';

import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { adviceList, describe, findings, dayRows } from '@/lib/correlations';
import { TK } from '@/lib/util';
import { Icon } from './Icon';

/** The tips of the day: what the logged numbers and the person's own history say, from every area, and one thing to do about each. */
export function AdviceCard() {
  const { S, A } = useStore();
  const list = useMemo(() => adviceList(S), [S]);
  if (!list.length) return null;
  return (
    <div className="s12 advicegrid">
      {list.map(a => {
        const has = a.task ? S.tasks.some(t => !t.d && t.t === a.task) : false;
        return (
          <div className={`card advice ${a.tone}`} key={a.title}>
            <span className="adv-i"><Icon n={a.tone === 'good' ? 'check' : a.area === 'Здоровʼя' ? 'moon' : a.area === 'Фінанси' ? 'money' : a.area === 'Карʼєра' ? 'company' : a.area === 'Друзі' ? 'team' : 'wave'} /></span>
            <div className="adv-b">
              <div className="adv-area">{a.area}</div>
              <h3>{a.title}</h3>
              <p>{a.reason}</p>
              {a.facts.length > 0 && <div className="adv-facts">{a.facts.map(f => <span key={f}>{f}</span>)}</div>}
              <p className="adv-do"><b>Що зробити:</b> {a.action}</p>
            </div>
            {a.task && <button className="btn ghost sm" disabled={has} onClick={() => A.addTask(a.task!, 'hi', undefined, TK())}>{has ? 'Уже в задачах' : 'Додати в задачі'}</button>}
          </div>
        );
      })}
    </div>
  );
}

/** Everything the algorithm has found so far, with the numbers, or what is still missing for it to find something. */
export function LinksCard() {
  const { S } = useStore();
  const fs = useMemo(() => findings(S), [S]);
  const rows = useMemo(() => dayRows(S, 90), [S]);
  const sleepDays = rows.filter(r => r.sleep !== null).length, moodDays = rows.filter(r => r.mood !== null).length;
  return (
    <div className="card s12">
      <div className="ch"><Icon n="wave" className="ic" /><div><h3>Що на що впливає</h3><p>Зіставляю тіло, роботу, гроші, звички, події й настрій за твоїми днями. Це збіги з твоїх записів, а не діагноз</p></div></div>
      {fs.length > 0 ? (
        <div className="links">
          {fs.map(f => {
            const d = describe(f, S), max = Math.max(f.bad.avg, f.good.avg, 0.1);
            return (
              <div className="link" key={f.id}>
                <div className="lk-areas"><span>{d.area}</span><i>→</i><span>{d.outArea}</span><em className={`lk-s s${f.strength}`}>{f.preliminary ? 'попередньо' : ['', 'слабкий зв’язок', 'помітний зв’язок', 'сильний зв’язок'][f.strength]}</em></div>
                <div className="lk-h"><b>{d.title}</b></div>
                <div className="lk-bars">
                  <div><span>Гірше</span><i style={{ width: (f.bad.avg / max) * 100 + '%' }} className="lo" /><b className="num">{Math.round(f.bad.avg * 10) / 10}</b></div>
                  <div><span>Краще</span><i style={{ width: (f.good.avg / max) * 100 + '%' }} className="hi" /><b className="num">{Math.round(f.good.avg * 10) / 10}</b></div>
                </div>
                <p>{d.text}</p>
                <p className="lk-a">{d.advice}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="help" style={{ margin: 0 }}>Поки замало даних. Записано: сон у {sleepDays} {sleepDays === 1 ? 'день' : 'днях'}, настрій у {moodDays}. Перші підказки зʼявляться вже за 4 дні записів (спершу попередні): запиши сон, настрій і, якщо хочеш, воду, рух, фокус чи витрати. Чим більше днів, тим надійніші висновки.</p>
      )}
    </div>
  );
}
