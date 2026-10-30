'use client';

import { useEffect, useRef, useState } from 'react';
import type { Note } from '@/lib/types';
import { useStore } from '@/lib/store';
import { hhmm, MON, plural, TK, ymd } from '@/lib/util';
import { Icon } from '../Icon';
import { DelBtn } from '../shared';

/* ---------------- Notes ---------------- */
const noteTitle = (n: Note) => n.title.trim() || n.text.trim().split('\n')[0].slice(0, 60) || 'Без назви';
const noteDate = (t: number) => { const d = new Date(t); return ymd(d) === TK() ? hhmm(d) : `${d.getDate()} ${MON[d.getMonth()].slice(0, 3)}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`; };

/** Editor of one note. Changes are saved after a short pause and when another note is opened. */
function NoteEditor({ note, onBack }: { note: Note; onBack: () => void }) {
  const { A } = useStore();
  const [v, setV] = useState({ title: note.title, text: note.text });
  const [saved, setSaved] = useState('');
  const latest = useRef(v);
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => { A.saveNote(note.id, latest.current); dirty.current = false; setSaved(`Збережено о ${hhmm(new Date())}`); }, 400);
    return () => clearTimeout(t);
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (dirty.current) A.saveNote(note.id, latest.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const change = (p: Partial<typeof v>) => { dirty.current = true; latest.current = { ...v, ...p }; setV(latest.current); };
  return (
    <div className="noteed">
      <div className="row" style={{ gap: 8 }}>
        <button className="btn ghost noteback" onClick={onBack}><Icon n="left" />Усі нотатки</button>
        <span className="muted" style={{ fontSize: 12, marginLeft: 'auto' }}>{saved || `Змінено ${noteDate(note.updated)}`}</span>
        <button className="x" title={note.pinned ? 'Відкріпити' : 'Закріпити вгорі'} aria-pressed={!!note.pinned} aria-label="Закріпити нотатку" style={note.pinned ? { color: 'var(--accent)', opacity: 1 } : undefined} onClick={() => A.pinNote(note.id)}><Icon n="pin" /></button>
        <DelBtn label="Видалити нотатку" onDelete={() => { dirty.current = false; A.delNote(note.id); onBack(); }} />
      </div>
      <input className="notetitle" placeholder="Назва" value={v.title} onChange={e => change({ title: e.target.value })} aria-label="Назва нотатки" />
      <textarea className="notetext" placeholder="Думки, ідеї, конспект…" value={v.text} onChange={e => change({ text: e.target.value })} aria-label="Текст нотатки" autoFocus={!note.text && !note.title} />
    </div>
  );
}

export function Notes() {
  const { S, A } = useStore();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<number | null>(() => (typeof window !== 'undefined' && window.innerWidth > 760 ? S.noteList[0]?.id ?? null : null));
  const ql = q.trim().toLowerCase();
  const list = S.noteList
    .filter(n => !ql || (n.title + '\n' + n.text).toLowerCase().includes(ql))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updated - a.updated);
  const cur = S.noteList.find(n => n.id === sel) || null;
  // a note left empty is dropped when another one is opened
  const open = (id: number | null) => { if (cur && cur.id !== id) { const old = cur.id; setTimeout(() => A.dropEmptyNote(old), 0); } setSel(id); };
  return (
    <section className="view">
      <div className="vh">
        <div><h2>Нотатки</h2><p>{S.noteList.length ? `${S.noteList.length} ${plural(S.noteList.length, 'нотатка', 'нотатки', 'нотаток')}. Зберігаються автоматично.` : 'Зберігаються автоматично.'}</p></div>
        <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => { setQ(''); open(A.addNote('')); }}><Icon n="plus" />Нова нотатка</button>
      </div>
      <div className={`card notesapp${cur ? ' open' : ''}`} style={{ marginTop: 18 }}>
        <div className="notelist">
          <input className="notesearch" type="search" placeholder="Пошук у нотатках" value={q} onChange={e => setQ(e.target.value)} aria-label="Пошук у нотатках" />
          {list.map(n => (
            <button key={n.id} className={`noteitem${n.id === sel ? ' on' : ''}`} onClick={() => open(n.id)}>
              <b>{n.pinned && <Icon n="pin" />}{noteTitle(n)}</b>
              <span className="muted">{noteDate(n.updated)} · {(n.title.trim() ? n.text : n.text.split('\n').slice(1).join(' ')).trim().slice(0, 90) || 'Порожньо'}</span>
            </button>
          ))}
          {!list.length && <p className="muted" style={{ padding: '8px 4px', fontSize: 13 }}>{ql ? 'Нічого не знайдено.' : 'Нотаток поки немає. Натисни «Нова нотатка».'}</p>}
        </div>
        {cur ? <NoteEditor key={cur.id} note={cur} onBack={() => open(null)} /> : <div className="noteempty muted">Вибери нотатку зліва або створи нову.</div>}
      </div>
    </section>
  );
}
