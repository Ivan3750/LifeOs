'use client';

import { useRef, useState, type FormEvent } from 'react';
import type { MoodEntry } from '@/lib/types';
import { dayMood, moveGoal, waterGoal, ENERGY3, energyLevel, energyWord, MOOD_TAGS, moodColor, moodsOn, moodWord } from '@/lib/score';
import { useNow, useStore } from '@/lib/store';
import { addD, DAY, DN, hhmm, MON, pad2, plural, TK, toMin, WD, wStart, ymd } from '@/lib/util';
import { Bars } from '../charts';
import { avg, DelBtn, LifeTiles } from '../shared';

/** New mood check-in, or editing an existing one when `edit` is given. */
function MoodForm({ edit, onDone }: { edit?: MoodEntry | null; onDone?: () => void }) {
  const { S, A } = useStore();
  const blank = () => ({ date: TK(), time: hhmm(new Date()), v: 7, energy: 3, tags: [] as string[], note: '' });
  const [m, setM] = useState(() => (edit ? { date: ymd(new Date(edit.t)), time: hhmm(new Date(edit.t)), v: edit.v, energy: edit.energy, tags: [...edit.tags], note: edit.note } : blank()));
  const [custom, setCustom] = useState('');
  // own tags used before come back as buttons
  const ownTags = [...new Set(S.moods.flatMap(x => x.tags))].filter(t => !MOOD_TAGS.includes(t));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = { t: new Date(`${m.date}T${m.time || '12:00'}`).getTime(), v: m.v, energy: m.energy, tags: m.tags, note: m.note };
    if (edit) { A.updateMood(edit.id, v); onDone?.(); } else { A.addMood(v); setM(blank()); }
  };
  const toggleTag = (t: string) => setM({ ...m, tags: m.tags.includes(t) ? m.tags.filter(x => x !== t) : [...m.tags, t] });
  const addCustom = () => { const t = custom.trim(); if (t && !m.tags.includes(t)) setM({ ...m, tags: [...m.tags, t] }); setCustom(''); };
  return (
    <form className="moodform" onSubmit={submit}>
      <div className="row">
        <label className="field" htmlFor="mdDate" style={{ flex: 1 }}>Дата<input id="mdDate" type="date" value={m.date} max={TK()} onChange={e => setM({ ...m, date: e.target.value })} /></label>
        <label className="field" htmlFor="mdTime" style={{ flex: 1 }}>Час<input id="mdTime" type="time" value={m.time} onChange={e => setM({ ...m, time: e.target.value })} /></label>
      </div>
      <div className="field">
        <div className="row" style={{ justifyContent: 'space-between' }}><span>Настрій</span><b className="num" style={{ color: moodColor(m.v) }}>{m.v}/10 · {moodWord(m.v)}</b></div>
        <div className="scale10">
          {[...Array(10)].map((_, i) => <button type="button" key={i} aria-pressed={m.v === i + 1} aria-label={`Настрій ${i + 1} з 10`} style={{ ['--mc' as string]: moodColor(i + 1) }} onClick={() => setM({ ...m, v: i + 1 })}>{i + 1}</button>)}
        </div>
      </div>
      <div className="field">
        <span>Скільки в тебе сил зараз? <em className="opt">необовʼязково</em></span>
        <div className="energy3">
          {ENERGY3.map(x => {
            const on = energyLevel(m.energy) === energyLevel(x.v);
            return <button type="button" key={x.v} aria-pressed={on} onClick={() => setM({ ...m, energy: on ? 0 : x.v })}><b>{x.l}</b><small>{x.hint}</small></button>;
          })}
        </div>
      </div>
      <div className="field">
        <span>Що відчуваєш</span>
        <div className="tags">
          {[...MOOD_TAGS, ...ownTags, ...m.tags.filter(t => !MOOD_TAGS.includes(t) && !ownTags.includes(t))].map(t => <button type="button" key={t} aria-pressed={m.tags.includes(t)} onClick={() => toggleTag(t)}>{t}</button>)}
          <input className="tagin" value={custom} placeholder="+ свій тег" aria-label="Додати свій тег" onChange={e => setCustom(e.target.value)} onBlur={addCustom}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} />
        </div>
      </div>
      <label className="field" htmlFor="mdNote">Що сталося, про що думаєш
        <textarea id="mdNote" rows={3} placeholder="Необовʼязково: що вплинуло на настрій" value={m.note} onChange={e => setM({ ...m, note: e.target.value })} />
      </label>
      <div className="row">
        <button className="btn acc">{edit ? 'Зберегти зміни' : 'Записати настрій'}</button>
        {edit && <button type="button" className="btn ghost" onClick={onDone}>Скасувати</button>}
      </div>
    </form>
  );
}

