'use client';

import { useState, type FormEvent } from 'react';
import type { Goal } from '@/lib/types';
import { goalStep, useStore } from '@/lib/store';
import { goalProgress } from '@/lib/goals';
import { AREAS, daysTo, fmtN, sum } from '@/lib/util';
import { Icon } from '../Icon';
import { Radar } from '../charts';
import { DelBtn } from '../shared';

/** One goal: progress, its steps or number, the tasks that move it, and editing. */
function GoalItem({ g }: { g: Goal }) {
  const { S, A, update, go } = useStore();
  const [edit, setEdit] = useState(false);
  const [e, setE] = useState({ title: g.title, target: String(g.target || ''), unit: g.unit, due: g.due, area: g.area });
  const [step, setStep] = useState('');
  const [task, setTask] = useState('');
  const steps = g.steps || [], bySteps = steps.length > 0 || !g.target;
  const prog = goalProgress(g), done = prog >= 1 && (steps.length > 0 || g.target > 0), left = g.due ? daysTo(g.due) : null;
  const tasks = S.tasks.filter(t => t.goal === g.id && !t.d);
  const save = () => { A.updateGoal(g.id, { title: e.title.trim() || g.title, target: Math.max(0, +e.target || 0), unit: e.unit.trim(), due: e.due, area: e.area }); setEdit(false); };
  return (
    <div className="goal">
      <div className="row" style={{ flexWrap: 'nowrap' }}><b className="t" style={{ flex: 1, minWidth: 0 }}>{g.title}</b><span className={`tag ${done ? 'ok' : ''}`}>{done ? 'Досягнуто' : g.area}</span></div>
      <div className="bar"><i style={{ width: prog * 100 + '%', background: done ? 'var(--good)' : 'var(--accent)' }} /></div>
      <div className="row">
        <span className="num">{bySteps ? `${steps.filter(s => s.d).length} з ${steps.length} кроків` : `${fmtN(g.cur)} / ${fmtN(g.target)} ${g.unit}`}</span>
        <span className="muted" style={{ fontSize: 12 }}>{left === null ? 'без дедлайну' : left < 0 ? 'термін минув' : left === 0 ? 'дедлайн сьогодні' : 'ще ' + left + ' дн'}</span>
        <span className="row" style={{ marginLeft: 'auto', gap: 6 }}>
          {!bySteps && <><button className="sqb" aria-label="Зменшити прогрес" onClick={() => A.stepGoal(g.id, -1)}>−</button><button className="sqb" onClick={() => A.stepGoal(g.id, 1)}>+{fmtN(goalStep(g.target))}</button></>}
          <button className="sqb" onClick={() => setEdit(!edit)}>{edit ? 'Закрити' : 'Змінити'}</button>
          <DelBtn label="Видалити ціль" onDelete={() => A.delGoal(g.id)} />
        </span>
      </div>
      {(bySteps || edit) && (
        <div className="gsteps">
          {steps.map(s => (
            <div className={`item ${s.d ? 'done' : ''}`} key={s.id}>
              <button className={`chk ${s.d ? 'on' : ''}`} aria-pressed={s.d} aria-label={`Крок: ${s.t}`} onClick={() => A.toggleStep(g.id, s.id)}>{s.d && <Icon n="check" />}</button>
              <span className="t">{s.t}</span>
              <button className="x" aria-label="Видалити крок" onClick={() => A.delStep(g.id, s.id)}><Icon n="x" /></button>
            </div>
          ))}
          <input className="gin" placeholder="+ крок, напр. «написати їй у неділю»" value={step} onChange={x => setStep(x.target.value)} onKeyDown={x => { if (x.key === 'Enter') { x.preventDefault(); A.addStep(g.id, step); setStep(''); } }} aria-label="Додати крок до цілі" />
        </div>
      )}
      <div className="gtasks">
        <span className="muted" style={{ fontSize: 12 }}>Задачі для цілі{tasks.length ? '' : ': поки немає'}</span>
        {tasks.map(t => (
          <div className="item" key={t.id}>
            <button className="chk" aria-label="Виконано" onClick={() => A.toggleTask(t.id)} />
            <span className="t">{t.t}</span>{t.p === 'hi' && <span className="tag">Важливо</span>}
            <button className="x" title="Фокус на задачі" aria-label="Фокус на задачі" onClick={() => { update(s => { s.timer.task = t.t; }); go('focus'); }}><Icon n="focus" /></button>
          </div>
        ))}
        <input className="gin" placeholder="+ задача, напр. «написати 5 бізнесам»" value={task} onChange={x => setTask(x.target.value)} onKeyDown={x => { if (x.key === 'Enter') { x.preventDefault(); A.addTask(task, 'hi', g.id); setTask(''); } }} aria-label="Додати задачу для цілі" />
      </div>
      {edit && (
        <div className="gedit">
          <label className="field" htmlFor={`gt${g.id}`}>Назва<input id={`gt${g.id}`} value={e.title} onChange={x => setE({ ...e, title: x.target.value })} /></label>
          <div className="row">
            <label className="field" htmlFor={`gn${g.id}`} style={{ flex: '1 1 90px' }}>Скільки (0 = по кроках)<input id={`gn${g.id}`} type="number" min="0" value={e.target} onChange={x => setE({ ...e, target: x.target.value })} /></label>
            <label className="field" htmlFor={`gu${g.id}`} style={{ flex: '1 1 90px' }}>Одиниця<input id={`gu${g.id}`} value={e.unit} onChange={x => setE({ ...e, unit: x.target.value })} /></label>
            <label className="field" htmlFor={`gd${g.id}`} style={{ flex: '1 1 140px' }}>Дедлайн<input id={`gd${g.id}`} type="date" value={e.due} onChange={x => setE({ ...e, due: x.target.value })} /></label>
            <label className="field" htmlFor={`ga${g.id}`} style={{ flex: '1 1 120px' }}>Сфера<select id={`ga${g.id}`} value={e.area} onChange={x => setE({ ...e, area: x.target.value })}>{AREAS.map(a => <option key={a}>{a}</option>)}</select></label>
          </div>
          <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={save}>Зберегти</button>
        </div>
      )}
    </div>
  );
}

