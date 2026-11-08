'use client';

import { useEffect, useRef, type FormEvent } from 'react';
import { NAV, useStore, vinfo, type Store } from '@/lib/store';
import { parseTask } from '@/lib/tasks';
import { PLATFORMS } from '@/lib/social';
import { COLORS, TK } from '@/lib/util';
import { Icon, type IconName } from './Icon';
import { SosBody } from './Sos';

type Field = { k: string; label: string; type?: 'text' | 'number' | 'date' | 'time' | 'select' | 'textarea' | 'hidden'; req?: boolean; half?: boolean; ph?: string; val?: string; opts?: readonly (readonly [string, string])[] };
/** del: shown as a two-click «Видалити» button in edit forms. */
type FormSpec = { t: string; f: Field[]; ok: (v: Record<string, string>) => void | boolean; del?: (v: Record<string, string>) => void };

function forms(st: Store): Record<string, FormSpec> {
  const { A } = st;
  const num = (v: string) => +v.replace(',', '.') || 0;
  return {
    task: { t: 'Нова задача', f: [{ k: 'text', label: 'Що зробити', req: true, ph: 'Напр. Подзвонити клієнту завтра !' }, { k: 'pri', label: 'Пріоритет', type: 'select', half: true, opts: [['lo', 'Звичайно'], ['hi', 'Важливо']], val: 'lo' }, { k: 'due', label: 'Термін', type: 'date', half: true }], ok: v => { const q = parseTask(v.text); A.addTask(q.t, v.pri === 'hi' ? 'hi' : q.p, undefined, v.due || q.due); } },
    event: { t: 'Нова подія', f: [{ k: 'title', label: 'Назва', req: true, ph: 'Зустріч, лекція, спорт…' }, { k: 'date', label: 'Дата', type: 'date', val: TK(), half: true }, { k: 'c', label: 'Колір', type: 'select', opts: COLORS, half: true }, { k: 's', label: 'Початок', type: 'time', val: '10:00', half: true }, { k: 'e', label: 'Кінець', type: 'time', val: '11:00', half: true }], ok: v => A.addEvent({ title: v.title, date: v.date || TK(), s: v.s, e: v.e, c: v.c }) },
    social: { t: 'Час у соцмережах', f: [{ k: 'platform', label: 'Платформа', type: 'select', half: true, opts: PLATFORMS.map(c => [c, c] as const) }, { k: 'min', label: 'Хвилин', type: 'number', req: true, half: true, ph: '20' }, { k: 'date', label: 'День', type: 'date', val: TK() }], ok: v => A.addSocial({ platform: v.platform, min: num(v.min), date: v.date && v.date <= TK() ? v.date : TK() }) },
    habit: { t: 'Нова звичка', f: [{ k: 'name', label: 'Звичка', req: true, ph: '10 хвилин медитації' }], ok: v => A.addHabit(v.name) },
    note: { t: 'Швидка нотатка', f: [{ k: 'text', label: 'Текст', type: 'textarea', req: true, ph: 'Ідея, думка, список…' }], ok: v => { A.addNote(v.text); } },
    editTask: { t: 'Змінити задачу', f: [{ k: 'id', label: '', type: 'hidden' }, { k: 'text', label: 'Що зробити', req: true }, { k: 'pri', label: 'Пріоритет', type: 'select', opts: [['lo', 'Звичайно'], ['hi', 'Важливо']], half: true }, { k: 'due', label: 'Термін', type: 'date', half: true }, { k: 'goal', label: 'Для цілі', type: 'select', half: true, opts: [['', 'Без цілі'], ...st.S.goals.map(g => [String(g.id), g.title] as const)] }], ok: v => A.updateTask(+v.id, { t: v.text, p: v.pri as 'hi' | 'lo', goal: +v.goal || undefined, due: v.due || undefined }), del: v => A.delTask(+v.id) },
    editEvent: { t: 'Змінити подію', f: [{ k: 'id', label: '', type: 'hidden' }, { k: 'title', label: 'Назва', req: true }, { k: 'date', label: 'Дата', type: 'date', half: true }, { k: 'c', label: 'Колір', type: 'select', opts: COLORS, half: true }, { k: 's', label: 'Початок', type: 'time', half: true }, { k: 'e', label: 'Кінець', type: 'time', half: true }], ok: v => A.updateEvent(+v.id, { title: v.title, date: v.date || TK(), s: v.s, e: v.e, c: v.c }), del: v => A.delEvent(+v.id) },
    editHabit: { t: 'Змінити звичку', f: [{ k: 'id', label: '', type: 'hidden' }, { k: 'name', label: 'Звичка', req: true }], ok: v => A.renameHabit(+v.id, v.name), del: v => A.delHabit(+v.id) },
  };
}

