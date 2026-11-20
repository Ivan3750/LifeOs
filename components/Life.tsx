'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { areaLabel, daysAway, LAST_SEEN_KEY, LIFE_AREAS, MODE_ORDER, MODES, modeOf, restHint, seasonDaysLeft, seasonEnded, seasonOn, snoozedTasks } from '@/lib/life';
import { fmtDate, plural, TK } from '@/lib/util';
import { Icon } from './Icon';

/** The five rhythms of life as small buttons. Picking one changes what is suggested; it creates nothing. */
export function ModeChips({ compact = false }: { compact?: boolean }) {
  const { S, A } = useStore();
  const m = modeOf(S);
  return (
    <div className="modechips" role="group" aria-label="Режим життя">
      {MODE_ORDER.map(k => <button key={k} aria-pressed={m === k} onClick={() => m !== k && A.setLifeMode(k)}>{MODES[k].label}</button>)}
      {!compact && <p className="help" style={{ flexBasis: '100%', margin: '6px 0 0' }}>{MODES[m].hint}</p>}
    </div>
  );
}

/** The current priorities, or a quiet offer to look at them when the period has ended. */
export function SeasonCard({ cls = 's12' }: { cls?: string }) {
  const { S, A, setSheet } = useStore();
  const k = TK(), cur = seasonOn(S, k), ended = seasonEnded(S, k);
  if (ended) {
    return (
      <div className={`card ${cls} seasoncard`}>
        <div className="ch" style={{ marginBottom: 8 }}><Icon n="flag" className="ic" /><div><h3>Період {fmtDate(ended.from)} – {fmtDate(ended.to)} завершився</h3><p>Можна переглянути пріоритети. Нових цілей я сам не створюю</p></div></div>
        <div className="row">
          <button className="btn acc sm" onClick={() => setSheet({ kind: 'season' })}>Переглянути пріоритети</button>
          <button className="btn ghost sm" onClick={() => A.dismissSeason()}>Лишити як є</button>
        </div>
      </div>
    );
  }
  if (!cur) return null;
  const left = seasonDaysLeft(cur, k);
  return (
    <div className={`card ${cls} seasoncard`}>
      <div className="ch" style={{ marginBottom: 8 }}>
        <Icon n="flag" className="ic" />
        <div><h3>Зараз головне</h3><p>до {fmtDate(cur.to)}{left > 0 ? ` · ${left} ${plural(left, 'день', 'дні', 'днів')}` : ''}</p></div>
        <button className="sel" onClick={() => setSheet({ kind: 'season' })}>Змінити</button>
      </div>
      <div className="seasonrow">
        {cur.main.map(a => <span key={a} className="sbadge main" title={cur.notes[a] || undefined}>{areaLabel(a)}</span>)}
        {cur.support.map(a => <span key={a} className="sbadge" title={cur.notes[a] || undefined}>{areaLabel(a)}</span>)}
      </div>
      {Object.entries(cur.notes).filter(([a]) => cur.main.includes(a) || cur.support.includes(a)).length > 0 && (
        <ul className="seasonnotes">{Object.entries(cur.notes).filter(([a]) => cur.main.includes(a) || cur.support.includes(a)).map(([a, t]) => <li key={a}><b>{areaLabel(a)}:</b> {t}</li>)}</ul>
      )}
    </div>
  );
}

