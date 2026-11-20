'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import type { AnelaTalkKind } from '@/lib/types';
import { addD, fmtDate, TK, ymd } from '@/lib/util';
import { Icon } from '../Icon';
import { Empty } from '../shared';
import { NoteCard, PrivateText, TabRow } from '../Private';

type Tab = 'feel' | 'mem' | 'talk' | 'goal';
const TABS = [['feel', 'Мої почуття'], ['mem', 'Спогади'], ['talk', 'Природне спілкування'], ['goal', 'Мої наміри']] as const;
const FEELINGS = ['Радість', 'Сум', 'Хвилювання', 'Тривога', 'Спокій', 'Вдячність'];

/** The private diary of what the person feels. It is only stored. It is not analysed, scored or sent anywhere. */
function Feelings() {
  const { S, A } = useStore();
  const [text, setText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const month = useMemo(() => {
    const from = addD(new Date(), -30).getTime(), c = new Map<string, number>();
    for (const f of S.anela.feelings) if (f.t >= from) for (const t of f.tags) c.set(t, (c.get(t) || 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [S.anela.feelings]);
  return (
    <div className="grid">
      <div className="card s7">
        <div className="ch"><Icon n="notes" className="ic" /><div><h3>Що я відчуваю</h3><p>Для себе. Можна одним реченням</p></div></div>
        <form className="stack" onSubmit={e => { e.preventDefault(); if (A.addFeeling(text, tags)) { setText(''); setTags([]); } }}>
          <label className="field" htmlFor="anF">Думки й почуття<textarea id="anF" rows={4} value={text} placeholder="Що зі мною сьогодні, що радує, засмучує чи хвилює…" onChange={e => setText(e.target.value)} /></label>
          <div className="tagrow" role="group" aria-label="Що з цього близьке">
            {FEELINGS.map(t => <button type="button" key={t} className="tagbtn" aria-pressed={tags.includes(t)} onClick={() => setTags(tags.includes(t) ? tags.filter(x => x !== t) : [...tags, t])}>{t}</button>)}
          </div>
          <button className="btn acc" style={{ alignSelf: 'flex-start' }} disabled={!text.trim()}>Зберегти</button>
        </form>
      </div>
      <div className="card s5">
        <div className="ch"><Icon n="wave" className="ic" /><div><h3>Що траплялося останнім часом</h3><p>За 30 днів, за твоїми позначками</p></div></div>
        {month.length ? <div className="tagrow">{month.map(([t, n]) => <span key={t} className="tagbtn">{t} · {n}</span>)}</div> : <p className="help">Тут зʼявиться, що ти позначаєш найчастіше. Це лише підрахунок твоїх слів, без висновків.</p>}
      </div>
      <div className="card s12">
        <div className="stack">
          {S.anela.feelings.map(f => (
            <NoteCard key={f.id} onDelete={() => A.delFeeling(f.id)} meta={<>{fmtDate(ymd(new Date(f.t)))}{f.tags.map(t => <span key={t}>· {t}</span>)}</>}><p><PrivateText>{f.text}</PrivateText></p></NoteCard>
          ))}
          {!S.anela.feelings.length && <Empty icon="notes" title="Поки порожньо" text="Нічого не обовʼязково. Запиши, коли захочеться." />}
        </div>
      </div>
    </div>
  );
}

/** Good memories, written by the person. Nothing is added by itself and there are no photos: the data is a small text document. */
function Memories() {
  const { S, A } = useStore();
  const [v, setV] = useState({ date: TK(), title: '', text: '', thoughts: '' });
  return (
    <div className="grid">
      <div className="card s5">
        <div className="ch"><Icon n="star" className="ic" /><div><h3>Новий спогад</h3><p>Те, що хочеться зберегти</p></div></div>
        <form className="stack" onSubmit={e => { e.preventDefault(); if (A.addMemory(v)) setV({ date: TK(), title: '', text: '', thoughts: '' }); }}>
          <div className="row">
            <label className="field" htmlFor="mTitle" style={{ flex: '2 1 160px' }}>Назва<input id="mTitle" value={v.title} onChange={e => setV({ ...v, title: e.target.value })} /></label>
            <label className="field" htmlFor="mDate" style={{ flex: '1 1 130px' }}>Дата<input id="mDate" type="date" max={TK()} value={v.date} onChange={e => setV({ ...v, date: e.target.value })} /></label>
          </div>
          <label className="field" htmlFor="mText">Що було<textarea id="mText" rows={3} value={v.text} onChange={e => setV({ ...v, text: e.target.value })} /></label>
          <label className="field" htmlFor="mTh">Мої думки про це<textarea id="mTh" rows={2} value={v.thoughts} onChange={e => setV({ ...v, thoughts: e.target.value })} /></label>
          <button className="btn acc" style={{ alignSelf: 'flex-start' }} disabled={!v.title.trim()}>Зберегти</button>
        </form>
      </div>
      <div className="card s7">
        <div className="stack">
          {S.anela.memories.map(m => (
            <NoteCard key={m.id} onDelete={() => A.delMemory(m.id)} meta={<>{fmtDate(m.date)}<b>{m.title}</b></>}>
              {m.text && <p><PrivateText>{m.text}</PrivateText></p>}
              {m.thoughts && <p className="muted" style={{ marginTop: 6 }}><PrivateText>{m.thoughts}</PrivateText></p>}
            </NoteCard>
          ))}
          {!S.anela.memories.length && <Empty icon="star" title="Спогадів поки немає" text="Вони зʼявляться тут тільки тоді, коли ти їх запишеш." />}
        </div>
      </div>
    </div>
  );
}

const KINDS: [AnelaTalkKind, string, string][] = [
  ['opener', 'Початок розмови', 'Напр. «Як пройшов твій день?»'], ['topic', 'Теми', 'Про що можна поговорити'], ['question', 'Цікаві запитання', 'Що мені справді цікаво дізнатись'],
  ['manner', 'Як я хочу поводитись', 'Напр. слухати й не поспішати'], ['bs', 'Боснійська', 'Слово, фраза, вислів чи жарт'],
];
/** A small starter set of everyday Bosnian, added only when the person asks for it. */
const BS_STARTER: { text: string; extra: string }[] = [
  { text: 'Zdravo!', extra: 'Привіт!' }, { text: 'Kako si?', extra: 'Як ти?' }, { text: 'Dobro sam, hvala. A ti?', extra: 'Добре, дякую. А ти?' },
  { text: 'Drago mi je.', extra: 'Приємно познайомитись.' }, { text: 'Hvala lijepo.', extra: 'Дуже дякую.' }, { text: 'Šta ima?', extra: 'Що нового? (розмовне)' },
  { text: 'Nema problema.', extra: 'Нема проблем.' }, { text: 'Vidimo se.', extra: 'Побачимось.' },
];

/** Preparing for a natural talk. The principles come first; the lists are the person's own. */
function Talk() {
  const { S, A } = useStore();
  const [kind, setKind] = useState<AnelaTalkKind>('opener');
  const [text, setText] = useState(''), [extra, setExtra] = useState('');
  const [drill, setDrill] = useState<{ i: number; show: boolean }>({ i: 0, show: false });
  const bs = S.anela.talk.filter(t => t.kind === 'bs');
  const cur = bs.length ? bs[drill.i % bs.length] : null;
  return (
    <div className="grid">
      <div className="card s12">
        <div className="ch"><Icon n="flag" className="ic" /><div><h3>Як я хочу спілкуватися</h3><p>Нагадування для себе</p></div></div>
        <ul className="principles">
          <li>Бути собою.</li><li>Не маніпулювати й не тиснути.</li><li>Поважати особисті межі.</li><li>Не вигадувати штучних приводів для контакту.</li><li>Не чекати відповіді чи взаємності.</li>
        </ul>
      </div>
      <div className="card s5">
        <div className="ch"><Icon n="plus" className="ic" /><div><h3>Додати</h3><p>Ідея, тема, запитання чи фраза</p></div></div>
        <form className="stack" onSubmit={e => { e.preventDefault(); if (A.addTalk(kind, text, extra)) { setText(''); setExtra(''); } }}>
          <div className="tagrow" role="group" aria-label="Що додати">{KINDS.map(([k, l]) => <button type="button" key={k} className="tagbtn" aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}</div>
          <label className="field" htmlFor="tkT">{kind === 'bs' ? 'Боснійською' : 'Текст'}<input id="tkT" value={text} placeholder={KINDS.find(k => k[0] === kind)![2]} onChange={e => setText(e.target.value)} /></label>
          {kind === 'bs' && <label className="field" htmlFor="tkE">Значення чи жарт<input id="tkE" value={extra} onChange={e => setExtra(e.target.value)} /></label>}
          <button className="btn acc" style={{ alignSelf: 'flex-start' }} disabled={!text.trim()}>Додати</button>
        </form>
        {!bs.length && <button className="btn ghost sm" style={{ marginTop: 14 }} onClick={() => A.addTalkMany(BS_STARTER.map(x => ({ kind: 'bs' as const, ...x })))}>Додати 8 базових боснійських фраз</button>}
        {!bs.length && <p className="help" style={{ marginTop: 6 }}>Це прості повсякденні фрази. Варто перевірити їх у носія мови.</p>}
      </div>
      <div className="card s7">
        {cur && (
          <div className="drill" style={{ marginBottom: 16 }}>
            <small className="muted">Повторення</small>
            <b>{cur.text}</b>
            <div className="tr">{drill.show ? (cur.extra || 'без перекладу') : ''}</div>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn ghost sm" onClick={() => setDrill({ ...drill, show: !drill.show })}>{drill.show ? 'Сховати' : 'Показати значення'}</button>
              <button className="btn ghost sm" onClick={() => setDrill({ i: (drill.i + 1 + Math.floor(Math.random() * Math.max(1, bs.length - 1))) % bs.length, show: false })}>Інша</button>
            </div>
          </div>
        )}
        {KINDS.map(([k, l]) => {
          const list = S.anela.talk.filter(t => t.kind === k);
          return list.length ? (
            <div key={k} style={{ marginBottom: 14 }}>
              <h4 style={{ margin: '0 0 6px', fontWeight: 600 }}>{l}</h4>
              <div className="stack">{list.map(t => <NoteCard key={t.id} onDelete={() => A.delTalk(t.id)} meta={<span>{k === 'bs' ? 'фраза' : ''}</span>}><p>{t.text}{t.extra && <span className="muted"> · {t.extra}</span>}</p></NoteCard>)}</div>
            </div>
          ) : null;
        })}
        {!S.anela.talk.length && <Empty icon="notes" title="Список порожній" text="Тут лише те, що ти додаш сам." />}
      </div>
    </div>
  );
}

const EXAMPLES = ['Спокійніше спілкуватися з дівчатами', 'Не боятися починати розмову', 'Бути хорошим другом', 'Розвивати впевненість', 'Не привʼязувати власне щастя до реакції іншої людини'];
const QUESTIONS: [string, string][] = [
  ['bounds', 'Чи поважаю я її особисті межі?'], ['expect', 'Чи не будую я надто багато очікувань?'],
  ['life', 'Чи продовжую я жити власним життям?'], ['self', 'Чи роблю я щось хороше для себе незалежно від її реакції?'],
];

/** Intentions about the person's own way of being. Never about getting a reaction. */
function Intents() {
  const { S, A } = useStore();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [ans, setAns] = useState<Record<string, 'yes' | 'partly' | 'no'>>({});
  const [note, setNote] = useState('');
  const last = S.anela.checks[0];
  return (
    <div className="grid">
      <div className="card s7">
        <div className="ch"><Icon n="goals" className="ic" /><div><h3>Мої наміри</h3><p>Про мене самого: яким я хочу бути</p></div></div>
        <div className="stack">
          {S.anela.intents.map(i => (
            <div className="note" key={i.id} style={i.paused ? { opacity: 0.6 } : undefined}>
              <p>{i.text}</p>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn ghost sm" onClick={() => A.pauseIntent(i.id, !i.paused)}>{i.paused ? 'Повернути' : 'Відкласти'}</button>
                <button className="btn ghost sm" onClick={() => A.delIntent(i.id)}>Видалити</button>
              </div>
            </div>
          ))}
          {!S.anela.intents.length && <p className="help">Намірів поки немає. Нижче є кілька прикладів, їх можна взяти за основу.</p>}
        </div>
        <form className="row" style={{ marginTop: 14 }} onSubmit={e => { e.preventDefault(); if (A.addIntent(text)) setText(''); }}>
          <label className="field" htmlFor="inT" style={{ flex: '1 1 220px' }}>Новий намір<input id="inT" value={text} onChange={e => setText(e.target.value)} /></label>
          <button className="btn acc" style={{ alignSelf: 'flex-end' }} disabled={!text.trim()}>Додати</button>
        </form>
        <div className="tagrow" style={{ marginTop: 12 }}>{EXAMPLES.map(x => <button key={x} className="tagbtn" onClick={() => setText(x)}>{x}</button>)}</div>
      </div>
      <div className="card s5">
        <div className="ch"><Icon n="check" className="ic" /><div><h3>Запитання для себе</h3><p>За бажанням, не обовʼязково</p></div></div>
        {!open ? (
          <>
            <button className="btn ghost" onClick={() => setOpen(true)}>Відкрити запитання</button>
            {last && <p className="help" style={{ marginTop: 10 }}>Востаннє: {fmtDate(ymd(new Date(last.t)))}</p>}
          </>
        ) : (
          <form onSubmit={e => { e.preventDefault(); if (A.saveCheck(ans, note)) { setOpen(false); setAns({}); setNote(''); } }}>
            {QUESTIONS.map(([k, q]) => (
              <div className="qa-q" key={k}>
                <b>{q}</b>
                <div className="qa-a" role="group" aria-label={q}>
                  {([['yes', 'Так'], ['partly', 'Частково'], ['no', 'Ні']] as const).map(([v, l]) => <button type="button" key={v} aria-pressed={ans[k] === v} onClick={() => { const n = { ...ans }; if (n[k] === v) delete n[k]; else n[k] = v; setAns(n); }}>{l}</button>)}
                </div>
              </div>
            ))}
            <label className="field" htmlFor="ckN" style={{ marginTop: 10 }}>Що я собі скажу<textarea id="ckN" rows={2} value={note} onChange={e => setNote(e.target.value)} /></label>
            <div className="row" style={{ marginTop: 12 }}>
              <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Закрити</button>
              <button className="btn acc" disabled={!Object.keys(ans).length && !note.trim()}>Зберегти</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/** Anela: a private space for what the person feels about someone who matters to them.
    It has no goals about her and no tracking of her. Nothing here is sent to analytics, to AI or to any outside service. */
export function Anela() {
  const [tab, setTab] = useState<Tab>('feel');
  return (
    <section className="view anela">
      <div className="anwrap">
        <h2>Anela</h2>
        <p className="antag">Приватний простір для почуттів і добрих спогадів. Тут немає цілей щодо неї, стеження чи обовʼязкових записів. Нічого не передається стороннім сервісам, аналітиці чи ШІ.</p>
        <TabRow tabs={TABS} value={tab} onChange={setTab} label="Розділи Anela" />
        {tab === 'feel' && <Feelings />}
        {tab === 'mem' && <Memories />}
        {tab === 'talk' && <Talk />}
        {tab === 'goal' && <Intents />}
      </div>
    </section>
  );
}