export function Goals() {
  const { S, A, update } = useStore();
  const [v, setV] = useState({ title: '', target: '', unit: '', area: AREAS[0], due: '', steps: '' });
  const [how, setHow] = useState<'num' | 'steps'>('steps');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!v.title.trim()) return;
    const steps = how === 'steps' ? v.steps.split('\n').map(s => s.trim()).filter(Boolean) : [];
    const t = how === 'num' ? +v.target : 0; if (how === 'num' && !(t > 0)) return;
    A.addGoal({ title: v.title.trim(), area: v.area, target: t, unit: how === 'num' ? v.unit.trim() : '', due: v.due, steps });
    setV({ ...v, title: '', target: '', unit: '', steps: '' });
  };
  const weakest = AREAS[S.wheel.indexOf(Math.min(...S.wheel))];
  return (
    <section className="view">
      <div className="vh"><div><h2>Цілі та баланс</h2><p>Великі цілі з прогресом і колесо балансу життя.</p></div></div>
      <div className="grid" style={{ marginTop: 18 }}>
        <div className="card s7">
          <form style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={submit}>
            <label className="field" htmlFor="gTitle">Нова ціль<input id="gTitle" required placeholder="Напр. Перший клієнт для WebHjerte" autoComplete="off" value={v.title} onChange={e => setV({ ...v, title: e.target.value })} /></label>
            <div className="field"><span>Як міряти прогрес</span>
              <div className="seg" style={{ alignSelf: 'flex-start' }}>
                <button type="button" aria-pressed={how === 'steps'} onClick={() => setHow('steps')}>Кроками</button>
                <button type="button" aria-pressed={how === 'num'} onClick={() => setHow('num')}>Числом</button>
              </div>
            </div>
            {how === 'steps' ? (
              <label className="field" htmlFor="gSteps">Кроки, по одному в рядку
                <textarea id="gSteps" rows={3} placeholder={'Скласти список 20 потенційних клієнтів\nНаписати 5 бізнесам\nВідправити пропозицію'} value={v.steps} onChange={e => setV({ ...v, steps: e.target.value })} />
              </label>
            ) : (
              <div className="row">
                <label className="field" htmlFor="gTarget" style={{ flex: '1 1 90px' }}>Скільки<input id="gTarget" type="number" min="1" required placeholder="21" value={v.target} onChange={e => setV({ ...v, target: e.target.value })} /></label>
                <label className="field" htmlFor="gUnit" style={{ flex: '1 1 90px' }}>Одиниця<input id="gUnit" placeholder="км" autoComplete="off" value={v.unit} onChange={e => setV({ ...v, unit: e.target.value })} /></label>
              </div>
            )}
            <div className="row">
              <label className="field" htmlFor="gArea" style={{ flex: '1 1 120px' }}>Сфера<select id="gArea" value={v.area} onChange={e => setV({ ...v, area: e.target.value })}>{AREAS.map(a => <option key={a}>{a}</option>)}</select></label>
              <label className="field" htmlFor="gDue" style={{ flex: '1 1 140px' }}>Дедлайн<input id="gDue" type="date" value={v.due} onChange={e => setV({ ...v, due: e.target.value })} /></label>
            </div>
            <button className="btn" style={{ alignSelf: 'flex-start' }}>Додати ціль</button>
          </form>
          <div style={{ marginTop: 12 }}>
            {S.goals.map(g => <GoalItem key={g.id} g={g} />)}
            {!S.goals.length && <p className="muted">Цілей поки немає. Додай першу вище.</p>}
          </div>
        </div>
        <div className="card s5">
          <div className="ch"><Icon n="life" className="ic" /><div><h3>Колесо балансу</h3><p>Оціни кожну сферу від 1 до 10</p></div></div>
          <Radar vals={S.wheel} />
          <p className="muted" style={{ fontSize: 12 }}>Середній бал {(sum(S.wheel) / 8).toFixed(1)} з 10. Найбільше уваги потребує: {weakest}.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {AREAS.map((a, i) => (
              <label className="sl" htmlFor={'wl' + i} key={a}><span>{a}</span>
                <input type="range" id={'wl' + i} min="1" max="10" value={S.wheel[i]} onChange={e => update(s => { s.wheel[i] = +e.target.value; })} />
                <b className="num">{S.wheel[i]}</b>
              </label>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
