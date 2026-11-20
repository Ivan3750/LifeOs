'use client';

import { useMemo, useState } from 'react';
import { useNow, useStore } from '@/lib/store';
import { byHunger, dailyState, HUNGER_WORD, ideaFor, weekKey, weekStats, type NeedStat } from '@/lib/needs';
import { planWeek } from '@/lib/planner';
import { suggestPerson } from '@/lib/people';
import { addD, plural, TK, wStart } from '@/lib/util';
import { Icon } from './Icon';
import { Burst } from './Burst';

/** The needs of the week `off` weeks from this one (0 this, 1 next, -1 last), and the plan for it when `withPlan` is set. */
export function useWeek(off: number, withPlan = false) {
  const { S, eventsOn } = useStore();
  const now = useNow(60_000);
  const wsT = addD(wStart(new Date(now)), off * 7).getTime();
  const stats = useMemo(() => weekStats(S, new Date(wsT), eventsOn, now), [S, wsT, eventsOn, now]);
  const plan = useMemo(() => (withPlan ? planWeek(S, new Date(wsT), eventsOn, now, stats) : null), [S, wsT, eventsOn, now, stats, withPlan]);
  return { stats, plan, wsT, now };
}

/** The needs of this week, the hungriest first. */
export function useNeeds(): { stats: NeedStat[]; now: number } {
  const { stats, now } = useWeek(0);
  return { stats: [...stats].sort(byHunger), now };
}

/** Done against the target, with what is already planned drawn lighter after it. */
export function NeedBar({ st }: { st: NeedStat }) {
  const t = Math.max(1, st.need.weekly);
  return (
    <div className={`nbar hg ${st.status}`} role="img" aria-label={`${st.done} з ${st.need.weekly}`}>
      <i style={{ width: Math.min(100, (st.done / t) * 100) + '%' }} />
      {st.planned > 0 && <b style={{ left: Math.min(100, (st.done / t) * 100) + '%', width: Math.min(100 - Math.min(100, (st.done / t) * 100), (st.planned / t) * 100) + '%' }} />}
    </div>
  );
}

export const HungerTag = ({ st }: { st: NeedStat }) => <span className={`hgtag hg ${st.status}`}>{HUNGER_WORD[st.status]}</span>;

/** The home card: what is missing this week, with a one-tap mark. */
export function NeedsCard({ cls = 's5' }: { cls?: string }) {
  const { A, go } = useStore();
  const { stats } = useNeeds();
  const hungry = stats.filter(s => s.status !== 'ok'), red = hungry.length;
  const list = (hungry.length ? hungry : stats.slice(0, 3)).slice(0, 5);
  return (
    <div className={`card ${cls}`}>
      <div className="ch">
        <Icon n="needs" className="ic" />
        <div><h3>Чого бракує цього тижня</h3><p>{!stats.length ? 'Увімкни потреби в розділі «Потреби»' : red ? 'Є на що звернути увагу, коли буде час' : 'Усе в нормі'}</p></div>
        <button className="sel" onClick={() => go('needs')}>Усі</button>
      </div>
      <div className="list">
        {list.map(st => (
          <div className={`item nmini hg ${st.status}`} key={st.need.id}>
            <span className="ndot" aria-hidden="true" />
            <span className="t">{st.need.name}</span>
            <span className="muted num" style={{ fontSize: 12 }}>{st.done}/{st.need.weekly}</span>
            <button className="ib" title="Було ще раз" aria-label={`Відмітити: ${st.need.name}`} onClick={() => A.logNeed(st.need.id)}><Icon n="plus" className="icn sm" /></button>
          </div>
        ))}
        {!list.length && <p className="muted" style={{ margin: 0 }}>Потреб поки немає.</p>}
      </div>
    </div>
  );
}

