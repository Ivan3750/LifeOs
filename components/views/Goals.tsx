'use client';

import { useRef, useState, type FormEvent } from 'react';
import type { Goal } from '@/lib/types';
import { goalStep, useStore } from '@/lib/store';
import { goalProgress } from '@/lib/goals';
import { AREAS, daysTo, fmtN, sum } from '@/lib/util';
import { Icon, type IconName } from '../Icon';
import { Radar } from '../charts';
import { DelBtn, Empty } from '../shared';

const AREA_ICON: Record<string, IconName> = { 'Здоровʼя': 'health', 'Карʼєра': 'company', 'Фінанси': 'money', 'Стосунки': 'leads', 'Друзі': 'team', 'Відпочинок': 'bed', 'Розвиток': 'trend', 'Дім': 'home' };

/** Ten small bars: tap one to rate the area. */
function Dots({ value, onPick, label }: { value: number; onPick: (n: number) => void; label: string }) {
  return (
    <div className="dots" role="radiogroup" aria-label={label}>
      {[...Array(10)].map((_, i) => <button key={i} role="radio" aria-checked={value === i + 1} aria-label={`${i + 1} з 10`} className={i < value ? 'on' : ''} onClick={() => onPick(i + 1)} />)}
    </div>
  );
}

/** One goal: a bar and one line when closed; steps, tasks and editing when opened. */
function GoalItem({ g }: { g: Goal }) {
  const { S, A, update, go } = useStore();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [e, setE] = useState({ title: g.title, target: String(g.target || ''), unit: g.unit, due: g.due });
  const [step, setStep] = useState('');
  const [task, setTask] = useState('');
  const steps = g.steps || [], rating = g.kind === 'rating', bySteps = !rating && (steps.length > 0 || !g.target);
  const prog = goalProgress(g), left = g.due ? daysTo(g.due) : null;
  const done = prog >= 1 && (rating || steps.length > 0 || g.target > 0);
  const tasks = S.tasks.filter(t => t.goal === g.id && !t.d);
  const save = () => { A.updateGoal(g.id, { title: e.title.trim() || g.title, target: Math.max(0, +e.target || 0), unit: e.unit.trim(), due: e.due }); setEdit(false); };
  const summary = rating ? `${g.cur} з 10 · мета ${g.target}` : bySteps ? `${steps.filter(s => s.d).length} з ${steps.length} кроків` : `${fmtN(g.cur)} / ${fmtN(g.target)} ${g.unit}`;
  return (
    <div className={`goal2${done ? ' done' : ''}`}>
      <button className="g2head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="g2t">{g.title}{done && <span className="g2ok"><Icon n="check" /></span>}</span>
        <span className="g2s num">{summary}</span>
        <span className="g2bar"><i style={{ width: prog * 100 + '%' }} /></span>
        <span className="g2d">{left === null ? '' : left < 0 ? 'термін минув' : left === 0 ? 'сьогодні' : `ще ${left} дн`}</span>
      </button>
      {open && (
        <div className="g2body">
          {rating && <p className="help" style={{ margin: 0 }}>Ця ціль росте разом із оцінкою сфери «{g.area}»: була {g.from}, зараз {g.cur}, мета {g.target}. Підвищуй оцінку зверху, коли відчуваєш прогрес, і додавай кроки, що до нього ведуть.</p>}
          {!rating && !bySteps && (
            <div className="row">
              <button className="sqb" aria-label="Зменшити прогрес" onClick={() => A.stepGoal(g.id, -1)}>−</button>
              <button className="sqb" onClick={() => A.stepGoal(g.id, 1)}>+{fmtN(goalStep(g.target))}</button>
            </div>
          )}
          <div className="gsteps">
            {rating || bySteps ? <span className="muted" style={{ fontSize: 12 }}>{rating ? 'Дії' : 'Кроки'}</span> : null}
            {steps.map(s => (
              <div className={`item ${s.d ? 'done' : ''}`} key={s.id}>
                <button className={`chk ${s.d ? 'on' : ''}`} aria-pressed={s.d} aria-label={`Крок: ${s.t}`} onClick={() => A.toggleStep(g.id, s.id)}>{s.d && <Icon n="check" />}</button>
                <span className="t">{s.t}</span>
                <button className="ib" aria-label="Видалити крок" title="Видалити крок" onClick={() => A.delStep(g.id, s.id)}><Icon n="x" /></button>
              </div>
            ))}
            {(rating || bySteps || edit) && <input className="gin" placeholder={rating ? '+ дія, напр. «запросити на каву»' : '+ крок'} value={step} onChange={x => setStep(x.target.value)} onKeyDown={x => { if (x.key === 'Enter') { x.preventDefault(); A.addStep(g.id, step); setStep(''); } }} aria-label="Додати крок до цілі" />}
          </div>
          <div className="gtasks">
            <span className="muted" style={{ fontSize: 12 }}>Задачі для цілі{tasks.length ? '' : ': поки немає'}</span>
            {tasks.map(t => (
              <div className="item" key={t.id}>
                <button className="chk" aria-label="Виконано" onClick={() => A.toggleTask(t.id)} />
                <span className="t">{t.t}</span>
                <button className="ib" title="Фокус на задачі" aria-label="Фокус на задачі" onClick={() => { update(s => { s.timer.task = t.t; }); go('focus'); }}><Icon n="focus" /></button>
              </div>
            ))}
            <input className="gin" placeholder="+ задача, напр. «написати 5 бізнесам»" value={task} onChange={x => setTask(x.target.value)} onKeyDown={x => { if (x.key === 'Enter') { x.preventDefault(); A.addTask(task, 'hi', g.id); setTask(''); } }} aria-label="Додати задачу для цілі" />
          </div>
          {edit && (
            <div className="gedit">
              <label className="field" htmlFor={`gt${g.id}`}>Назва<input id={`gt${g.id}`} value={e.title} onChange={x => setE({ ...e, title: x.target.value })} /></label>
              <div className="row">
                <label className="field" htmlFor={`gn${g.id}`} style={{ flex: '1 1 90px' }}>{rating ? 'Мета (оцінка 1–10)' : 'Скільки (0 = по кроках)'}<input id={`gn${g.id}`} type="number" min="0" max={rating ? 10 : undefined} value={e.target} onChange={x => setE({ ...e, target: x.target.value })} /></label>
                {!rating && <label className="field" htmlFor={`gu${g.id}`} style={{ flex: '1 1 90px' }}>Одиниця<input id={`gu${g.id}`} value={e.unit} onChange={x => setE({ ...e, unit: x.target.value })} /></label>}
                <label className="field" htmlFor={`gd${g.id}`} style={{ flex: '1 1 140px' }}>Дедлайн<input id={`gd${g.id}`} type="date" value={e.due} onChange={x => setE({ ...e, due: x.target.value })} /></label>
              </div>
              <button className="btn acc sm" style={{ alignSelf: 'flex-start' }} onClick={save}>Зберегти</button>
            </div>
          )}
          <div className="g2foot">
            <button className="btn ghost sm" onClick={() => setEdit(!edit)}><Icon n="edit" />{edit ? 'Закрити редагування' : 'Змінити'}</button>
            <DelBtn label="Видалити ціль" onDelete={() => A.delGoal(g.id)} />
          </div>
        </div>
      )}
    </div>
  );
}

