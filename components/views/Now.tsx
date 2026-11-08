'use client';

import { useState } from 'react';
import { useNow, useStore } from '@/lib/store';
import { scoreColor, scoreWord } from '@/lib/score';
import { dueLabel, dueState } from '@/lib/tasks';
import { greeting, nextCandidate, nowState, phaseOf, PLAN_SIZE, RESETS, todayPlan } from '@/lib/now';
import { fmt, MON, plural, TK, WD } from '@/lib/util';
import { Icon } from '../Icon';
import { AdviceCard } from '../Advice';
import { YesterdayCard } from '../Brief';
import { LifeTiles } from '../shared';
import { HabitsToday, HomeExtras, QuitMini, SchedCard } from './DayParts';

/** The one thing to do now: what is running, what is going on in the calendar, or the next task with a button to start it. */
function NowCard() {
  const { S, A, eventsOn, startFocus, toggleTimer, resetTimer, completeTimer, go } = useStore();
  const now = useNow(S.timer.running ? 1000 : 20_000);
  const d = new Date(now), phase = phaseOf(d);
  const { cur, next } = nowState(S, eventsOn(TK()), now);
  const [text, setText] = useState('');
  const nextTxt = next && cur.kind !== 'event' ? `Далі: ${next.ev.title} о ${next.ev.s} (через ${next.inMin >= 60 ? `${Math.floor(next.inMin / 60)} год ${next.inMin % 60} хв` : `${next.inMin} хв`})` : '';
  const sky = cur.kind === 'focus' ? 'run' : cur.kind === 'break' ? 'rest' : cur.kind === 'event' ? 'ev' : phase;

  return (
    <div className={`card nowcard s12 sky-${sky}`}>
      <div className="now-top">
        <span className="now-eyebrow">{greeting(S.name, d)}{S.demo && <span className="demo">Демо-дані</span>}</span>
        <span className="now-date num">{WD[d.getDay()]}, {d.getDate()} {MON[d.getMonth()]}</span>
      </div>

      {cur.kind === 'focus' && (
        <>
          <h1 className="now-h">Фокус</h1>
          <p className="now-sub">{cur.task || 'Без назви. Просто працюй'}</p>
          <div className="now-clock num" role="timer" aria-label="Залишилось часу">{fmt(cur.left)}</div>
          <div className="now-btns">
            <button className="btn big" onClick={toggleTimer}><Icon n="pause" />Пауза</button>
            <button className="btn ghost-on" onClick={resetTimer}>Зупинити й зарахувати</button>
          </div>
        </>
      )}

      {cur.kind === 'break' && (
        <>
          <h1 className="now-h">Перерва</h1>
          <p className="now-sub">Відійди від екрана, випий води, розімнись.</p>
          <div className="now-clock num" role="timer" aria-label="Залишилось часу">{fmt(cur.left)}</div>
          <div className="now-btns">
            <button className="btn big" onClick={() => completeTimer(true)}><Icon n="arrow" />Повернутись до роботи</button>
          </div>
        </>
      )}

      {cur.kind === 'event' && (
        <>
          <h1 className="now-h">Зараз: {cur.ev.title}</h1>
          <p className="now-sub num">{cur.ev.s}–{cur.ev.e} · ще {cur.endsIn >= 60 ? `${Math.floor(cur.endsIn / 60)} год ${cur.endsIn % 60} хв` : `${cur.endsIn} хв`}{cur.ev.location ? ` · ${cur.ev.location}` : ''}</p>
          {nextTxt && <p className="now-next">{nextTxt}</p>}
        </>
      )}

      {cur.kind === 'task' && cur.task && (
        <>
          <h1 className="now-h">{cur.task.t}</h1>
          <p className="now-sub">
            {cur.task.due && <span className={dueState(cur.task.due) === 'overdue' ? 'late' : ''}>{dueLabel(cur.task.due)} · </span>}
            {cur.window !== null ? `До «${next!.ev.title}» ${cur.window >= 60 ? `${Math.floor(cur.window / 60)} год ${cur.window % 60} хв` : `${cur.window} хв`}` : 'Тебе ніхто не відволікає'}
          </p>
          <div className="now-btns">
            <button className="btn big" onClick={() => startFocus(cur.task!.t, cur.minutes)}><Icon n="play" />Почати · {cur.minutes} хв</button>
            <button className="btn ghost-on" onClick={() => A.toggleTask(cur.task!.id)}><Icon n="check" />Вже зроблено</button>
          </div>
          {nextTxt && <p className="now-next">{nextTxt}</p>}
        </>
      )}

      {cur.kind === 'task' && !cur.task && (
        <>
          <h1 className="now-h">{S.tasks.length ? 'Усе зроблено' : 'Що найважливіше сьогодні?'}</h1>
          <p className="now-sub">{S.tasks.length ? 'Відпочинь або додай наступну справу.' : 'Напиши одну справу, і я скажу, коли її робити.'}</p>
          <form className="now-add" onSubmit={e => { e.preventDefault(); if (A.addTaskLine(text)) setText(''); }}>
            <input aria-label="Нова задача" value={text} onChange={e => setText(e.target.value)} placeholder="Напр. Подзвонити завтра !" autoComplete="off" />
            <button className="btn big" aria-label="Додати задачу"><Icon n="plus" />Додати</button>
          </form>
          {nextTxt && <p className="now-next">{nextTxt}</p>}
        </>
      )}

      {phase === 'night' && cur.kind === 'task' && <p className="now-next">Пізно. Найкраще, що можна зробити, це лягти спати.</p>}
      <button className="now-link" onClick={() => go('focus')}>Усі налаштування фокусу <Icon n="right" className="icn" /></button>
    </div>
  );
}

