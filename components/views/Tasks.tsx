'use client';

import { useMemo, useState, type FormEvent } from 'react';
import type { Task } from '@/lib/types';
import { useStore } from '@/lib/store';
import { byUrgency, dueLabel, dueState, focusByTask, parseTask, type DueState } from '@/lib/tasks';
import { hmPlain, plural, sod, TK } from '@/lib/util';
import { Icon } from '../Icon';
import { Empty, IconBtn } from '../shared';

type Filter = 'open' | 'today' | 'done' | 'all';

const GROUPS: [DueState, string][] = [
  ['overdue', 'Прострочені'], ['today', 'Сьогодні'], ['tomorrow', 'Завтра'], ['week', 'Цього тижня'], ['later', 'Пізніше'], ['none', 'Без терміну'],
];

function TaskRow({ t, minutes }: { t: Task; minutes: number }) {
  const { S, A, update, go, setSheet } = useStore();
  const goal = t.goal ? S.goals.find(g => g.id === t.goal) : undefined;
  const st = dueState(t.due), late = !t.d && st === 'overdue';
  const edit = () => setSheet({ kind: 'form', key: 'editTask', init: { id: String(t.id), text: t.t, pri: t.p, goal: t.goal ? String(t.goal) : '', due: t.due || '' } });
  return (
    <div className={`item task${t.d ? ' done' : ''}`}>
      <button className="chk" role="checkbox" aria-checked={t.d} aria-label={t.d ? `Повернути в роботу: ${t.t}` : `Виконано: ${t.t}`} onClick={() => A.toggleTask(t.id)}>{t.d && <Icon n="check" />}</button>
      <div className="tmain">
        <button className="t" onClick={edit} title="Змінити задачу">{t.t}{t.p === 'hi' && !t.d && <span className="tstar" title="Важлива"><Icon n="star" /></span>}</button>
        {(t.due || goal || minutes > 0) && (
          <div className="tmeta">
            {t.due && <span className={`tm due ${t.d ? '' : st}`}><Icon n="schedule" />{dueLabel(t.due)}</span>}
            {goal && <button className="tm goal" title="Ця задача веде до цілі" onClick={() => go('goals')}><Icon n="goals" />{goal.title}</button>}
            {minutes > 0 && <span className="tm"><Icon n="focus" />{hmPlain(minutes)}</span>}
            {late && <button className="tm act" onClick={() => A.setTaskDue(t.id, TK())}>перенести на сьогодні</button>}
          </div>
        )}
      </div>
      <div className="tact">
        {!t.d && <IconBtn icon="star" label={t.p === 'hi' ? 'Прибрати важливість' : 'Позначити важливою'} pressed={t.p === 'hi'} onClick={() => A.togglePriority(t.id)} />}
        {!t.d && <IconBtn icon="focus" label="Почати фокус на цій задачі" onClick={() => { update(s => { s.timer.task = t.t; }); go('focus'); }} />}
        <IconBtn icon="edit" label="Змінити" onClick={edit} />
        <span className="del"><IconBtn icon="trash" label="Видалити" tone="danger" onClick={() => A.delTask(t.id)} /></span>
      </div>
    </div>
  );
}