type How = 'steps' | 'num' | 'rating';

/** New goal. The way of measuring is chosen first, because a goal like «знайти дівчину» is not a number. */
function AddGoal({ area, onDone }: { area: string; onDone: () => void }) {
  const { S, A } = useStore();
  const [v, setV] = useState({ title: '', target: '', unit: '', area, due: '', steps: '' });
  const [how, setHow] = useState<How>(area === 'Стосунки' || area === 'Відпочинок' || area === 'Друзі' ? 'rating' : 'steps');
  const idx = Math.max(0, AREAS.indexOf(v.area)), now = S.wheel[idx] ?? 5;
  const [want, setWant] = useState(Math.min(10, now + 2));
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (!v.title.trim()) return;
    const steps = how !== 'num' ? v.steps.split('\n').map(s => s.trim()).filter(Boolean) : [];
    if (how === 'num' && !(+v.target > 0)) return;
    if (how === 'rating') A.addGoal({ title: v.title.trim(), area: v.area, target: Math.max(want, now + 1 > 10 ? 10 : now + 1), unit: '', due: v.due, steps, kind: 'rating' });
    else A.addGoal({ title: v.title.trim(), area: v.area, target: how === 'num' ? +v.target : 0, unit: how === 'num' ? v.unit.trim() : '', due: v.due, steps });
    onDone();
  };
  return (
    <form className="card addgoal" onSubmit={submit}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Нова ціль</h3>
        <button type="button" className="ib" aria-label="Закрити" onClick={onDone}><Icon n="x" /></button>
      </div>
      <input className="bigin" aria-label="Назва цілі" autoFocus required placeholder="Що хочеш отримати? напр. «Знайти дівчину» чи «Перший клієнт»" autoComplete="off" value={v.title} onChange={e => setV({ ...v, title: e.target.value })} />
      <div className="how" role="radiogroup" aria-label="Як міряти прогрес">
        {([['steps', 'Кроками', 'Список справ, які треба зробити'], ['num', 'Числом', 'Кілометри, гроші, книги…'], ['rating', 'Оцінкою сфери', 'Для того, що не порахуєш: стосунки, спокій']] as const).map(([k, l, h]) => (
          <button type="button" key={k} role="radio" aria-checked={how === k} onClick={() => setHow(k)}><b>{l}</b><small>{h}</small></button>
        ))}
      </div>
      {how === 'num' && (
        <div className="row">
          <label className="field" htmlFor="gTarget" style={{ flex: '1 1 90px' }}>Скільки<input id="gTarget" type="number" min="1" required placeholder="21" value={v.target} onChange={e => setV({ ...v, target: e.target.value })} /></label>
          <label className="field" htmlFor="gUnit" style={{ flex: '1 1 90px' }}>Одиниця<input id="gUnit" placeholder="км" autoComplete="off" value={v.unit} onChange={e => setV({ ...v, unit: e.target.value })} /></label>
        </div>
      )}
      {how === 'rating' && (
        <div className="field">
          <span>Сфера «{v.area}» зараз на <b className="num">{now}</b>. До скількох хочеш її підняти?</span>
          <Dots value={want} onPick={setWant} label="Мета для сфери" />
        </div>
      )}
      {how !== 'num' && (
        <label className="field" htmlFor="gSteps">{how === 'rating' ? 'Перші дії (необовʼязково), по одній у рядку' : 'Кроки, по одному в рядку'}
          <textarea id="gSteps" rows={3} placeholder={how === 'rating' ? 'Записатися на танці\nЗнайомитись частіше, 1 нова розмова на тиждень' : 'Скласти список 20 потенційних клієнтів\nНаписати 5 бізнесам\nВідправити пропозицію'} value={v.steps} onChange={e => setV({ ...v, steps: e.target.value })} />
        </label>
      )}
      <div className="row">
        <label className="field" htmlFor="gArea" style={{ flex: '1 1 140px' }}>Сфера<select id="gArea" value={v.area} onChange={e => setV({ ...v, area: e.target.value })}>{AREAS.map(a => <option key={a}>{a}</option>)}</select></label>
        <label className="field" htmlFor="gDue" style={{ flex: '1 1 140px' }}>Дедлайн<input id="gDue" type="date" value={v.due} onChange={e => setV({ ...v, due: e.target.value })} /></label>
      </div>
      <button className="btn acc" style={{ alignSelf: 'flex-start' }}>Додати ціль</button>
    </form>
  );
}

