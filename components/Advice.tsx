'use client';

import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { describe, findings, dayRows, todayAdvice } from '@/lib/correlations';
import { TK } from '@/lib/util';
import { Icon } from './Icon';

/** The tip of the day: what the logged numbers and the person's own history say, and one thing to do about it. */
export function AdviceCard() {
  const { S, A } = useStore();
  const a = useMemo(() => todayAdvice(S), [S]);
  if (!a) return null;
  const has = a.task ? S.tasks.some(t => !t.d && t.t === a.task) : false;
  return (
    <div className={`card s12 advice ${a.tone}`}>
      <span className="adv-i"><Icon n={a.tone === 'good' ? 'check' : 'moon'} /></span>
      <div className="adv-b">
        <h3>{a.title}</h3>
        <p>{a.reason}</p>
        {a.facts.length > 0 && <div className="adv-facts">{a.facts.map(f => <span key={f}>{f}</span>)}</div>}
        <p className="adv-do"><b>Що зробити:</b> {a.action}</p>
      </div>
      {a.task && <button className="btn ghost sm" disabled={has} onClick={() => A.addTask(a.task!, 'hi', undefined, TK())}>{has ? 'Уже в задачах' : 'Додати в задачі'}</button>}
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
      <div className="ch"><Icon n="wave" className="ic" /><div><h3>Що на що впливає</h3><p>Зіставляю сон, воду, рух і настрій за твоїми днями. Це збіги з твоїх записів, а не діагноз</p></div></div>
      {fs.length > 0 ? (
        <div className="links">
          {fs.map(f => {
            const d = describe(f), max = Math.max(f.low.avg, f.high.avg, 0.1);
            return (
              <div className="link" key={f.id}>
                <div className="lk-h"><b>{d.title}</b><span className={`lk-s s${f.strength}`}>{['', 'слабкий зв’язок', 'помітний зв’язок', 'сильний зв’язок'][f.strength]}</span></div>
                <div className="lk-bars">
                  <div><span>Мало</span><i style={{ width: (f.low.avg / max) * 100 + '%' }} className="lo" /><b className="num">{Math.round(f.low.avg * 10) / 10}</b></div>
                  <div><span>Норма</span><i style={{ width: (f.high.avg / max) * 100 + '%' }} className="hi" /><b className="num">{Math.round(f.high.avg * 10) / 10}</b></div>
                </div>
                <p>{d.text}</p>
                <p className="lk-a">{d.advice}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="help" style={{ margin: 0 }}>Поки замало даних. Записано: сон у {sleepDays} {sleepDays === 1 ? 'день' : 'днях'}, настрій у {moodDays}. Для висновків треба хоча б по три дні з коротким сном і з нормальним, разом із записаним настроєм. Продовжуй відмічати, і підказки зʼявляться самі.</p>
      )}
    </div>
  );
}
