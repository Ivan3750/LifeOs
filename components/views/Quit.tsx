'use client';

import { useState, type FormEvent } from 'react';
import { useNow, useStore } from '@/lib/store';
import { bestStreak, cleanDays, cravingStats, dayMarks, MILESTONES, nextMilestone, streakDays, streakHours, TOOLS, TRIGGERS } from '@/lib/quit';
import type { BadHabit } from '@/lib/types';
import { DN, hhmm, MON, pctW, plural, weekdayIdx } from '@/lib/util';
import { Icon } from '../Icon';
import { DelBtn, Empty } from '../shared';

/** The big number of a streak: days, or hours during the first day. */
function Streak({ h, now }: { h: BadHabit; now: number }) {
  const d = streakDays(h, now);
  return d > 0 ? <span className="qnum num">{d}<small>{plural(d, 'день', 'дні', 'днів')}</small></span> : <span className="qnum num">{streakHours(h, now)}<small>{plural(streakHours(h, now), 'година', 'години', 'годин')}</small></span>;
}

function HabitCard({ h, now }: { h: BadHabit; now: number }) {
  const { A, setSheet } = useStore();
  const d = streakDays(h, now), next = nextMilestone(d), marks = dayMarks(h, 14, new Date(now));
  const best = bestStreak(h, now), reached = MILESTONES.filter(m => m <= best);
  return (
    <div className="card qcard cardcol">
      <div className="qhead">
        <div style={{ minWidth: 0 }}><b className="qname">{h.name}</b><span className="muted qsub">{h.slips.length ? `Зривів: ${h.slips.length}` : 'Без жодного зриву'}</span></div>
        <DelBtn label="Видалити звичку" onDelete={() => A.delBad(h.id)} />
      </div>
      <div className="qmain"><Streak h={h} now={now} /><span className="muted">без зривів</span></div>
      <div className="qdays" aria-label="Останні 14 днів">{marks.map(m => <i key={m.k} className={m.mark} title={`${m.k}: ${m.mark === 'ok' ? 'чисто' : m.mark === 'slip' ? 'зрив' : 'до початку'}`} />)}</div>
      {next && (
        <div>
          <div className="bar"><i style={{ width: pctW(d - next.from, next.target - next.from) + '%', background: 'var(--good)' }} /></div>
          <p className="help" style={{ margin: '6px 0 0' }}>До {next.target} {plural(next.target, 'дня', 'днів', 'днів')} лишилось {next.left} {plural(next.left, 'день', 'дні', 'днів')}</p>
        </div>
      )}
      <div className="kv k3">
        <div><span className="k">Найкраща</span><span className="v num">{best}<small>дн</small></span></div>
        <div><span className="k">Чистих днів</span><span className="v num">{cleanDays(h, now)}</span></div>
        <div><span className="k">Від</span><span className="v num" style={{ fontSize: 15 }}>{new Date(h.start).getDate()} {MON[new Date(h.start).getMonth()].slice(0, 3)}</span></div>
      </div>
      {reached.length > 0 && <div className="tags small">{reached.map(m => <span key={m}>{m} дн ✓</span>)}</div>}
      <div className="row">
        <button className="btn acc" onClick={() => setSheet({ kind: 'sos', habit: h.id })}><Icon n="alert" />Потяг: SOS</button>
        <button className="btn ghost danger" onClick={() => { if (window.confirm('Записати зрив? Серія перезапуститься, але найкраща серія й усі чисті дні збережуться.')) A.slipBad(h.id); }}>Зірвався</button>
      </div>
    </div>
  );
}