export function Goals() {
  const { S, A } = useStore();
  const [adding, setAdding] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const avg = sum(S.wheel) / AREAS.length;
  const weakest = AREAS[S.wheel.indexOf(Math.min(...S.wheel))];
  const startAdd = (area: string) => { setAdding(area); setTimeout(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30); };
  const known = new Set<string>(AREAS);
  const other = S.goals.filter(g => !known.has(g.area));
  const active = S.goals.filter(g => goalProgress(g) < 1).length;
  return (
    <section className="view">
      <div className="vh">
        <div><h2>Цілі та сфери життя</h2><p>{S.goals.length ? `${active} ${active === 1 ? 'ціль у роботі' : 'цілей у роботі'} · середній баланс ${avg.toFixed(1)} з 10` : 'Оціни сфери життя й постав цілі там, де хочеш рости.'}</p></div>
        <button className="btn acc" style={{ marginLeft: 'auto' }} onClick={() => startAdd(weakest)}>+ Ціль</button>
      </div>

      <div ref={top} style={{ scrollMarginTop: 12 }}>{adding !== null && <div style={{ marginTop: 18 }}><AddGoal key={adding} area={adding} onDone={() => setAdding(null)} /></div>}</div>

      <div className="card lifecard">
        <div className="lc-radar"><Radar vals={S.wheel} /></div>
        <div className="lc-text">
          <h3>Колесо балансу</h3>
          <p className="muted">Оціни кожну сферу від 1 до 10 нижче: колесо покаже, де перекіс. Ціль у сфері росте разом із її оцінкою.</p>
          <div className="lc-stats">
            <div><span>Середній бал</span><b className="num">{avg.toFixed(1)}</b></div>
            <div><span>Найслабша сфера</span><b>{weakest}</b></div>
          </div>
          <button className="btn ghost sm" onClick={() => startAdd(weakest)}>Додати ціль у «{weakest}»</button>
        </div>
      </div>

      <div className="areas">
        {AREAS.map((a, i) => {
          const goals = S.goals.filter(g => g.area === a);
          return (
            <div className="card area" key={a}>
              <div className="area-h">
                <span className="area-i"><Icon n={AREA_ICON[a] || 'goals'} /></span>
                <div><h4>{a}</h4><span className="muted">{goals.length ? `${goals.length} ${goals.length === 1 ? 'ціль' : 'цілей'}` : 'без цілей'}</span></div>
                <b className="num area-n">{S.wheel[i]}<small>/10</small></b>
              </div>
              <Dots value={S.wheel[i]} onPick={n => A.setWheel(i, n)} label={`Оцінка сфери ${a}`} />
              <div className="area-goals">
                {goals.map(g => <GoalItem key={g.id} g={g} />)}
              </div>
              <button className="area-add" onClick={() => startAdd(a)}>+ ціль у цій сфері</button>
            </div>
          );
        })}
      </div>

      {other.length > 0 && <div className="card" style={{ marginTop: 18 }}><div className="ch"><div><h3>Інші цілі</h3></div></div>{other.map(g => <GoalItem key={g.id} g={g} />)}</div>}
      {!S.goals.length && <div className="card" style={{ marginTop: 18 }}><Empty icon="goals" title="Цілей ще нема" text="Обери сферу, у якій хочеш рости, і постав першу ціль: кроками, числом або оцінкою сфери." /></div>}
    </section>
  );
}
