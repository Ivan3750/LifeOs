'use client';

import type { ReactNode } from 'react';
import { useStore } from '@/lib/store';
import { areaLabel, HOME_BLOCKS, homeOn, MODULES, moduleOn, seasonOn } from '@/lib/life';
import { fmtDate, TK } from '@/lib/util';
import { Icon } from './Icon';
import { ModeChips } from './Life';

function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="togrow">
      <span className="t">{label}{hint && <small>{hint}</small>}</span>
      <button className="switch" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />
    </div>
  );
}
const Block = ({ title, children }: { title: string; children: ReactNode }) => <div style={{ marginTop: 18 }}><h4 style={{ margin: '0 0 4px', fontWeight: 600 }}>{title}</h4>{children}</div>;

/** What is shown, what is on, what is private, what is resting. Switching something off only hides it: the data stays where it is. */
export function LifeSettings() {
  const { S, A, setSheet } = useStore();
  const k = TK(), se = seasonOn(S, k), u = S.ui;
  const activeGoals = S.goals.filter(g => !g.paused), pausedGoals = S.goals.filter(g => g.paused);
  const activeHabits = S.habits.filter(h => !h.paused), pausedHabits = S.habits.filter(h => h.paused);
  return (
    <div className="card cardcol">
      <div className="ch" style={{ marginBottom: 0 }}><Icon n="life" className="ic" /><div><h3>Життя й спокій</h3><p>Режим, що показувати, що приховати й що поставити на паузу</p></div></div>

      <Block title="Режим життя"><ModeChips /></Block>
      <Block title="Пріоритети періоду">
        <p className="help" style={{ margin: '4px 0 8px' }}>{se ? `Зараз головне: ${se.main.map(areaLabel).join(', ')} · до ${fmtDate(se.to)}` : 'Тимчасових пріоритетів немає.'}</p>
        <button className="btn ghost sm" onClick={() => setSheet({ kind: 'season' })}>{S.season ? 'Змінити пріоритети' : 'Обрати пріоритети'}</button>
      </Block>

      <Block title="Головний екран">
        <Toggle label="Мінімалістичний режим" hint="Лише справи на сьогодні й найближчі події" on={u.minimal} onChange={v => A.setUi({ minimal: v })} />
        <Toggle label="Приховати показники" hint="Без кроків, хвилин фокусу й відсотків на головній" on={u.hideMetrics} onChange={v => A.setUi({ hideMetrics: v })} />
        {HOME_BLOCKS.map(([key, label]) => <Toggle key={key} label={label} on={homeOn(S, key)} onChange={v => A.setHomeBlock(key, v)} />)}
      </Block>

      <Block title="Розділи">
        <p className="help" style={{ margin: '4px 0' }}>Вимкнений розділ зникає з меню, але його дані лишаються.</p>
        {MODULES.map(([key, label]) => <Toggle key={key} label={label} on={moduleOn(S, key)} onChange={v => A.setModule(key, v)} />)}
      </Block>

      <Block title="Приватність">
        <Toggle label="Приховувати приватні тексти" hint="Anela і «Віра»: текст розмитий, поки не торкнешся його" on={u.hideText} onChange={v => A.setUi({ hideText: v })} />
        <Toggle label="Додавати приватні розділи в таблиці експорту" hint="Повна резервна копія містить усі дані завжди" on={u.exportPrivate} onChange={v => A.setUi({ exportPrivate: v })} />
        <p className="help" style={{ marginTop: 8 }}>Приватні записи ніколи не потрапляють у поради, підрахунки й нагадування, і ніде не надсилаються, крім твоєї бази даних.</p>
      </Block>

      <Block title="Паузи">
        <p className="help" style={{ margin: '4px 0' }}>Ціль чи звичка на паузі не показується в списках і нічого не рахує. Її можна повернути будь-коли.</p>
        {[...activeGoals.map(g => ({ key: 'g' + g.id, label: 'Ціль: ' + g.title, on: false, set: (v: boolean) => A.pauseGoal(g.id, v) })), ...pausedGoals.map(g => ({ key: 'g' + g.id, label: 'Ціль: ' + g.title, on: true, set: (v: boolean) => A.pauseGoal(g.id, v) })),
          ...activeHabits.map(h => ({ key: 'h' + h.id, label: 'Звичка: ' + h.name, on: false, set: (v: boolean) => A.pauseHabit(h.id, v) })), ...pausedHabits.map(h => ({ key: 'h' + h.id, label: 'Звичка: ' + h.name, on: true, set: (v: boolean) => A.pauseHabit(h.id, v) }))]
          .map(r => <Toggle key={r.key} label={r.label} hint={r.on ? 'на паузі' : undefined} on={r.on} onChange={r.set} />)}
        {!S.goals.length && !S.habits.length && <p className="help">Поки немає ні цілей, ні звичок.</p>}
      </Block>
    </div>
  );
}
