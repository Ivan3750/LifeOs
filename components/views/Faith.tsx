'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import type { FaithKind } from '@/lib/types';
import { fmtDate, sod, TK } from '@/lib/util';
import { Icon } from '../Icon';
import { Empty } from '../shared';
import { NoteCard, PrivateText, TabRow } from '../Private';

type Tab = 'thanks' | 'prayer' | 'verse' | 'note';
const TABS = [['thanks', 'Подяка'], ['prayer', 'Молитви'], ['verse', 'Біблійні місця'], ['note', 'Нотатки й висновки']] as const;

/** Places in the Bible to think about: only the reference and the theme. The text itself is read in the person's own Bible. */
export const PASSAGES: [string, string][] = [
  ['Псалом 23', 'Бог як пастир, спокій'], ['Псалом 46', 'Прихисток і сила в тривозі'], ['Псалом 121', 'Звідки приходить допомога'],
  ['Приповісті 3:5–6', 'Довіряти Господу'], ['Ісаї 41:10', 'Не бійся, Я з тобою'], ['Матвія 6:33–34', 'Не журитися про завтрашній день'],
  ['Матвія 11:28–30', 'Спокій для втомлених'], ['Филип’ян 4:6–7', 'Не тривожитись, мир Божий'], ['1 Петра 5:7', 'Покласти журбу на Нього'],
  ['Римлян 12:2', 'Оновлення розуму'], ['Якова 1:5', 'Просити мудрості'], ['Еклезіяста 3:1–8', 'Для всього є свій час'],
];
/** The passage of the day is only a suggestion: it changes with the date and nothing is counted. */
export const passageOf = (k: string) => PASSAGES[Math.floor(sod(new Date(k + 'T00:00')).getTime() / 864e5) % PASSAGES.length];

const LABEL: Record<FaithKind, string> = { prayer: 'молитва', verse: 'біблійне місце', note: 'нотатка', insight: 'висновок', thanks: 'подяка' };

function Entries({ kinds }: { kinds: FaithKind[] }) {
  const { S, A } = useStore();
  const list = S.faith.filter(f => kinds.includes(f.kind));
  return (
    <div className="stack" style={{ marginTop: 16 }}>
      {list.map(f => (
        <NoteCard key={f.id} onDelete={() => A.delFaith(f.id)} meta={<>{fmtDate(f.date)}{kinds.length > 1 && <span>· {LABEL[f.kind]}</span>}{f.ref && <b>{f.ref}</b>}</>}>
          {f.text && <p><PrivateText>{f.text}</PrivateText></p>}
        </NoteCard>
      ))}
      {!list.length && <Empty icon="sun" title="Поки порожньо" text="Нічого не обовʼязково. Тут лише те, що ти запишеш." />}
    </div>
  );
}

function Writer({ kind, title, sub, ph, ref: showRef = false, refInit = '' }: { kind: FaithKind; title: string; sub: string; ph: string; ref?: boolean; refInit?: string }) {
  const { A } = useStore();
  const [text, setText] = useState(''), [ref, setRef] = useState(refInit);
  return (
    <div className="card s12">
      <div className="ch"><Icon n="sun" className="ic" /><div><h3>{title}</h3><p>{sub}</p></div></div>
      <form className="stack" onSubmit={e => { e.preventDefault(); if (A.addFaith({ kind, text, ref: showRef ? ref : undefined })) { setText(''); if (showRef) setRef(''); } }}>
        {showRef && <label className="field" htmlFor={'fr' + kind}>Місце<input id={'fr' + kind} value={ref} onChange={e => setRef(e.target.value)} placeholder="Напр. Псалом 23" /></label>}
        <label className="field" htmlFor={'ft' + kind}>Текст<textarea id={'ft' + kind} rows={4} value={text} placeholder={ph} onChange={e => setText(e.target.value)} /></label>
        <button className="btn acc" style={{ alignSelf: 'flex-start' }} disabled={!text.trim() && !(showRef && ref.trim())}>Зберегти</button>
      </form>
    </div>
  );
}

/** Spiritual life. Short prayers, places in the Bible to think about, notes, conclusions and thanks. No points, no streaks, nothing daily. */
export function Faith() {
  const [tab, setTab] = useState<Tab>('thanks');
  const [pick, setPick] = useState<string>('');
  const today = passageOf(TK());
  return (
    <section className="view">
      <div className="vh"><div><h2>Віра</h2><p>Простір для тиші, подяки й роздумів. Без балів і серій</p></div></div>
      <TabRow tabs={TABS} value={tab} onChange={setTab} label="Розділи віри" />
      {tab === 'thanks' && <div className="grid"><Writer kind="thanks" title="Подяка" sub="За що сьогодні можна подякувати" ph="Напр. за розмову з другом, за тишу ввечері…" /><div className="s12" style={{ gridColumn: 'span 12' }}><Entries kinds={['thanks']} /></div></div>}
      {tab === 'prayer' && <div className="grid"><Writer kind="prayer" title="Коротка молитва" sub="Власними словами" ph="Кілька речень до Бога" /><div style={{ gridColumn: 'span 12' }}><Entries kinds={['prayer']} /></div></div>}
      {tab === 'verse' && (
        <div className="grid">
          <div className="card s12">
            <div className="ch"><Icon n="sun" className="ic" /><div><h3>Місця для роздумів</h3><p>Обери, прочитай у своїй Біблії й запиши, що з цього відгукнулось</p></div></div>
            <p className="help" style={{ marginBottom: 10 }}>Пропозиція на сьогодні: <b>{today[0]}</b> · {today[1]}</p>
            <div className="verselist">
              {PASSAGES.map(([r, t]) => <button key={r} className="versebtn" aria-pressed={pick === r} onClick={() => setPick(pick === r ? '' : r)}><b>{r}</b><small>{t}</small></button>)}
            </div>
          </div>
          <div style={{ gridColumn: 'span 12' }}><Writer key={pick} kind="verse" title="Мій роздум" sub={pick || 'Обери місце вище або впиши своє'} ph="Що я помітив, що це означає для мене сьогодні" ref refInit={pick} /></div>
          <div style={{ gridColumn: 'span 12' }}><Entries kinds={['verse']} /></div>
        </div>
      )}
      {tab === 'note' && <div className="grid"><Writer kind="insight" title="Нотатка чи висновок" sub="Що я зрозумів, чого навчився, що хочу пам'ятати" ph="Особисте духовне спостереження" /><div style={{ gridColumn: 'span 12' }}><Entries kinds={['insight', 'note']} /></div></div>}
    </section>
  );
}
