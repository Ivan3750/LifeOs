'use client';

import { useState, type FormEvent } from 'react';
import { useStore } from '@/lib/store';
import { Icon } from '../Icon';

export function Tasks() {
  const { S, A, update, go, setSheet } = useStore();
  const [f, setF] = useState<'open' | 'done' | 'all'>('open');
  const [text, setText] = useState('');
  const [pri, setPri] = useState<'hi' | 'lo'>('lo');
  const [goal, setGoal] = useState('');
  const open = S.tasks.filter(t => !t.d).length;
  const goalName = (id?: number) => S.goals.find(g => g.id === id)?.title;
  const list = S.tasks.filter(t => f === 'all' || (f === 'done' ? t.d : !t.d)).sort((a, b) => (a.p === 'hi' ? 0 : 1) - (b.p === 'hi' ? 0 : 1));
  const submit = (e: FormEvent) => { e.preventDefault(); A.addTask(text, pri, +goal || undefined); setText(''); };
  return (
    <section className="view">
      <div className="vh"><div><h2>Задачі</h2><p>{open} відкритих із {S.tasks.length}</p></div></div>
      <div className="card" style={{ marginTop: 18 }}>
        <form className="row" onSubmit={submit}>
          <label className="field" htmlFor="taskIn" style={{ flex: '1 1 240px' }}>Нова задача<input id="taskIn" value={text} onChange={e => setText(e.target.value)} placeholder="Напр. Підготувати презентацію" autoComplete="off" /></label>
          <label className="field" htmlFor="taskPri">Пріоритет<select id="taskPri" value={pri} onChange={e => setPri(e.target.value as 'hi' | 'lo')}><option value="hi">Важливо</option><option value="lo">Звичайно</option></select></label>
          {S.goals.length > 0 && <label className="field" htmlFor="taskGoal" style={{ flex: '1 1 180px' }}>Для цілі<select id="taskGoal" value={goal} onChange={e => { setGoal(e.target.value); if (e.target.value) setPri('hi'); }}><option value="">Без цілі</option>{S.goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>}
          <button className="btn" style={{ alignSelf: 'flex-end' }}>Додати</button>
        </form>
        <div className="row" style={{ margin: '18px 0 6px' }}>
          <div className="seg">{([['open', 'Відкриті'], ['done', 'Виконані'], ['all', 'Усі']] as const).map(([k, l]) => <button key={k} aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>)}</div>
        </div>
        <div className="list">
          {list.map(t => (
            <div key={t.id} className={`item ${t.d ? 'done' : ''}`}>
              <button className="chk" aria-label="Позначити" onClick={() => { A.toggleTask(t.id); }}>{t.d && <Icon n="check" />}</button>
              <span className="t">{t.t}</span>
              {t.goal && goalName(t.goal) && <button className="tag goaltag" title="Ця задача веде до цілі" onClick={() => go('goals')}>→ {goalName(t.goal)}</button>}
              {t.p === 'hi' && <span className="tag">Важливо</span>}
              <button className="x" title="Фокус на задачі" aria-label="Фокус на задачі" onClick={() => { update(s => { s.timer.task = t.t; }); go('focus'); }}><Icon n="focus" /></button>
              <button className="sqb" aria-label={`Змінити: ${t.t}`} onClick={() => setSheet({ kind: 'form', key: 'editTask', init: { id: String(t.id), text: t.t, pri: t.p, goal: t.goal ? String(t.goal) : '' } })}>Змінити</button>
              <button className="x" aria-label="Видалити" onClick={() => A.delTask(t.id)}><Icon n="x" /></button>
            </div>
          ))}
          {!list.length && <p className="muted">Тут порожньо. Додай першу задачу вище.</p>}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Habits ---------------- */
