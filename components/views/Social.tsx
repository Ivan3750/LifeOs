'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import type { ExposureKind, SocialNote } from '@/lib/types';
import { fmtDate } from '@/lib/util';
import { Icon } from '../Icon';
import { Empty } from '../shared';
import { NoteCard, TabRow } from '../Private';
import { PeopleBody } from './People';

type Tab = 'people' | 'ideas' | 'talks' | 'exp' | 'step';
const TABS = [['people', 'Люди й місця'], ['ideas', 'Ідеї та плани'], ['talks', 'Розмови й спогади'], ['exp', 'Мій досвід'], ['step', 'Крок назовні']] as const;

/** Notes of one kind (or two), optionally about a person. Plain records: no counts, no targets. */
function Notes({ kinds, title, sub, ph, withPerson = false, plan = false }: { kinds: SocialNote['kind'][]; title: string; sub: string; ph: string; withPerson?: boolean; plan?: boolean }) {
  const { S, A, setSheet } = useStore();
  const [text, setText] = useState('');
  const [kind, setKind] = useState<SocialNote['kind']>(kinds[0]);
  const [person, setPerson] = useState('');
  const list = S.socialNotes.filter(n => kinds.includes(n.kind));
  const name = (id?: number) => S.people.find(p => p.id === id)?.name;
  return (
    <div className="card s12">
      <div className="ch"><Icon n="notes" className="ic" /><div><h3>{title}</h3><p>{sub}</p></div></div>
      <form className="stack" onSubmit={e => { e.preventDefault(); if (A.addSocialNote({ kind, text, person: +person || undefined })) { setText(''); } }}>
        {kinds.length > 1 && (
          <div className="tagrow" role="group" aria-label="Що це">
            {kinds.map(k => <button type="button" key={k} className="tagbtn" aria-pressed={kind === k} onClick={() => setKind(k)}>{k === 'talk' ? 'Розмова' : k === 'memory' ? 'Спогад' : k === 'idea' ? 'Ідея' : 'Досвід'}</button>)}
          </div>
        )}
        <label className="field" htmlFor={'sn' + kinds.join()}>Текст<textarea id={'sn' + kinds.join()} rows={3} value={text} placeholder={ph} onChange={e => setText(e.target.value)} /></label>
        <div className="row">
          {withPerson && S.people.length > 0 && (
            <label className="field" htmlFor={'sp' + kinds.join()} style={{ flex: '1 1 180px' }}>Про кого (необовʼязково)
              <select id={'sp' + kinds.join()} value={person} onChange={e => setPerson(e.target.value)}><option value="">Ні про кого конкретно</option>{S.people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            </label>
          )}
          <button className="btn acc" style={{ marginLeft: 'auto' }} disabled={!text.trim()}><Icon n="plus" className="icn sm" />Записати</button>
        </div>
      </form>
      <div className="stack" style={{ marginTop: 16 }}>
        {list.map(n => (
          <NoteCard key={n.id} onDelete={() => A.delSocialNote(n.id)} meta={<>{fmtDate(n.date)}{kinds.length > 1 && <span>· {n.kind === 'talk' ? 'розмова' : n.kind === 'memory' ? 'спогад' : n.kind === 'idea' ? 'ідея' : 'досвід'}</span>}{name(n.person) && <span>· {name(n.person)}</span>}</>}>
            <p>{n.text}</p>
            {plan && <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => setSheet({ kind: 'form', key: 'event', init: { title: n.text.slice(0, 80) } })}><Icon n="schedule" className="icn sm" />Запланувати в розкладі</button>}
          </NoteCard>
        ))}
        {!list.length && <Empty icon="notes" title="Поки порожньо" text="Нічого не обовʼязково. Запиши, коли захочеш." />}
      </div>
    </div>
  );
}

const STEPS: [ExposureKind, string][] = [['start', 'Почати розмову'], ['ask', 'Поставити запитання'], ['keep', 'Підтримати розмову'], ['meet', 'Познайомитися з новою людиною'], ['invite', 'Запропонувати зустрітися']];
const FELT: [1 | 2 | 3, string][] = [[1, 'Було важко'], [2, 'Нормально'], [3, 'Було легко']];