/** Three things for the day instead of a list of tasks: movement, one new thing, one person. Each is a tap. */
export function DailyCard({ cls = 's7' }: { cls?: string }) {
  const { S, A, go } = useStore();
  const now = useNow(60_000), k = TK();
  const [shift, setShift] = useState(0);
  const st = dailyState(S, k), sug = suggestPerson(S, k);
  const done = [st.move, st.nov, st.person].filter(Boolean).length;
  const sport = S.needs.find(n => n.key === 'sport');
  const slot = sport ? S.events.filter(e => e.need === sport.id && e.date === k && !e.ok).sort((a, b) => a.s.localeCompare(b.s))[0] : undefined;
  const talked = S.touches.filter(t => t.date === k).map(t => ({ t, p: S.people.find(p => p.id === t.person) })).filter(x => x.p);
  const days = sug ? sug.days : null;
  return (
    <div className={`card ${cls} dmin`}>
      <div className="ch">
        <Icon n="flag" className="ic" />
        <div><h3>Мінімум на сьогодні</h3><p>{done === 3 ? 'Мінімум виконано. Решта вже бонус' : 'Три речі, кожна в один дотик'}</p></div>
        <span className="muted num" style={{ marginLeft: 'auto', fontSize: 13 }}>{done}/3</span>
        {done === 3 && <Burst />}
      </div>
      <div className="list">
        <div className={`item${st.move ? ' done' : ''}`}>
          <button className={`chk${st.move ? ' on' : ''}`} role="checkbox" aria-checked={st.move} aria-label="Рух: зроблено" onClick={() => A.toggleDaily('move')}>{st.move && <Icon n="check" />}</button>
          <span className="t"><b>Рух</b><small>{slot ? `Заплановано о ${slot.s}` : 'Прогулянка 20 хвилин чи тренування'}</small></span>
        </div>
        <div className={`item${st.nov ? ' done' : ''}`}>
          <button className={`chk${st.nov ? ' on' : ''}`} role="checkbox" aria-checked={st.nov} aria-label="Нова дія: зроблено" onClick={() => A.toggleDaily('nov')}>{st.nov && <Icon n="check" />}</button>
          <span className="t"><b>Одна нова дія</b><small>{ideaFor(new Date(now), shift)}</small></span>
          {!st.nov && <button className="ib" title="Інша ідея" aria-label="Інша ідея" onClick={() => setShift(x => x + 1)}><Icon n="refresh" /></button>}
        </div>
        <div className={`item${st.person ? ' done' : ''}`}>
          <span className={`chk${st.person ? ' on' : ''}`} aria-hidden="true">{st.person && <Icon n="check" />}</span>
          {st.person ? (
            <span className="t"><b>Людина</b><small>{talked.map(x => `${x.p!.name} (${x.t.kind === 'meet' ? 'зустрівся' : 'написав'})`).join(', ')}</small></span>
          ) : sug ? (
            <>
              <span className="t"><b>Написати чи зустріти: {sug.person.name}</b><small>{sug.person.nextDate === k && sug.person.next ? sug.person.next : days === null ? 'Ще не було зв’язку' : days === 0 ? 'Вже сьогодні був зв’язок' : `Востаннє ${days} ${plural(days, 'день', 'дні', 'днів')} тому`}</small></span>
              <button className="btn ghost sm" onClick={() => A.addTouch(sug.person.id, 'msg')}>Написав</button>
              <button className="btn acc sm" onClick={() => A.addTouch(sug.person.id, 'meet')}>Зустрівся</button>
            </>
          ) : (
            <>
              <span className="t"><b>Одна людина</b><small>Додай, кому писати чи з ким бачитись</small></span>
              <button className="btn ghost sm" onClick={() => go('people')}>Додати</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Days since a person was last in touch, in words. */
export const sinceWord = (d: number | null) => (d === null ? 'ще не було' : d === 0 ? 'сьогодні' : d === 1 ? 'вчора' : `${d} ${plural(d, 'день', 'дні', 'днів')} тому`);

/** On Sunday: a quiet offer of the five-minute review. It can be set aside, and it is asked for only once. */
export function WeekReviewPrompt() {
  const { S, A, go } = useStore();
  const now = useNow(60_000), d = new Date(now), wk = weekKey(d);
  if (d.getDay() !== 0 || S.reviews[wk]?.done) return null;
  return (
    <div className="card s12 reviewprompt">
      <div className="ch" style={{ marginBottom: 0 }}>
        <Icon n="check" className="ic" />
        <div><h3>Огляд тижня, якщо є настрій</h3><p>Три коротких запитання, близько 5 хвилин. Можна пропустити</p></div>
        <div className="row" style={{ marginLeft: 'auto' }}>
          <button className="btn ghost sm" onClick={() => A.skipWeekReview(wk)}>Не зараз</button>
          <button className="btn acc sm" onClick={() => go('review')}>Почати</button>
        </div>
      </div>
    </div>
  );
}

/** The quick sheet «what was it?»: every need as one tap, the hungriest first. */
export function MarkBody({ close }: { close: () => void }) {
  const { A } = useStore();
  const { stats } = useNeeds();
  return (
    <>
      <div className="markgrid">
        {stats.map(st => (
          <button key={st.need.id} className={`mark hg ${st.status}`} onClick={() => { A.logNeed(st.need.id); close(); }}>
            <span className="ndot" aria-hidden="true" /><b>{st.need.name}</b><small className="num">{st.done}/{st.need.weekly}</small>
          </button>
        ))}
      </div>
      {!stats.length && <p className="muted">Потреб немає. Увімкни їх у розділі «Цілі → Ритм тижня».</p>}
      <p className="muted" style={{ fontSize: 12, margin: '14px 0 0' }}>Одним дотиком: відмічу сьогодні. Скасувати можна в «Ритмі тижня».</p>
    </>
  );
}