/** Up to three main things for the day. Suggested from the open tasks until accepted; each one can be swapped for the next in line. */
function PlanCard() {
  const { S, A, go, startFocus } = useStore();
  const now = useNow(60_000), d = new Date(now);
  const plan = todayPlan(S, d);
  const ids = plan.tasks.map(t => t.id);
  const done = plan.tasks.filter(t => t.d).length;
  const spare = S.tasks.filter(t => !t.d && !ids.includes(t.id)).length;
  const next = nextCandidate(S, d, ids);
  const open = plan.tasks.filter(t => !t.d);

  return (
    <div className="card s7 plancard">
      <div className="ch">
        <Icon n="flag" className="ic" />
        <div>
          <h3>{plan.confirmed ? 'Головне на сьогодні' : 'Пропоную на сьогодні'}</h3>
          <p>{plan.tasks.length ? (plan.confirmed ? `${done} з ${plan.tasks.length} зроблено` : 'Найтерміновіше з твоїх задач. Прийми або заміни') : 'Додай задачі, і я складу план дня'}</p>
        </div>
        {!plan.confirmed && plan.tasks.length > 0 && <button className="btn acc sm" onClick={() => A.setPlan(ids)}><Icon n="check" />Прийняти</button>}
      </div>
      <div className="list">
        {plan.tasks.map(t => (
          <div className={`item${t.d ? ' done' : ''}`} key={t.id}>
            <button className={`chk${t.d ? ' on' : ''}`} role="checkbox" aria-checked={t.d} aria-label={`${t.d ? 'Повернути' : 'Виконано'}: ${t.t}`} onClick={() => A.toggleTask(t.id)}>{t.d && <Icon n="check" />}</button>
            <span className="t">{t.t}</span>
            {t.due && !t.d && <span className={`muted num${dueState(t.due) === 'overdue' ? ' late' : ''}`} style={{ fontSize: 12 }}>{dueLabel(t.due)}</span>}
            {!t.d && <button className="ib" title="Фокус на цій задачі" aria-label={`Фокус: ${t.t}`} onClick={() => startFocus(t.t)}><Icon n="play" /></button>}
            {!t.d && plan.confirmed && <button className="ib" title={next ? 'Замінити іншою' : 'Прибрати з плану'} aria-label={`Замінити: ${t.t}`} onClick={() => A.swapPlan(t.id, next?.id)}><Icon n="refresh" /></button>}
          </div>
        ))}
        {!plan.tasks.length && <p className="muted" style={{ margin: 0 }}>Задач поки немає. Натисни «+» внизу й напиши першу.</p>}
        {plan.confirmed && plan.tasks.length > 0 && !open.length && <p className="muted" style={{ margin: '8px 0 0' }}>План виконано. Це вже вдалий день.</p>}
      </div>
      <div className="plan-foot">
        {plan.confirmed && ids.length < PLAN_SIZE && next && <button className="chip" onClick={() => A.setPlan([...ids, next.id])}>+ {next.t.length > 28 ? next.t.slice(0, 27) + '…' : next.t}</button>}
        <button className="chip" onClick={() => go('tasks')}>{spare ? `Ще ${spare} ${plural(spare, 'задача', 'задачі', 'задач')}` : 'Усі задачі'}</button>
      </div>
    </div>
  );
}