/** Trigger Tracker: tap the reason of a craving and whether it was held; below, what sets cravings off and when. */
function Triggers() {
  const { S, A, go } = useStore();
  const now = useNow(60_000);
  const [hid, setHid] = useState<number | undefined>(undefined);
  const [trigger, setTrigger] = useState('');
  const habit = hid ?? S.badHabits[0]?.id;
  const st = cravingStats(S, 30, now), last = [...S.cravings].sort((a, b) => b.t - a.t).slice(0, 8);
  const log = (outcome: 'resisted' | 'slipped') => { if (habit === undefined || !trigger) return; if (outcome === 'slipped') A.slipBad(habit, trigger); else A.logCraving(habit, trigger, 'resisted'); setTrigger(''); };
  const max = Math.max(1, ...Object.values(st.by).map(x => x.n));
  const nameOf = (id: number) => S.badHabits.find(h => h.id === id)?.name || '—';
  return (
    <div className="card cardcol">
      <div className="ch" style={{ margin: 0 }}><Icon n="map" className="ic" /><div><h3>Що запускає потяг</h3><p>Відміть причину одним натисканням: так видно, на що саме реагує голова</p></div></div>
      {S.badHabits.length > 1 && <div className="tags" role="group" aria-label="Звичка">{S.badHabits.map(h => <button key={h.id} type="button" aria-pressed={h.id === habit} onClick={() => setHid(h.id)}>{h.name}</button>)}</div>}
      <div className="tags" role="group" aria-label="Причина потягу">{TRIGGERS.map(t => <button key={t} type="button" aria-pressed={trigger === t} onClick={() => setTrigger(trigger === t ? '' : t)}>{t}</button>)}</div>
      <div className="row">
        <button className="btn acc" disabled={!trigger || habit === undefined} onClick={() => log('resisted')}>Потяг був, витримав</button>
        <button className="btn ghost danger" disabled={!trigger || habit === undefined} onClick={() => log('slipped')}>Зірвався</button>
      </div>
      {st.total > 0 ? (
        <>
          <div className="kv k3">
            <div><span className="k">Потягів за 30 днів</span><span className="v num">{st.total}</span></div>
            <div><span className="k">Витримав</span><span className="v num">{Math.round((st.rate ?? 0) * 100)}<small>%</small></span></div>
            <div><span className="k">Найчастіше</span><span className="v" style={{ fontSize: 17 }}>{st.top ?? '—'}</span></div>
          </div>
          <div className="cats">{Object.entries(st.by).sort((a, b) => b[1].n - a[1].n).map(([t, x]) => <div className="catrow" key={t}><span>{t}</span><div className="bar"><i style={{ width: pctW(x.n, max) + '%' }} /></div><span className="num" style={{ textAlign: 'right' }}>{x.n}{x.held < x.n ? ` · зрив ${x.n - x.held}` : ''}</span></div>)}</div>
          {st.peak >= 0 && <p className="help" style={{ margin: 0 }}>Потяги найчастіше бувають о <b>{String(st.peak).padStart(2, '0')}:00</b>. Заплануй на цей час щось інше: прогулянку, дзвінок, душ. <button className="linkbtn" onClick={() => go('prefs')}>Налаштувати нагадування</button></p>}
          <div className="list">
            {last.map(c => { const d = new Date(c.t); return (
              <div className="item" key={c.id}>
                <span className="sw" style={{ background: c.outcome === 'resisted' ? 'var(--good)' : 'var(--m1)' }} />
                <span className="t">{nameOf(c.habit)} · {c.trigger.toLowerCase()}<span className="muted"> · {c.outcome === 'resisted' ? 'витримав' : 'зрив'}{c.tool && `, ${TOOLS[c.tool]?.toLowerCase()}`}</span></span>
                <span className="muted num" style={{ fontSize: 12 }}>{DN[weekdayIdx(d)]} {d.getDate()} · {hhmm(d)}</span>
                <DelBtn label="Видалити запис" onDelete={() => A.delCraving(c.id)} />
              </div>); })}
          </div>
        </>
      ) : <p className="help" style={{ margin: 0 }}>Записів поки немає. Після першого потягу зʼявиться статистика причин і часу доби.</p>}
    </div>
  );
}

export function QuitPage() {
  const { S, A, setSheet } = useStore();
  const now = useNow(60_000);
  const [name, setName] = useState('');
  const add = (e: FormEvent) => { e.preventDefault(); if (A.addBad(name)) setName(''); };
  return (
    <section className="view">
      <div className="vh"><div><h2>Відмова від звичок</h2><p>Лічильник днів без зривів. Зрив перезапускає серію, але найкращий результат і чисті дні не втрачаються.</p></div></div>

      <div className="card sosbanner">
        <div><b>Сильний потяг просто зараз?</b><p>Натисни кнопку: вправи, дихання або гра на 2 хвилини, а потім відміть, як минуло.</p></div>
        <button className="sosbtn" onClick={() => setSheet({ kind: 'sos' })}><Icon n="alert" />SOS</button>
      </div>

      <div className="card cardcol">
        <form className="addrow" onSubmit={add}>
          <input aria-label="Звичка, від якої відмовляєшся" value={name} onChange={e => setName(e.target.value)} placeholder="Від чого відмовляєшся? напр. «Куріння», «Солодке», «Скрол перед сном»" autoComplete="off" />
          <button className="btn acc" disabled={!name.trim()}>Почати рахувати</button>
        </form>
      </div>

      {S.badHabits.length ? <div className="grid">{S.badHabits.map(h => <div key={h.id} className="s6 qwrap"><HabitCard h={h} now={now} /></div>)}</div>
        : <div className="card"><Empty icon="flame" title="Поки нічого не відстежується" text="Додай звичку, від якої хочеш відмовитись. Лічильник стартує одразу, а SOS-кнопка допоможе пережити сильний потяг." /></div>}

      {S.badHabits.length > 0 && <Triggers />}
    </section>
  );
}
