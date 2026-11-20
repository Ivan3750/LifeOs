'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { weekKey } from '@/lib/needs';
import { reviewIdeas } from '@/lib/life';
import { addD, fmtDate, ymd } from '@/lib/util';
import { useWeek } from '../needs';
import { Icon } from '../Icon';

const QUESTIONS: [keyof Answers, string, string][] = [
  ['good', 'Що хорошого відбулося цього тижня?', 'Навіть дрібниця'],
  ['missing', 'Чого мені не вистачало?', 'Людей, відпочинку, тиші, руху…'],
  ['change', 'Що я хочу змінити наступного тижня?', 'Одна маленька зміна'],
];
type Answers = { good: string; missing: string; change: string };

/** The review of the week: three short questions, about five minutes. It is optional, and at most two changes come out of it. */
export function Review() {
  const { S, A, go } = useStore();
  const [prev, setPrev] = useState(false);
  const { wsT } = useWeek(prev ? -1 : 0), ws = new Date(wsT), wk = weekKey(ws), end = addD(ws, 6);
  const r = S.reviews[wk];
  const [a, setA] = useState<Answers>({ good: r?.good || '', missing: r?.missing || '', change: r?.change || '' });
  const ideas = reviewIdeas(S, a), taken = new Set(r?.accepted || []);
  // another week brings its own answers
  const [shown, setShown] = useState(wk);
  if (shown !== wk) { setShown(wk); setA({ good: S.reviews[wk]?.good || '', missing: S.reviews[wk]?.missing || '', change: S.reviews[wk]?.change || '' }); }
  const any = Object.values(a).some(x => x.trim());
  return (
    <section className="view">
      <div className="grid">
        <div className="card s7">
          <div className="ch">
            <Icon n="check" className="ic" />
            <div><h3>Огляд тижня · 5 хвилин</h3><p>{fmtDate(wk)} – {fmtDate(ymd(end))}. Необовʼязково, можна пропустити</p></div>
          </div>
          <div className="subtabs" role="tablist" style={{ marginBottom: 14 }}>
            <button role="tab" aria-selected={!prev} onClick={() => setPrev(false)}>Цей тиждень</button>
            <button role="tab" aria-selected={prev} onClick={() => setPrev(true)}>Минулий</button>
          </div>
          <form onSubmit={e => { e.preventDefault(); A.saveReviewAnswers(wk, a); A.finishWeekReview(wk); }}>
            {QUESTIONS.map(([k, q, ph]) => (
              <div className="rv-q" key={k}>
                <label htmlFor={'rv' + k}>{q}</label>
                <textarea id={'rv' + k} value={a[k]} placeholder={ph} onChange={e => setA({ ...a, [k]: e.target.value })} onBlur={() => A.saveReviewAnswers(wk, a)} />
              </div>
            ))}
            <div className="row">
              <button className="btn acc" disabled={!any}><Icon n="check" className="icn sm" />{r?.done && any ? 'Збережено' : 'Готово'}</button>
              <button type="button" className="btn ghost" onClick={() => go('home')}>Пізніше</button>
            </div>
          </form>
        </div>

        <div className="card s5">
          <div className="ch"><Icon n="flag" className="ic" /><div><h3>Що можна змінити</h3><p>Не більше двох ідей, і лише з твоїх слів</p></div></div>
          {!any && <p className="muted" style={{ margin: 0 }}>Напиши хоч кілька слів, і я підкажу, чи є що змінити на наступний тиждень. Якщо ні, нічого міняти не треба.</p>}
          {any && !ideas.length && <p style={{ margin: 0 }}>Нічого міняти не треба. Так і лишаємо.</p>}
          <div className="list">
            {ideas.map(x => (
              <div className="item sugg" key={x.id}>
                <span className="t">{x.text}</span>
                {taken.has(x.id) ? <span className="muted" style={{ fontSize: 12 }}>Враховано</span>
                  : x.need ? <button className="btn acc sm" onClick={() => A.takeReviewIdea(wk, x)}>Врахувати</button>
                  : x.to ? <button className="btn ghost sm" onClick={() => go(x.to!)}>Відкрити</button> : null}
              </div>
            ))}
          </div>
          <button className="btn ghost" style={{ marginTop: 14 }} onClick={() => go('plan')}>План наступного тижня</button>
        </div>
      </div>
    </section>
  );
}