/** Mood check-ins of one day as dots on a 24-hour line. */
function MoodDay({ k }: { k: string }) {
  const { S } = useStore();
  const list = moodsOn(S, k), W = 720, H = 150, P = 20, x = (t: number) => P + ((W - 2 * P) * (new Date(t).getHours() * 60 + new Date(t).getMinutes())) / 1440, y = (v: number) => H - 22 - ((H - 40) * (v - 1)) / 9;
  if (!list.length) return null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {[0, 6, 12, 18, 24].map(h => <g key={h}><line x1={P + ((W - 2 * P) * h) / 24} x2={P + ((W - 2 * P) * h) / 24} y1="8" y2={H - 20} stroke="var(--line)" /><text className="chart-text" x={P + ((W - 2 * P) * h) / 24} y={H - 6} textAnchor="middle">{pad2(h % 24)}:00</text></g>)}
      {list.length > 1 && <polyline fill="none" stroke="var(--muted)" strokeWidth="1.5" opacity=".5" points={list.map(m => `${x(m.t).toFixed(1)},${y(m.v).toFixed(1)}`).join(' ')} />}
      {list.map(m => <circle key={m.id} cx={x(m.t)} cy={y(m.v)} r="6" fill={moodColor(m.v)}><title>{`${hhmm(new Date(m.t))} · ${m.v}/10${m.tags.length ? ' · ' + m.tags.join(', ') : ''}`}</title></circle>)}
    </svg>
  );
}

function MoodLog({ k, setK, onEdit }: { k: string; setK: (k: string) => void; onEdit: (m: MoodEntry) => void }) {
  const { S, A } = useStore();
  const list = [...moodsOn(S, k)].reverse(), dt = new Date(k + 'T00:00'), avgV = dayMood(S, k);
  return (
    <>
      <div className="ch">
        <div><h3>{k === TK() ? 'Сьогодні' : `${WD[dt.getDay()]}, ${dt.getDate()} ${MON[dt.getMonth()]}`}</h3><p>{list.length ? `${list.length} ${plural(list.length, 'запис', 'записи', 'записів')} · в середньому ${avgV.toFixed(1)}/10` : 'Записів настрою немає'}</p></div>
        <div className="row" style={{ marginLeft: 'auto', gap: 6 }}>
          <button className="btn ghost cal-nav" aria-label="Попередній день" onClick={() => setK(ymd(addD(dt, -1)))}>‹</button>
          <button className="btn ghost cal-nav" aria-label="Наступний день" disabled={k >= TK()} onClick={() => setK(ymd(addD(dt, 1)))}>›</button>
        </div>
      </div>
      <MoodDay k={k} />
      <div className="list">
        {list.map(m => (
          <div className="item" key={m.id} style={{ alignItems: 'flex-start' }}>
            <span className="moodval num" style={{ background: moodColor(m.v) }}>{m.v}</span>
            <div className="t">
              <div><b className="num">{hhmm(new Date(m.t))}</b> · {moodWord(m.v)}{m.energy > 0 && <span className="muted"> · {energyWord(m.energy).toLowerCase()}</span>}</div>
              {m.tags.length > 0 && <div className="tags small">{m.tags.map(t => <span key={t}>{t}</span>)}</div>}
              {m.note && <div className="muted" style={{ fontSize: 13, marginTop: 4, whiteSpace: 'pre-wrap' }}>{m.note}</div>}
            </div>
            <button className="sqb" onClick={() => onEdit(m)} aria-label="Змінити запис настрою">Змінити</button>
            <DelBtn label="Видалити запис настрою" onDelete={() => A.delMood(m.id)} />
          </div>
        ))}
      </div>
    </>
  );
}