/** The form for the priorities of a period: one to three main directions, any number of supported ones. */
export function SeasonForm({ close }: { close: () => void }) {
  const { S, A } = useStore();
  const k = TK(), cur = S.season;
  const [from, setFrom] = useState(cur && cur.to >= k ? cur.from : k);
  const [to, setTo] = useState(cur && cur.to >= k ? cur.to : '');
  const [main, setMain] = useState<string[]>(cur?.main ?? []);
  const [support, setSupport] = useState<string[]>(cur?.support ?? []);
  const [notes, setNotes] = useState<Record<string, string>>(cur?.notes ?? {});
  const toggle = (key: string, kind: 'main' | 'support') => {
    if (kind === 'main') {
      if (main.includes(key)) setMain(main.filter(x => x !== key));
      else if (main.length < 3) { setMain([...main, key]); setSupport(support.filter(x => x !== key)); }
    } else if (support.includes(key)) setSupport(support.filter(x => x !== key));
    else { setSupport([...support, key]); setMain(main.filter(x => x !== key)); }
  };
  const chosen = [...main, ...support];
  return (
    <form onSubmit={e => { e.preventDefault(); if (A.setSeason({ from, to, main, support, notes })) close(); }}>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <label className="field" htmlFor="seFrom" style={{ flex: '1 1 140px' }}>З<input id="seFrom" type="date" value={from} onChange={e => setFrom(e.target.value)} required /></label>
        <label className="field" htmlFor="seTo" style={{ flex: '1 1 140px' }}>До<input id="seTo" type="date" value={to} min={from} onChange={e => setTo(e.target.value)} required /></label>
      </div>
      <p className="help" style={{ margin: '14px 0 6px' }}><b>Головні</b> (від 1 до 3): що йде першим цього періоду</p>
      <div className="seasonrow">
        {LIFE_AREAS.map(a => <button type="button" key={a.key} className={`sbadge pick${main.includes(a.key) ? ' main on' : ''}`} aria-pressed={main.includes(a.key)} disabled={!main.includes(a.key) && main.length >= 3} onClick={() => toggle(a.key, 'main')}>{a.label}</button>)}
      </div>
      <p className="help" style={{ margin: '14px 0 6px' }}><b>Підтримуваний фон</b>: не зникає, але й не тисне</p>
      <div className="seasonrow">
        {LIFE_AREAS.map(a => <button type="button" key={a.key} className={`sbadge pick${support.includes(a.key) ? ' on' : ''}`} aria-pressed={support.includes(a.key)} onClick={() => toggle(a.key, 'support')}>{a.label}</button>)}
      </div>
      {chosen.length > 0 && (
        <div className="seasonnotes-form">
          <p className="help" style={{ margin: '14px 0 6px' }}>Кілька слів про напрям (необов’язково)</p>
          {chosen.map(a => (
            <label key={a} className="field" htmlFor={'sn' + a}>{areaLabel(a)}
              <input id={'sn' + a} value={notes[a] || ''} maxLength={140} placeholder="Напр. автоматизація та поточні клієнти" onChange={e => setNotes({ ...notes, [a]: e.target.value })} />
            </label>
          ))}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        {cur && <button type="button" className="btn ghost danger" style={{ marginRight: 'auto' }} onClick={() => { A.clearSeason(); close(); }}>Прибрати</button>}
        <button type="button" className="btn ghost" onClick={close}>Скасувати</button>
        <button className="btn acc" disabled={!main.length || !to}>Зберегти</button>
      </div>
      <p className="help" style={{ marginTop: 10 }}>Коли період мине, я лише запропоную переглянути вибір. Нових цілей і задач не створюю.</p>
    </form>
  );
}

/** After a few days away: a warm hello and the way back to today. It never says what was missed. */
export function WelcomeBack() {
  const [away, setAway] = useState<number | null>(null);
  useEffect(() => {
    const today = TK();
    let last: string | null = null;
    try { last = localStorage.getItem(LAST_SEEN_KEY); localStorage.setItem(LAST_SEEN_KEY, today); } catch {}
    const d = daysAway(last, today);
    if (d !== null && d >= 2) setAway(d); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);
  if (away === null) return null;
  return (
    <div className="card s12 welcome">
      <div className="ch" style={{ margin: 0 }}>
        <Icon n="sun" className="ic" />
        <div><h3>З поверненням</h3><p>Усе на місці. Можна почати з цього дня, без оглядки на минуле.</p></div>
        <button className="sel" onClick={() => setAway(null)}>Дякую</button>
      </div>
    </div>
  );
}

/** A suggestion to take the day easier, from what the person wrote down, and the way to put things aside without any penalty. */
export function RestCard({ cls = 's12' }: { cls?: string }) {
  const { S, A } = useStore();
  const k = TK(), hint = restHint(S, k), recovery = modeOf(S) === 'recovery', aside = snoozedTasks(S, k).length;
  if (!hint && !recovery && !aside) return null;
  return (
    <div className={`card ${cls} restcard`}>
      <div className="ch" style={{ marginBottom: 8 }}>
        <Icon n="moon" className="ic" />
        <div><h3>{recovery ? 'Сьогодні без поспіху' : 'Можна полегшити день'}</h3><p>{hint ? hint.why + '. Це лише підказка' : recovery ? 'Необовʼязкове почекає. Це не штраф і не борг' : 'Відкладене повернеться само'}</p></div>
      </div>
      <div className="row">
        {!recovery && hint && <button className="btn acc sm" onClick={() => A.setLifeMode('recovery')}>Режим «Відновлення»</button>}
        <button className="btn ghost sm" onClick={() => A.snoozeOptional(3)}>Відкласти необовʼязкове на 3 дні</button>
        {aside > 0 && <button className="btn ghost sm" onClick={() => A.unsnoozeAll()}>Повернути відкладене ({aside})</button>}
        {recovery && <button className="btn ghost sm" onClick={() => A.setLifeMode('normal')}>Повернутись у звичайний режим</button>}
      </div>
    </div>
  );
}
