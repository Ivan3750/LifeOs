'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, VIEWS } from '@/lib/store';
import { TK } from '@/lib/util';
import { searchAll } from '@/lib/search';
import { claudeReport } from '@/lib/report';
import { OFF_KINDS } from '@/lib/score';
import type { OffKind } from '@/lib/types';

type Cmd = { l: string; k: string; run: () => void };

export function Palette() {
  const { palette } = useStore();
  return palette ? <PaletteDialog /> : null;
}

function PaletteDialog() {
  const { S, setPalette, go, setSheet, toggleTimer, resetTimer, setTimerMode, A, update, toast } = useStore();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { const t = setTimeout(() => input.current?.focus(), 30); return () => clearTimeout(t); }, []);

  const items = useMemo<Cmd[]>(() => {
    const base: Cmd[] = [
      ...VIEWS.map(([k, l]) => ({ l: 'Відкрити: ' + l, k: 'Перехід', run: () => go(k) })),
      { l: S.timer.running ? 'Поставити таймер на паузу' : 'Запустити таймер фокусу', k: 'Таймер', run: () => { if (S.timer.mode !== 'focus' && !S.timer.running) setTimerMode('focus'); toggleTimer(); } },
      { l: 'Скинути таймер', k: 'Таймер', run: resetTimer },
      { l: 'Скопіювати звіт для Claude (аналіз у чаті)', k: 'Аналіз', run: () => { const t = claudeReport(S); navigator.clipboard?.writeText(t).then(() => toast('Звіт скопійовано: встав його в чат Claude'), () => toast('Не вдалося скопіювати: відкрий Поради')); } },
      { l: 'Швидко додати…', k: 'N', run: () => setSheet({ kind: 'qa' }) },
      ...(Object.entries(OFF_KINDS) as [OffKind, (typeof OFF_KINDS)[OffKind]][]).map(([kind, o]) => ({ l: `Сьогодні: ${o.label.toLowerCase()}`, k: 'День', run: () => A.setDayOff(TK(), kind) })),
      ...(S.offDays?.[TK()] ? [{ l: 'Сьогодні звичайний день (зняти позначку)', k: 'День', run: () => A.setDayOff(TK(), null) }] : []),
      { l: 'SOS: сильний потяг до шкідливої звички', k: 'Відмова', run: () => setSheet({ kind: 'sos' }) },
      { l: 'Записати час у соцмережах', k: 'Час', run: () => setSheet({ kind: 'form', key: 'social' }) },
      { l: 'Нова подія', k: 'Розклад', run: () => setSheet({ kind: 'form', key: 'event' }) },
      ...S.tasks.filter(t => !t.d).map(t => ({ l: 'Фокус на: ' + t.t, k: 'Задача', run: () => { update(s => { s.timer.task = t.t; }); go('focus'); } })),
      ...S.habits.filter(h => !h.days[TK()]).map(h => ({ l: 'Відмітити звичку: ' + h.name, k: 'Звичка', run: () => A.toggleHabit(h.id) })),
    ];
    const t = q.trim(), ql = t.toLowerCase();
    let r = ql ? base.filter(c => c.l.toLowerCase().includes(ql)) : base;
    if (t.startsWith('+')) r = [{ l: 'Додати задачу: ' + t.slice(1).trim(), k: 'Enter', run: () => A.addTaskLine(t.slice(1)) }, ...r];
    else if (ql && !r.length) r = [{ l: 'Додати задачу: ' + t, k: 'Enter', run: () => A.addTaskLine(t) }];
    // what the person wrote (tasks, notes, goals…) is searched too, so nothing has to be found by opening every section
    const found = t.startsWith('+') ? [] : searchAll(S, t).map(h => ({ l: h.l, k: h.k, run: () => go(h.to) }));
    return [...r.slice(0, ql ? 5 : 9), ...found].slice(0, 11);
  }, [q, S, go, setSheet, toggleTimer, resetTimer, setTimerMode, A, update, toast]);

  const run = (i: number) => { const c = items[i]; setPalette(false); c?.run(); };
  const s = Math.min(sel, items.length - 1);
  return (
    <div className="ov" onClick={e => { if (e.target === e.currentTarget) setPalette(false); }}>
      <div className="pal" role="dialog" aria-label="Команди">
        <input ref={input} value={q} placeholder="Знайти будь-що, «+ задача» або «-45 кава»…" autoComplete="off"
          onChange={e => { setQ(e.target.value); setSel(0); }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { setSel((s + 1) % items.length); e.preventDefault(); }
            else if (e.key === 'ArrowUp') { setSel((s - 1 + items.length) % items.length); e.preventDefault(); }
            else if (e.key === 'Enter') run(s);
          }} />
        <ul role="listbox">
          {items.map((c, i) => <li key={c.k + c.l} role="option" aria-selected={i === s} onClick={() => run(i)}>{c.l}<small>{c.k}</small></li>)}
        </ul>
      </div>
    </div>
  );
}