/** Five weeks of daily mood as coloured cells; a tap opens that day in the log. */
function MoodMonth({ k, setK }: { k: string; setK: (k: string) => void }) {
  const { S } = useStore();
  const today = TK(), start = addD(wStart(), -28);
  const days = [...Array(35)].map((_, i) => ymd(addD(start, i)));
  return (
    <>
      <div className="ch"><div><h3>Настрій за 5 тижнів</h3><p>Колір = середній настрій дня. Натисни на день, щоб відкрити записи.</p></div></div>
      <div className="moodcal">
        {DN.map(d => <span key={d}>{d}</span>)}
        {days.map(d => {
          const v = dayMood(S, d), dt = new Date(d + 'T00:00'), future = d > today;
          return (
            <button key={d} disabled={future} aria-pressed={d === k} className={d === today ? 'today' : ''} style={{ background: v ? moodColor(v) : undefined, color: v ? '#fff' : undefined }}
              title={`${dt.getDate()} ${MON[dt.getMonth()]}: ${v ? v.toFixed(1) + '/10' : 'не відмічено'}`} onClick={() => setK(d)}>
              {dt.getDate()}
            </button>
          );
        })}
      </div>
      <div className="moodlegend">{[2, 4, 6, 8, 10].map(v => <span key={v}><i style={{ background: moodColor(v) }} />{moodWord(v)}</span>)}</div>
    </>
  );
}

/** Patterns from the last 30 days: trend, time of day, tags and energy. */
function MoodInsights() {
  const { S } = useStore();
  const now = useNow(60_000);
  const since = now - 30 * DAY, list = S.moods.filter(m => m.t >= since);
  if (list.length < 3) return <><div className="ch"><div><h3>Закономірності</h3><p>Що впливає на твій настрій</p></div></div><p className="muted">Запиши настрій хоча б кілька разів, і тут зʼявляться закономірності: коли тобі найкраще, що піднімає й опускає настрій.</p></>;
  const all = avg(list.map(m => m.v));
  const span = (a: number, b: number) => avg(S.moods.filter(m => m.t >= now - a * DAY && m.t < now - b * DAY).map(m => m.v));
  const wk = span(7, 0), prev = span(14, 7), delta = wk && prev ? wk - prev : 0;
  const PARTS: [string, (h: number) => boolean][] = [['Ранок', h => h >= 5 && h < 12], ['День', h => h >= 12 && h < 17], ['Вечір', h => h >= 17 && h < 22], ['Ніч', h => h >= 22 || h < 5]];
  const parts = PARTS.map(([l, f]) => { const v = list.filter(m => f(new Date(m.t).getHours())).map(m => m.v); return { l, v: avg(v), n: v.length }; });
  const best = [...parts].filter(p => p.n).sort((a, b) => b.v - a.v)[0];
  const byTag = new Map<string, number[]>();
  list.forEach(m => m.tags.forEach(t => byTag.set(t, [...(byTag.get(t) || []), m.v])));
  const tags = [...byTag].filter(([, v]) => v.length >= 2).map(([t, v]) => ({ t, d: avg(v) - all, n: v.length })).sort((a, b) => b.d - a.d);
  const up = tags.filter(x => x.d >= 0.3).slice(0, 3), down = tags.filter(x => x.d <= -0.3).slice(-3).reverse();
  const energy = ENERGY3.map((x, i) => { const v = list.filter(m => energyLevel(m.energy) === i + 1).map(m => m.v); return { l: x.l, v: avg(v), n: v.length }; }).filter(e => e.n);
  return (
    <>
      <div className="ch"><div><h3>Закономірності</h3><p>За останні 30 днів · {list.length} {plural(list.length, 'запис', 'записи', 'записів')}</p></div></div>
      <div className="kv">
        <div><div className="muted" style={{ fontSize: 12 }}>Середній настрій</div><div className="num" style={{ fontSize: 24, fontWeight: 600, color: moodColor(all) }}>{all.toFixed(1)}<small className="muted" style={{ fontSize: 13 }}>/10</small></div></div>
        <div><div className="muted" style={{ fontSize: 12 }}>Цей тиждень</div><div className="num" style={{ fontSize: 24, fontWeight: 600 }}>{wk ? wk.toFixed(1) : '—'}{delta !== 0 && <span className={`delta ${delta > 0 ? 'up' : 'dn'}`} style={{ marginLeft: 8 }}>{delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}</span>}</div></div>
        <div><div className="muted" style={{ fontSize: 12 }}>Найкращий час</div><div style={{ fontSize: 20, fontWeight: 600 }}>{best ? best.l : '—'}</div></div>
      </div>
      <div className="cats" style={{ marginTop: 16 }}>
        {parts.map(p => <div className="catrow" key={p.l}><span>{p.l}</span><div className="bar"><i style={{ width: (p.v / 10) * 100 + '%', background: moodColor(p.v) }} /></div><span className="num" style={{ textAlign: 'right' }}>{p.n ? p.v.toFixed(1) : '—'}</span></div>)}
      </div>
      {(up.length > 0 || down.length > 0) && (
        <div className="moodtags">
          {up.length > 0 && <div><div className="muted" style={{ fontSize: 12 }}>Піднімає настрій</div><div className="tags small">{up.map(x => <span key={x.t} className="up">{x.t} +{x.d.toFixed(1)}</span>)}</div></div>}
          {down.length > 0 && <div><div className="muted" style={{ fontSize: 12 }}>Опускає настрій</div><div className="tags small">{down.map(x => <span key={x.t} className="dn">{x.t} {x.d.toFixed(1)}</span>)}</div></div>}
        </div>
      )}
      {energy.length > 1 && <p className="muted" style={{ fontSize: 12, margin: '12px 0 0' }}>Енергія і настрій: {energy.map(e => `${e.l.toLowerCase()} → ${e.v.toFixed(1)}`).join(' · ')}</p>}
    </>
  );
}