export function Tasks() {
  const { S, A } = useStore();
  const [f, setF] = useState<Filter>('open');
  const [text, setText] = useState('');
  const [hi, setHi] = useState(false);
  const [due, setDue] = useState('');
  const [goal, setGoal] = useState('');

  const today = TK(), t0 = sod(new Date()).getTime();
  const spent = useMemo(() => focusByTask(S), [S]);
  const open = S.tasks.filter(t => !t.d), done = S.tasks.filter(t => t.d);
  const overdue = open.filter(t => dueState(t.due) === 'overdue').length;
  const dueToday = open.filter(t => dueState(t.due) === 'today').length;
  const doneToday = done.filter(t => (t.doneAt || 0) >= t0).length;
  const planned = overdue + dueToday + doneToday;
  const todayList = open.filter(t => t.due && t.due <= today);

  const counts: Record<Filter, number> = { open: open.length, today: todayList.length, done: done.length, all: S.tasks.length };
  const base = f === 'open' ? open : f === 'today' ? todayList : f === 'done' ? done : S.tasks;
  const openPart = base.filter(t => !t.d).sort(byUrgency);
  const donePart = base.filter(t => t.d).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const hasDates = openPart.some(t => t.due);

  const preview = useMemo(() => (text.trim() ? parseTask(text) : null), [text]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = parseTask(text);
    if (!q.t) return;
    A.addTask(q.t, hi || goal ? 'hi' : q.p, +goal || undefined, due || q.due);
    setText(''); setDue(''); setHi(false);
  };

  const rows = (list: Task[]) => list.map(t => <TaskRow key={t.id} t={t} minutes={spent.get(t.t) || 0} />);

  return (
    <section className="view">
      <div className="vh">
        <div>
          <h2>Задачі</h2>
          <p>{open.length ? `${open.length} ${plural(open.length, 'відкрита', 'відкриті', 'відкритих')}` : 'Усе зроблено'}{overdue > 0 && <span className="late-note"> · {overdue} {plural(overdue, 'прострочена', 'прострочені', 'прострочених')}</span>}</p>
        </div>
        {planned > 0 && (
          <div className="tprog" role="img" aria-label={`Сьогодні виконано ${doneToday} з ${planned}`}>
            <span><b className="num">{doneToday}</b> з {planned} на сьогодні</span>
            <div className="bar"><i style={{ width: `${Math.round((doneToday / planned) * 100)}%` }} /></div>
          </div>
        )}
      </div>

      <div className="card taskadd">
        <form onSubmit={submit}>
          <div className="addrow">
            <input id="taskIn" aria-label="Нова задача" value={text} onChange={e => setText(e.target.value)} placeholder="Нова задача… напр. «Подзвонити клієнту завтра !»" autoComplete="off" />
            <button type="button" className={`ib big${hi ? ' on' : ''}`} aria-pressed={hi} title="Важлива задача" aria-label="Важлива задача" onClick={() => setHi(v => !v)}><Icon n="star" /></button>
            <button className="btn acc" disabled={!text.trim()}>Додати</button>
          </div>
          <div className="addopts">
            <label className="field" htmlFor="taskDue">Термін<input id="taskDue" type="date" value={due} min={today} onChange={e => setDue(e.target.value)} /></label>
            {S.goals.length > 0 && (
              <label className="field" htmlFor="taskGoal">Для цілі
                <select id="taskGoal" value={goal} onChange={e => setGoal(e.target.value)}><option value="">Без цілі</option>{S.goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select>
              </label>
            )}
            <p className="help">
              {preview && (preview.due || preview.p === 'hi')
                ? <>Зрозуміло: <b>{preview.t}</b>{preview.p === 'hi' && ' · важлива'}{preview.due && ` · до ${dueLabel(preview.due)}`}</>
                : <>Підказка: «!» робить задачу важливою, а «завтра» чи «25.11» в кінці ставить термін.</>}
            </p>
          </div>
        </form>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="row tbar">
          <div className="tabs" role="group" aria-label="Які задачі показати">
            {([['open', 'Відкриті'], ['today', 'На сьогодні'], ['done', 'Виконані'], ['all', 'Усі']] as const).map(([k, l]) => (
              <button key={k} aria-pressed={f === k} onClick={() => setF(k)}>{l}{counts[k] > 0 && <span className="cnt">{counts[k]}</span>}</button>
            ))}
          </div>
          {done.length > 0 && (f === 'done' || f === 'all') && <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={() => A.clearDoneTasks()}>Очистити виконані</button>}
        </div>

        {f === 'done'
          ? <div className="list">{rows(donePart)}</div>
          : (
            <>
              {hasDates
                ? GROUPS.map(([k, label]) => {
                    const g = openPart.filter(t => dueState(t.due) === k);
                    return g.length ? <div key={k} className="tgroup"><h4 className={k === 'overdue' ? 'late' : undefined}>{label}<span className="cnt">{g.length}</span></h4><div className="list">{rows(g)}</div></div> : null;
                  })
                : openPart.length > 0 && <div className="list">{rows(openPart)}</div>}
              {f === 'all' && donePart.length > 0 && <div className="tgroup"><h4>Виконані<span className="cnt">{donePart.length}</span></h4><div className="list">{rows(donePart)}</div></div>}
            </>
          )}

        {!(f === 'done' ? donePart : f === 'all' ? [...openPart, ...donePart] : openPart).length && (
          f === 'done'
            ? <Empty icon="check" title="Виконаних задач ще нема" text="Відміч задачу галочкою, і вона зʼявиться тут." />
            : f === 'today'
              ? <Empty icon="check" title="На сьогодні чисто" text="Задачі з терміном «сьогодні» або простроченим зʼявляться тут." />
              : S.tasks.length
                ? <Empty icon="check" title="Усе зроблено" text="Відкритих задач нема. Додай нову вище або відпочинь." />
                : <Empty icon="tasks" title="Задач ще нема" text="Напиши першу в полі вище. Додай «!», щоб позначити її важливою." />
        )}
      </div>
    </section>
  );
}
