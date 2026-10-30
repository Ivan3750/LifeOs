'use client';

import { useEffect, useRef, type FormEvent } from 'react';
import { NAV, useStore, vinfo, type Store } from '@/lib/store';
import type { AccId } from '@/lib/types';
import type { LeadStatus } from '@/lib/types';
import { parseTask } from '@/lib/tasks';
import { AD_CHANNELS, addD, CATS, COLORS, LEAD_SOURCES, LEAD_STATUS, STAGES, TK, ymd } from '@/lib/util';
import { Icon, type IconName } from './Icon';
import { ModeSeg } from './Shell';

type Field = { k: string; label: string; type?: 'text' | 'number' | 'date' | 'time' | 'select' | 'textarea' | 'hidden'; req?: boolean; half?: boolean; ph?: string; val?: string; opts?: readonly (readonly [string, string])[] };
/** del: shown as a two-click «Видалити» button in edit forms. */
type FormSpec = { t: string; f: Field[]; ok: (v: Record<string, string>) => void | boolean; del?: (v: Record<string, string>) => void };

function forms(st: Store): Record<string, FormSpec> {
  const { A } = st;
  const num = (v: string) => +v.replace(',', '.') || 0;
  return {
    task: { t: 'Нова задача', f: [{ k: 'text', label: 'Що зробити', req: true, ph: 'Напр. Подзвонити клієнту завтра !' }, { k: 'pri', label: 'Пріоритет', type: 'select', half: true, opts: [['lo', 'Звичайно'], ['hi', 'Важливо']], val: 'lo' }, { k: 'due', label: 'Термін', type: 'date', half: true }], ok: v => { const q = parseTask(v.text); A.addTask(q.t, v.pri === 'hi' ? 'hi' : q.p, undefined, v.due || q.due); } },
    out: { t: 'Нова витрата', f: [{ k: 'acc', label: 'Рахунок', type: 'select', opts: [['dk', 'Данський · kr.'], ['ua', 'Український · ₴']], val: 'dk' }, { k: 'amt', label: 'Сума', type: 'number', req: true, half: true, ph: '120' }, { k: 'cat', label: 'Категорія', type: 'select', half: true, opts: CATS.out.map(c => [c, c] as const) }, { k: 'note', label: 'Коментар', ph: 'Кава з друзями' }, { k: 'date', label: 'Дата', type: 'date', val: TK() }], ok: v => A.addTx('out', num(v.amt), v.cat, v.note, v.date || TK(), v.acc as AccId) },
    in: { t: 'Новий дохід', f: [{ k: 'acc', label: 'Рахунок', type: 'select', opts: [['dk', 'Данський · kr.'], ['ua', 'Український · ₴']], val: 'dk' }, { k: 'amt', label: 'Сума', type: 'number', req: true, half: true, ph: '5000' }, { k: 'cat', label: 'Категорія', type: 'select', half: true, opts: CATS.in.map(c => [c, c] as const) }, { k: 'note', label: 'Коментар', ph: 'Звідки гроші' }, { k: 'date', label: 'Дата', type: 'date', val: TK() }], ok: v => A.addTx('in', num(v.amt), v.cat, v.note, v.date || TK(), v.acc as AccId) },
    event: { t: 'Нова подія', f: [{ k: 'title', label: 'Назва', req: true, ph: 'Зустріч, лекція, спорт…' }, { k: 'date', label: 'Дата', type: 'date', val: TK(), half: true }, { k: 'c', label: 'Колір', type: 'select', opts: COLORS, half: true }, { k: 's', label: 'Початок', type: 'time', val: '10:00', half: true }, { k: 'e', label: 'Кінець', type: 'time', val: '11:00', half: true }], ok: v => A.addEvent({ title: v.title, date: v.date || TK(), s: v.s, e: v.e, c: v.c }) },
    lead: { t: 'Новий лід', f: [{ k: 'name', label: 'Хто / яка компанія', req: true, ph: 'Кавʼярня «Zorya»' }, { k: 'contact', label: 'Контакт', half: true, ph: '@нік, телефон або email' }, { k: 'source', label: 'Звідки', type: 'select', half: true, opts: LEAD_SOURCES.map(c => [c, c] as const) }, { k: 'value', label: 'Можлива сума, kr.', type: 'number', half: true, ph: '20000' }, { k: 'next', label: 'Звʼязатися', type: 'date', half: true, val: ymd(addD(new Date(), 2)) }, { k: 'note', label: 'Нотатка', ph: 'Що обіцяв, про що говорили' }], ok: v => A.addLead({ name: v.name, contact: v.contact, source: v.source, value: num(v.value), next: v.next, note: v.note }) },
    ad: { t: 'Витрата на рекламу', f: [{ k: 'channel', label: 'Канал', type: 'select', half: true, opts: AD_CHANNELS.map(c => [c, c] as const) }, { k: 'amt', label: 'Сума, kr.', type: 'number', req: true, half: true, ph: '1500' }, { k: 'date', label: 'Дата', type: 'date', val: TK(), half: true }, { k: 'note', label: 'Що рекламував', half: true, ph: 'Таргет, Reels…' }], ok: v => A.addAd({ date: v.date || TK(), channel: v.channel, amt: num(v.amt), note: v.note }) },
    client: { t: 'Новий клієнт', f: [{ k: 'name', label: 'Хто / яка компанія', req: true, ph: 'Кавʼярня «Zorya»' }, { k: 'contact', label: 'Контакт', half: true, ph: '@zorya, email чи телефон' }, { k: 'source', label: 'Звідки прийшов', type: 'select', half: true, opts: LEAD_SOURCES.map(c => [c, c] as const) }, { k: 'note', label: 'Нотатка', ph: 'Що важливо памʼятати про клієнта' }], ok: v => A.addClient({ name: v.name, contact: v.contact, source: v.source, note: v.note }) },
    habit: { t: 'Нова звичка', f: [{ k: 'name', label: 'Звичка', req: true, ph: '10 хвилин медитації' }], ok: v => A.addHabit(v.name) },
    note: { t: 'Швидка нотатка', f: [{ k: 'text', label: 'Текст', type: 'textarea', req: true, ph: 'Ідея, думка, список…' }], ok: v => { A.addNote(v.text); } },
    deal: { t: 'Нова угода', f: [{ k: 'title', label: 'Що продаємо', req: true, ph: 'Сайт для кавʼярні' }, { k: 'client', label: 'Клієнт', half: true, ph: 'Назва компанії' }, { k: 'amt', label: 'Сума, kr.', type: 'number', half: true, ph: '40000' }, { k: 'stage', label: 'Етап', type: 'select', opts: STAGES, val: 'lead' }], ok: v => A.addDeal({ title: v.title, client: v.client, amt: num(v.amt), stage: v.stage }) },
    project: { t: 'Новий проєкт', f: [{ k: 'name', label: 'Назва', req: true, ph: 'Редизайн сайту' }, { k: 'client', label: 'Клієнт', half: true }, { k: 'budget', label: 'Бюджет, kr.', type: 'number', half: true }, { k: 'due', label: 'Дедлайн', type: 'date', val: ymd(addD(new Date(), 30)) }], ok: v => A.addProject({ name: v.name, client: v.client, budget: num(v.budget), due: v.due }) },
    invoice: { t: 'Новий рахунок', f: [{ k: 'client', label: 'Клієнт', req: true, half: true }, { k: 'amt', label: 'Сума, kr.', type: 'number', req: true, half: true }, { k: 'due', label: 'Оплатити до', type: 'date', val: ymd(addD(new Date(), 14)) }], ok: v => A.addInvoice({ client: v.client, amt: num(v.amt), due: v.due }) },
    member: { t: 'Новий учасник', f: [{ k: 'name', label: 'Імʼя', req: true, half: true }, { k: 'role', label: 'Роль', half: true, ph: 'Дизайнер' }], ok: v => A.addMember({ name: v.name, role: v.role }) },
    editTask: { t: 'Змінити задачу', f: [{ k: 'id', label: '', type: 'hidden' }, { k: 'text', label: 'Що зробити', req: true }, { k: 'pri', label: 'Пріоритет', type: 'select', opts: [['lo', 'Звичайно'], ['hi', 'Важливо']], half: true }, { k: 'due', label: 'Термін', type: 'date', half: true }, { k: 'goal', label: 'Для цілі', type: 'select', half: true, opts: [['', 'Без цілі'], ...st.S.goals.map(g => [String(g.id), g.title] as const)] }], ok: v => A.updateTask(+v.id, { t: v.text, p: v.pri as 'hi' | 'lo', goal: +v.goal || undefined, due: v.due || undefined }), del: v => A.delTask(+v.id) },
    editEvent: { t: 'Змінити подію', f: [{ k: 'id', label: '', type: 'hidden' }, { k: 'title', label: 'Назва', req: true }, { k: 'date', label: 'Дата', type: 'date', half: true }, { k: 'c', label: 'Колір', type: 'select', opts: COLORS, half: true }, { k: 's', label: 'Початок', type: 'time', half: true }, { k: 'e', label: 'Кінець', type: 'time', half: true }], ok: v => A.updateEvent(+v.id, { title: v.title, date: v.date || TK(), s: v.s, e: v.e, c: v.c }), del: v => A.delEvent(+v.id) },
    editClient: { t: 'Змінити клієнта', f: [{ k: 'id', label: '', type: 'hidden' }, { k: 'name', label: 'Хто / яка компанія', req: true }, { k: 'contact', label: 'Контакт', half: true }, { k: 'source', label: 'Звідки прийшов', type: 'select', half: true, opts: LEAD_SOURCES.map(c => [c, c] as const) }, { k: 'note', label: 'Нотатка' }], ok: v => A.updateClient(+v.id, { name: v.name, contact: v.contact, source: v.source, note: v.note }), del: v => A.delClient(+v.id) },
    editHabit: { t: 'Змінити звичку', f: [{ k: 'id', label: '', type: 'hidden' }, { k: 'name', label: 'Звичка', req: true }], ok: v => A.renameHabit(+v.id, v.name), del: v => A.delHabit(+v.id) },
    editDeal: { t: 'Змінити угоду', f: [{ k: 'id', label: '', type: 'hidden' }, { k: 'title', label: 'Що продаємо', req: true }, { k: 'client', label: 'Клієнт', half: true }, { k: 'amt', label: 'Сума, kr.', type: 'number', half: true }, { k: 'stage', label: 'Етап', type: 'select', opts: [...STAGES, ['lost', 'Програно'] as const] }], ok: v => A.updateDeal(+v.id, { title: v.title, client: v.client, amt: num(v.amt), stage: v.stage as 'lead' }), del: v => A.delDeal(+v.id) },
    editProject: { t: 'Змінити проєкт', f: [{ k: 'id', label: '', type: 'hidden' }, { k: 'name', label: 'Назва', req: true }, { k: 'client', label: 'Клієнт', half: true }, { k: 'budget', label: 'Бюджет, kr.', type: 'number', half: true }, { k: 'due', label: 'Дедлайн', type: 'date' }], ok: v => A.updateProject(+v.id, { name: v.name, client: v.client, budget: num(v.budget), due: v.due }), del: v => A.delProject(+v.id) },
    editInvoice: { t: 'Змінити рахунок', f: [{ k: 'id', label: '', type: 'hidden' }, { k: 'client', label: 'Клієнт', req: true, half: true }, { k: 'amt', label: 'Сума, kr.', type: 'number', req: true, half: true }, { k: 'due', label: 'Оплатити до', type: 'date' }], ok: v => A.updateInvoice(+v.id, { client: v.client, amt: num(v.amt), due: v.due }), del: v => A.delInvoice(+v.id) },
    editMember: { t: 'Змінити учасника', f: [{ k: 'id', label: '', type: 'hidden' }, { k: 'name', label: 'Імʼя', req: true, half: true }, { k: 'role', label: 'Роль', half: true }], ok: v => A.updateMember(+v.id, { name: v.name, role: v.role }), del: v => A.delMember(+v.id) },
    editLead: { t: 'Змінити клієнта', f: [{ k: 'id', label: '', type: 'hidden' }, { k: 'name', label: 'Хто / яка компанія', req: true }, { k: 'contact', label: 'Контакт', half: true }, { k: 'source', label: 'Звідки', type: 'select', half: true, opts: LEAD_SOURCES.map(c => [c, c] as const) }, { k: 'status', label: 'Статус', type: 'select', half: true, opts: LEAD_STATUS }, { k: 'value', label: 'Можлива сума, kr.', type: 'number', half: true }, { k: 'next', label: 'Звʼязатися', type: 'date' }, { k: 'note', label: 'Нотатка', type: 'textarea' }], ok: v => A.updateLead(+v.id, { name: v.name, contact: v.contact, source: v.source, status: v.status as LeadStatus, value: num(v.value), next: v.next, note: v.note }), del: v => A.delLead(+v.id) },
    editAd: { t: 'Змінити витрату на рекламу', f: [{ k: 'id', label: '', type: 'hidden' }, { k: 'channel', label: 'Канал', type: 'select', half: true, opts: AD_CHANNELS.map(c => [c, c] as const) }, { k: 'amt', label: 'Сума, kr.', type: 'number', req: true, half: true }, { k: 'date', label: 'Дата', type: 'date', half: true }, { k: 'note', label: 'Що рекламував', half: true }], ok: v => A.updateAd(+v.id, { date: v.date, channel: v.channel, amt: num(v.amt), note: v.note }), del: v => A.delAd(+v.id) },
  };
}

const QA: Record<'me' | 'co', [string, string, IconName][]> = {
  me: [['task', 'Задача', 'tasks'], ['out', 'Витрата', 'money'], ['in', 'Дохід', 'money'], ['event', 'Подія', 'schedule'], ['habit', 'Звичка', 'habits'], ['note', 'Нотатка', 'notes']],
  co: [['lead', 'Лід', 'leads'], ['client', 'Клієнт', 'user'], ['ad', 'Реклама', 'ads'], ['deal', 'Угода', 'deals'], ['invoice', 'Рахунок', 'invoice'], ['project', 'Проєкт', 'projects'], ['task', 'Задача', 'tasks'], ['event', 'Подія', 'schedule'], ['member', 'Учасник', 'team']],
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