export function Health() {
  const { S } = useStore();
  const [moodDay, setMoodDay] = useState(TK);
  const [healthDay, setHealthDay] = useState(TK);
  const [editing, setEditing] = useState<MoodEntry | null>(null);
  const formCard = useRef<HTMLDivElement>(null);
  const startEdit = (m: MoodEntry) => { setEditing(m); setTimeout(() => formCard.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 0); };
  const keys = [...Array(14)].map((_, i) => ymd(addD(new Date(), i - 13)));
  const days = keys.map(k => S.health[k]);
  const ser = (f: 'sleep' | 'water' | 'workout') => days.map(d => (d ? d[f] : 0));
  const hday = S.health[healthDay];
  const dd = new Date(healthDay + 'T00:00'), isT = healthDay === TK();
  const wts = keys.map(k => S.health[k]?.weight || 0).filter(x => x > 0);
  const av = (f: Parameters<typeof ser>[0]) => avg(ser(f).filter(x => x > 0));
  const moods = keys.map(k => dayMood(S, k)), moodAv = avg(moods.filter(x => x > 0));
  // average clock time; times after noon count as the evening before so 23:30 and 00:30 average to midnight
  const avgTime = (f: 'bed' | 'wake') => {
    const ms = days.map(d => d?.[f]).filter(Boolean).map(t => { const m = toMin(t!); return f === 'bed' && m < 720 ? m + 1440 : m; });
    if (!ms.length) return '—';
    const m = Math.round(avg(ms)) % 1440; return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
  };
  return (
    <section className="view">
      <div className="vh"><div><h2>Здоровʼя</h2><p>Відмічай щодня. Настрій можна записувати кілька разів на день. Графіки показують останні 14 днів.</p></div></div>
      <div className="card" style={{ marginTop: 18 }}>
        <div className="ch">
          <div><h3>{isT ? 'Сьогодні' : `${WD[dd.getDay()]}, ${dd.getDate()} ${MON[dd.getMonth()]}`}</h3><p>{isT ? 'Сон, вода, рух і вага. Минулі дні можна доповнити стрілками' : 'Доповнюєш минулий день. Ці дані йдуть в оцінку того дня'}{hday?.demo ? ' · демо-дані' : ''}</p></div>
          <div className="row" style={{ marginLeft: 'auto', gap: 6, flexWrap: 'nowrap' }}>
            {!isT && <button className="btn ghost" onClick={() => setHealthDay(TK())}>Сьогодні</button>}
            <button className="btn ghost cal-nav" aria-label="Попередній день" onClick={() => setHealthDay(ymd(addD(dd, -1)))}>‹</button>
            <button className="btn ghost cal-nav" aria-label="Наступний день" disabled={isT} onClick={() => setHealthDay(ymd(addD(dd, 1)))}>›</button>
          </div>
        </div>
        <LifeTiles full k={healthDay} />
      </div>
      <div className="grid" style={{ marginTop: 18 }}>
        <div className="card s5" ref={formCard}>
          <div className="ch"><div><h3>{editing ? 'Змінити запис' : 'Як ти зараз?'}</h3><p>{editing ? `Запис від ${new Date(editing.t).getDate()} ${MON[new Date(editing.t).getMonth()]}, ${hhmm(new Date(editing.t))}` : 'Запиши настрій з часом і деталями'}</p></div></div>
          <MoodForm key={editing?.id ?? 'new'} edit={editing} onDone={() => setEditing(null)} />
        </div>
        <div className="card s7"><MoodLog k={moodDay} setK={setMoodDay} onEdit={startEdit} /></div>
        <div className="card s5"><MoodMonth k={moodDay} setK={setMoodDay} /></div>
        <div className="card s7"><MoodInsights /></div>
        <div className="card s6"><div className="ch"><div><h3>Настрій</h3><p>Середній настрій {moodAv.toFixed(1)} з 10</p></div></div><Bars vals={moods.map(v => Math.round(v * 10) / 10)} max={10} color={v => moodColor(v)} unit="/10" /></div>
        <div className="card s6"><div className="ch"><div><h3>Сон</h3><p>У середньому {av('sleep').toFixed(1)} год · засинаєш о {avgTime('bed')}, прокидаєшся о {avgTime('wake')}</p></div></div><Bars vals={ser('sleep')} max={12} color="var(--sleep)" target={8} unit=" год" /></div>
        <div className="card s6"><div className="ch"><div><h3>Вода</h3><p>{av('water') ? `У середньому ${av('water').toFixed(1)} склянки на день · ціль ${waterGoal(S)}` : 'Ще нічого не записано'}</p></div></div><Bars vals={ser('water')} max={Math.max(12, waterGoal(S) + 2)} color={v => (v >= waterGoal(S) ? 'var(--good)' : 'var(--accent-2)')} target={waterGoal(S)} unit=" склянок" /></div>
        <div className="card s6"><div className="ch"><div><h3>Рух</h3><p>{av('workout') ? `У середньому ${Math.round(av('workout'))} хв на день · ціль ${moveGoal(S)}` : 'Ще нічого не записано'}</p></div></div><Bars vals={ser('workout')} max={Math.max(90, moveGoal(S) * 2)} color={v => (v >= moveGoal(S) ? 'var(--good)' : 'var(--accent)')} target={moveGoal(S)} unit=" хв" /></div>
        {wts.length > 1 && <div className="card s12"><div className="ch"><div><h3>Вага</h3><p>{wts[0]} → {wts[wts.length - 1]} кг за 14 днів ({wts[wts.length - 1] - wts[0] >= 0 ? '+' : ''}{(Math.round((wts[wts.length - 1] - wts[0]) * 10) / 10)} кг)</p></div></div></div>}
      </div>
    </section>
  );
}

/* ---------------- Goals ---------------- */