/** An optional place to practise: one small step at a time. No target, no streak, no daily plan. */
function Steps() {
  const { S, A } = useStore();
  const [kind, setKind] = useState<ExposureKind | null>(null);
  const [note, setNote] = useState('');
  const [felt, setFelt] = useState<1 | 2 | 3 | undefined>();
  return (
    <div className="card s12">
      <div className="ch"><Icon n="user" className="ic" /><div><h3>Крок назовні</h3><p>Необовʼязковий простір для впевненості. Без плану, цілей і серій</p></div></div>
      <div className="tagrow" role="group" aria-label="Який був крок">
        {STEPS.map(([k, l]) => <button key={k} className="tagbtn" aria-pressed={kind === k} onClick={() => setKind(kind === k ? null : k)}>{l}</button>)}
      </div>
      {kind && (
        <form className="stack" style={{ marginTop: 14 }} onSubmit={e => { e.preventDefault(); A.addExposure({ kind, note, felt }); setKind(null); setNote(''); setFelt(undefined); }}>
          <label className="field" htmlFor="exNote">Як це було? (необовʼязково)<textarea id="exNote" rows={2} value={note} placeholder="Кілька слів для себе" onChange={e => setNote(e.target.value)} /></label>
          <div className="tagrow" role="group" aria-label="Як це далося">{FELT.map(([v, l]) => <button type="button" key={v} className="tagbtn" aria-pressed={felt === v} onClick={() => setFelt(felt === v ? undefined : v)}>{l}</button>)}</div>
          <button className="btn acc" style={{ alignSelf: 'flex-start' }}>Записати</button>
        </form>
      )}
      <div className="stack" style={{ marginTop: 16 }}>
        {S.exposure.slice(0, 20).map(x => (
          <NoteCard key={x.id} onDelete={() => A.delExposure(x.id)} meta={<>{fmtDate(x.date)}<span>· {STEPS.find(s => s[0] === x.kind)?.[1]}</span>{x.felt && <span>· {FELT.find(f => f[0] === x.felt)?.[1].toLowerCase()}</span>}</>}>
            {x.note ? <p>{x.note}</p> : <p className="muted">Без нотатки</p>}
          </NoteCard>
        ))}
        {!S.exposure.length && <p className="help">Кожна спроба рахується як досвід, навіть якщо вона не вдалась. Нічого не треба робити щодня.</p>}
      </div>
    </div>
  );
}

/** Social life: people and places (the old «Люди й клуби»), ideas for meetings, conversations and memories, notes on the experience, small steps. */
export function Social() {
  const { S } = useStore();
  const [tab, setTab] = useState<Tab>('people');
  return (
    <section className="view">
      <div className="vh"><div><h2>Соціальне життя</h2><p>Люди, ідеї, спогади й нові знайомства. Цінність людини не вимірюється кількістю контактів</p></div></div>
      <TabRow tabs={TABS} value={tab} onChange={setTab} label="Розділи соціального життя" />
      {tab === 'people' && <PeopleBody />}
      {tab === 'ideas' && <div className="grid"><Notes kinds={['idea']} title="Ідеї для зустрічей" sub="Куди піти, що запропонувати, з ким було б цікаво" ph="Напр. настолки у п'ятницю, прогулянка до моря…" withPerson plan /></div>}
      {tab === 'talks' && <div className="grid"><Notes kinds={['talk', 'memory']} title="Цікаві розмови та спільні спогади" sub="Те, що хочеться зберегти" ph="Про що говорили, що запамʼяталось" withPerson /></div>}
      {tab === 'exp' && <div className="grid"><Notes kinds={['experience']} title="Нотатки про соціальний досвід" sub={S.socialNotes.some(n => n.kind === 'experience') ? 'Що помічаєш у собі й у спілкуванні' : 'Особисте: що вдалось, що було складно, що хочеться спробувати'} ph="Що я помітив у собі сьогодні…" /></div>}
      {tab === 'step' && <div className="grid"><Steps /></div>}
      <p className="help" style={{ marginTop: 14 }}>Тут немає норм і щоденних планів: усе робиться, коли є настрій.</p>
    </section>
  );
}