/** «Something is off»: one tap starts the right small thing, so there is nothing to decide at the worst moment. */
function ResetCard() {
  const { S, A, startFocus, startBreak, setSheet, toast, eventsOn } = useStore();
  const now = useNow(60_000);
  const [done, setDone] = useState('');
  const run = (key: string) => {
    const t = nowState(S, eventsOn(TK()), now).cur;
    const task = t.kind === 'task' && t.task ? t.task.t : (S.timer.task || 'Найменший крок');
    setDone(key);
    if (key === 'start') { startFocus(task, 5); toast('Лише 5 хвилин. Почни з найменшого кроку'); }
    else if (key === 'drift') { startFocus(task, 15); toast('15 хвилин. Телефон екраном вниз, в інший кінець столу'); }
    else if (key === 'tired') { A.addH('water', 1); startBreak(5); toast('Склянка води зарахована. 5 хвилин: пройдись, розімни спину'); }
    else setSheet({ kind: 'sos' });
  };
  return (
    <div className="card s5 resetcard">
      <div className="ch"><Icon n="alert" className="ic" /><div><h3>Щось не так?</h3><p>Обери, і одразу запущу, що допоможе</p></div></div>
      <div className="resets">
        {RESETS.map(r => (
          <button key={r.key} className={done === r.key ? 'on' : ''} onClick={() => run(r.key)}>
            <span className="ri"><Icon n={r.icon} /></span>
            <b>{r.label}</b>
            <small>{r.hint}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

/** The end of the day: the score, one line about what went well and the way into tomorrow's plan. */
function ReviewCard() {
  const { S, A, scoreOn, go } = useStore();
  const now = useNow(60_000), k = TK();
  const sc = scoreOn(k, now);
  const win = S.wins[k] || '';
  const [text, setText] = useState(win);
  return (
    <div className="card s12 reviewcard">
      <div className="ch"><Icon n="moon" className="ic" /><div><h3>Підсумок дня</h3><p>30 секунд. Решту я порахував сам</p></div></div>
      <div className="review">
        <div className="rv-score" style={{ ['--sc' as string]: scoreColor(sc.total) }}>
          <b className="num">{sc.total ?? '—'}</b><small>{sc.total === null ? '' : '/100'}</small>
          <span>{scoreWord(sc.total)}</span>
        </div>
        <div className="rv-form">
          <label className="field" htmlFor="winText">Що вдалось сьогодні?
            <textarea id="winText" rows={2} value={text} placeholder="Одне речення. Навіть дрібниця" onChange={e => setText(e.target.value)} onBlur={() => A.setWin(text, k)} />
          </label>
          <div className="row">
            <button className="btn" onClick={() => { A.setWin(text, k); go('tasks'); }}><Icon n="flag" />Спланувати завтра</button>
            <button className="btn ghost" onClick={() => go('health')}>Записати сон і настрій</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The home page: one screen that tells what to do now. Everything else is a tap away. */
export function Home() {
  const { go } = useStore();
  const now = useNow(60_000), phase = phaseOf(new Date(now));
  const [more, setMore] = useState(false);
  const evening = phase === 'evening' || phase === 'night';
  return (
    <section className="view">
      <div className="grid">
        <NowCard />

        {evening && <ReviewCard />}

        <PlanCard />
        <ResetCard />

        <SchedCard />
        <HabitsToday />

        <div className="card s12">
          <div className="ch"><Icon n="life" className="ic" /><div><h3>Тіло й настрій</h3><p>Один тап на кожне. Решту я порахую</p></div><button className="sel" onClick={() => go('health')}>Докладніше</button></div>
          <LifeTiles full={false} />
        </div>

        <QuitMini />

        <AdviceCard />
        <YesterdayCard />

        <button className="moretoggle" aria-expanded={more} onClick={() => setMore(m => !m)}>
          <Icon n="trend" /><span>Оцінка дня, статистика й цілі</span><small>{more ? 'Сховати' : 'Показати'}</small><Icon n="right" className="icn chev" />
        </button>
        {more && <HomeExtras />}
      </div>
    </section>
  );
}
