'use client';

import { useEffect, useRef, type FormEvent } from 'react';
import { NAV, useStore, vinfo, type Store } from '@/lib/store';
import { addD, CATS, COLORS, STAGES, TK, ymd } from '@/lib/util';
import { Icon, type IconName } from './Icon';
import { ModeSeg } from './Shell';

type Field = { k: string; label: string; type?: 'text' | 'number' | 'date' | 'time' | 'select' | 'textarea'; req?: boolean; half?: boolean; ph?: string; val?: string; opts?: readonly (readonly [string, string])[] };
type FormSpec = { t: string; f: Field[]; ok: (v: Record<string, string>) => void | boolean };

function forms(st: Store): Record<string, FormSpec> {
  const { A } = st;
  const num = (v: string) => +v.replace(',', '.') || 0;
  return {
    task: { t: 'Нова задача', f: [{ k: 'text', label: 'Що зробити', req: true, ph: 'Напр. Подзвонити клієнту' }, { k: 'pri', label: 'Пріоритет', type: 'select', opts: [['lo', 'Звичайно'], ['hi', 'Важливо']], val: 'lo' }], ok: v => A.addTask(v.text, v.pri as 'hi' | 'lo') },
    out: { t: 'Нова витрата', f: [{ k: 'amt', label: 'Сума, kr.', type: 'number', req: true, half: true, ph: '120' }, { k: 'cat', label: 'Категорія', type: 'select', half: true, opts: CATS.out.map(c => [c, c] as const) }, { k: 'note', label: 'Коментар', ph: 'Кава з друзями' }, { k: 'date', label: 'Дата', type: 'date', val: TK() }], ok: v => A.addTx('out', num(v.amt), v.cat, v.note, v.date || TK()) },
    in: { t: 'Новий дохід', f: [{ k: 'amt', label: 'Сума, kr.', type: 'number', req: true, half: true, ph: '5000' }, { k: 'cat', label: 'Категорія', type: 'select', half: true, opts: CATS.in.map(c => [c, c] as const) }, { k: 'note', label: 'Коментар', ph: 'Звідки гроші' }, { k: 'date', label: 'Дата', type: 'date', val: TK() }], ok: v => A.addTx('in', num(v.amt), v.cat, v.note, v.date || TK()) },
    event: { t: 'Нова подія', f: [{ k: 'title', label: 'Назва', req: true, ph: 'Зустріч, лекція, спорт…' }, { k: 'date', label: 'Дата', type: 'date', val: TK(), half: true }, { k: 'c', label: 'Колір', type: 'select', opts: COLORS, half: true }, { k: 's', label: 'Початок', type: 'time', val: '10:00', half: true }, { k: 'e', label: 'Кінець', type: 'time', val: '11:00', half: true }], ok: v => A.addEvent({ title: v.title, date: v.date || TK(), s: v.s, e: v.e, c: v.c }) },
    habit: { t: 'Нова звичка', f: [{ k: 'name', label: 'Звичка', req: true, ph: '10 хвилин медитації' }], ok: v => A.addHabit(v.name) },
    note: { t: 'Швидка нотатка', f: [{ k: 'text', label: 'Текст', type: 'textarea', req: true, ph: 'Ідея, думка, список…' }], ok: v => { A.addNote(v.text); } },
    deal: { t: 'Нова угода', f: [{ k: 'title', label: 'Що продаємо', req: true, ph: 'Сайт для кавʼярні' }, { k: 'client', label: 'Клієнт', half: true, ph: 'Назва компанії' }, { k: 'amt', label: 'Сума, kr.', type: 'number', half: true, ph: '40000' }, { k: 'stage', label: 'Етап', type: 'select', opts: STAGES, val: 'lead' }], ok: v => A.addDeal({ title: v.title, client: v.client, amt: num(v.amt), stage: v.stage }) },
    project: { t: 'Новий проєкт', f: [{ k: 'name', label: 'Назва', req: true, ph: 'Редизайн сайту' }, { k: 'client', label: 'Клієнт', half: true }, { k: 'budget', label: 'Бюджет, kr.', type: 'number', half: true }, { k: 'due', label: 'Дедлайн', type: 'date', val: ymd(addD(new Date(), 30)) }], ok: v => A.addProject({ name: v.name, client: v.client, budget: num(v.budget), due: v.due }) },
    invoice: { t: 'Новий рахунок', f: [{ k: 'client', label: 'Клієнт', req: true, half: true }, { k: 'amt', label: 'Сума, kr.', type: 'number', req: true, half: true }, { k: 'due', label: 'Оплатити до', type: 'date', val: ymd(addD(new Date(), 14)) }], ok: v => A.addInvoice({ client: v.client, amt: num(v.amt), due: v.due }) },
    member: { t: 'Новий учасник', f: [{ k: 'name', label: 'Імʼя', req: true, half: true }, { k: 'role', label: 'Роль', half: true, ph: 'Дизайнер' }], ok: v => A.addMember({ name: v.name, role: v.role }) },
  };
}

const QA: Record<'me' | 'co', [string, string, IconName][]> = {
  me: [['task', 'Задача', 'tasks'], ['out', 'Витрата', 'money'], ['in', 'Дохід', 'money'], ['event', 'Подія', 'schedule'], ['habit', 'Звичка', 'habits'], ['note', 'Нотатка', 'notes']],
  co: [['deal', 'Угода', 'deals'], ['invoice', 'Рахунок', 'invoice'], ['project', 'Проєкт', 'projects'], ['task', 'Задача', 'tasks'], ['event', 'Подія', 'schedule'], ['member', 'Учасник', 'team']],
};

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
        const input = f.type === 'select'
          ? <select id={id} name={f.k} defaultValue={f.val}>{f.opts!.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          : f.type === 'textarea'
            ? <textarea id={id} name={f.k} rows={5} placeholder={f.ph} required={f.req} />
            : <input id={id} name={f.k} type={f.type || 'text'} defaultValue={f.val} placeholder={f.ph} required={f.req} autoComplete="off" {...(f.type === 'number' ? { min: 0, step: 'any', inputMode: 'decimal' as const } : {})} />;
        return <label key={f.k} className="field" htmlFor={id} style={{ flex: f.half ? '1 1 140px' : '1 1 100%' }}>{f.label}{input}</label>;
      })}
      <div className="row" style={{ flex: '1 1 100%', justifyContent: 'flex-end', marginTop: 6 }}>
        <button type="button" className="btn ghost" onClick={close}>Скасувати</button>
        <button className="btn acc">Зберегти</button>
      </div>
    </form>
  );
}

export function SheetHost() {
  const st = useStore();
  const { S, sheet, setSheet, go } = st;
  if (!sheet) return null;
  const close = () => setSheet(null);
  const m = S.mode === 'co' ? 'co' : 'me';
  let title = '', body = null;
  if (sheet.kind === 'qa') {
    title = 'Швидко додати';
    body = (
      <>
        <div className="qa-grid">
          {QA[m].map(([k, l, i]) => (
            <button key={k} onClick={() => {
              setSheet({ kind: 'form', key: k });
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
        <ModeSeg />
        <div className="qa-grid" style={{ marginTop: 14 }}>
          {NAV[m].map(k => { const [, l, i] = vinfo(k)!; return <button key={k} onClick={() => go(k)}><Icon n={i as IconName} className="ic" />{l}</button>; })}
        </div>
      </>
    );
  } else {
    const spec = forms(st)[sheet.key];
    if (!spec) return null;
    title = spec.t;
    body = <FormBody key={sheet.key} spec={spec} close={close} />;
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