const QA: [string, string, IconName][] = [
  ['task', 'Задача', 'tasks'], ['event', 'Подія', 'schedule'], ['habit', 'Звичка', 'habits'], ['social', 'Соцмережі', 'wave'], ['sos', 'SOS потяг', 'flame'], ['note', 'Нотатка', 'notes'],
];

function FormBody({ spec, close }: { spec: FormSpec; close: () => void }) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('input,textarea')?.focus(), 60); return () => clearTimeout(t); }, []);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const fd = new FormData(ref.current!), v: Record<string, string> = {};
    spec.f.forEach(f => { v[f.k] = String(fd.get(f.k) ?? '').trim(); });
    if (spec.f.some(f => f.req && !v[f.k])) return;
    if (spec.ok(v) === false) return;
    close();
  };
  return (
    <form ref={ref} className="row" style={{ alignItems: 'flex-end' }} onSubmit={submit}>
      {spec.f.map(f => {
        const id = 'qf_' + f.k;
        if (f.type === 'hidden') return <input key={f.k} type="hidden" name={f.k} defaultValue={f.val} />;
        const input = f.type === 'select'
          ? <select id={id} name={f.k} defaultValue={f.val}>{f.opts!.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          : f.type === 'textarea'
            ? <textarea id={id} name={f.k} rows={5} placeholder={f.ph} required={f.req} />
            : <input id={id} name={f.k} type={f.type || 'text'} defaultValue={f.val} placeholder={f.ph} required={f.req} autoComplete="off" {...(f.type === 'number' ? { min: 0, step: 'any', inputMode: 'decimal' as const } : {})} />;
        return <label key={f.k} className="field" htmlFor={id} style={{ flex: f.half ? '1 1 140px' : '1 1 100%' }}>{f.label}{input}</label>;
      })}
      <div className="row" style={{ flex: '1 1 100%', justifyContent: 'flex-end', marginTop: 6 }}>
        {spec.del && <button type="button" className="btn ghost danger" style={{ marginRight: 'auto' }} onClick={() => {
          const fd = new FormData(ref.current!), v: Record<string, string> = {};
          spec.f.forEach(f => { v[f.k] = String(fd.get(f.k) ?? ''); });
          spec.del!(v); close();
        }}><Icon n="trash" />Видалити</button>}
        <button type="button" className="btn ghost" onClick={close}>Скасувати</button>
        <button className="btn acc">Зберегти</button>
      </div>
    </form>
  );
}

export function SheetHost() {
  const st = useStore();
  const { sheet, setSheet, go } = st;
  if (!sheet) return null;
  const close = () => setSheet(null);
  let title = '', body = null;
  if (sheet.kind === 'qa') {
    title = 'Швидко додати';
    body = (
      <>
        <div className="qa-grid">
          {QA.map(([k, l, i]) => (
            <button key={k} onClick={() => {
              setSheet(k === 'sos' ? { kind: 'sos' } : { kind: 'form', key: k });
            }}><Icon n={i} className="ic" />{l}</button>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 12, margin: '14px 0 0' }}>Клавіша N відкриває це меню, Ctrl K шукає команди.</p>
      </>
    );
  } else if (sheet.kind === 'more') {
    title = 'Розділи';
    body = (
      <>
        <div className="qa-grid">
          {NAV.map(k => { const [, l, i] = vinfo(k)!; return <button key={k} onClick={() => go(k)}><Icon n={i as IconName} className="ic" />{l}</button>; })}
        </div>
      </>
    );
  } else if (sheet.kind === 'sos') {
    title = 'SOS: сильний потяг';
    body = <SosBody close={close} habit={sheet.habit} />;
  } else {
    const base = forms(st)[sheet.key];
    if (!base) return null;
    const init = sheet.init || {};
    const spec = { ...base, f: base.f.map(f => (f.k in init ? { ...f, val: init[f.k] } : f)) };
    title = spec.t;
    body = <FormBody key={sheet.key + JSON.stringify(init)} spec={spec} close={close} />;
  }
  return (
    <div className="sheet" onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="sheet-p" role="dialog" aria-modal="true" aria-labelledby="sheetT">
        <div className="sheet-h"><b id="sheetT">{title}</b><button className="iconbtn sm" onClick={close} aria-label="Закрити"><Icon n="x" /></button></div>
        {body}
      </div>
    </div>
  );
}
