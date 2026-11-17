'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import type { Slot } from '@/lib/planner';
import { weekKeys } from '@/lib/needs';
import { DN, hmPlain, MON, toMin, ymd } from '@/lib/util';
import { useWeek } from '../needs';
import { Icon } from '../Icon';
import { Empty } from '../shared';

type Row = { key: string; s: string; e: string; need: number; kind: 'plan' | 'set' | 'ok' | 'missed'; eventId?: number; slot?: Slot };

/** The plan of the week: fixed blocks from the calendar → free windows → ready slots for the needs that are short. */
export function Plan() {
  const { S, A, cal, go } = useStore();
  const [next, setNext] = useState(false);
  const { stats, plan: p, wsT, now } = useWeek(next ? 1 : 0, true);
  const plan = p!, keys = weekKeys(new Date(wsT)), today = ymd(new Date(now)), hhmm = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  const name = (id: number) => S.needs.find(n => n.id === id)?.name ?? '?';
  const short = stats.filter(s => s.need.weekly - s.done - s.planned > 0).length;

  const rows = (k: string): Row[] => {
    const set: Row[] = S.events.filter(e => e.date === k && e.need).map(e => {
      const over = k < today || (k === today && toMin(e.e) <= hhmm);
      return { key: 'e' + e.id, s: e.s, e: e.e, need: e.need!, kind: e.ok ? 'ok' : over ? 'missed' : 'set', eventId: e.id };
    });
    const fresh: Row[] = plan.slots.filter(x => x.date === k).map(x => ({ key: `p${x.need}${x.s}`, s: x.s, e: x.e, need: x.need, kind: 'plan', slot: x }));
    return [...set, ...fresh].sort((a, b) => a.s.localeCompare(b.s));
  };
  const free = (k: string) => plan.days.find(d => d.date === k);
  const noCal = cal.state === 'none' && !S.icalUrls.length;

  return (
    <section className="view">
      <div className="grid">
        <div className="card s12">
          <div className="ch">
            <Icon n="schedule" className="ic" />
            <div><h3>План тижня</h3><p>Зайняті блоки беру з календаря, вільні вікна рахую сам і кладу в них те, чого бракує</p></div>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="subtabs" role="tablist" style={{ flex: 'none' }}>
              <button role="tab" aria-selected={!next} onClick={() => setNext(false)}>Цей тиждень</button>
              <button role="tab" aria-selected={next} onClick={() => setNext(true)}>Наступний</button>
            </div>
            {plan.slots.length > 0 && <button className="btn acc" onClick={() => A.planSlots(plan.slots)}><Icon n="check" />Додати все в розклад · {plan.slots.length}</button>}
          </div>
          {noCal && <p className="help" style={{ marginTop: 12 }}>Календар не підключений, тому я бачу лише події, додані тут. Підключи календар у <button className="linkbtn" onClick={() => go('prefs')}>налаштуваннях</button>, і школа, робота й вихідні потраплять у план самі.</p>}
          {!plan.slots.length && !plan.unplaced.length && <p className="help" style={{ marginTop: 12 }}>{short ? 'Вільних вікон для того, чого бракує, немає.' : next ? 'Усе, що треба на цей тиждень, уже в розкладі.' : 'Усе, що ще можна зробити цього тижня, уже в розкладі або виконано.'}</p>}
          {plan.unplaced.length > 0 && (
            <p className="help" style={{ marginTop: 12 }}>
              Не вмістилось: {plan.unplaced.map(u => `${name(u.need)} ×${u.missing}`).join(', ')}. Звільни час у календарі або зменш ціль у «Потребах».
            </p>
          )}
        </div>

        {keys.map((k, i) => {
          const list = rows(k), f = free(k), d = new Date(k + 'T00:00');
          if (!list.length && !f) return null;
          return (
            <div className={`card s6 dayplan${k === today ? ' today' : ''}`} key={k}>
              <div className="ch">
                <div><h3>{DN[i]}, {d.getDate()} {MON[d.getMonth()]}{k === today ? ' · сьогодні' : ''}</h3>
                  <p>{f ? `вільно ${hmPlain(f.free)} · зайнято ${hmPlain(f.busy)}` : 'день минув'}</p></div>
              </div>
              <div className="list">
                {list.map(r => (
                  <div className={`item slot ${r.kind}`} key={r.key}>
                    {r.kind === 'plan' ? <span className="chk" aria-hidden="true" />
                      : <button className={`chk${r.kind === 'ok' ? ' on' : ''}`} role="checkbox" aria-checked={r.kind === 'ok'} aria-label={`${r.kind === 'ok' ? 'Повернути' : 'Було'}: ${name(r.need)}`} onClick={() => A.toggleSlot(r.eventId!)}>{r.kind === 'ok' && <Icon n="check" />}</button>}
                    <span className="t"><b className="num">{r.s}–{r.e}</b> {name(r.need)}
                      <small>{r.kind === 'plan' ? 'пропозиція' : r.kind === 'ok' ? 'зроблено' : r.kind === 'missed' ? 'час минув: було?' : 'у розкладі'}</small></span>
                    {r.kind === 'plan' && <button className="btn ghost sm" onClick={() => A.planSlots([r.slot!])}><Icon n="plus" className="icn sm" />В розклад</button>}
                    {r.kind !== 'plan' && r.kind !== 'ok' && <button className="ib danger" title="Прибрати з розкладу" aria-label={`Прибрати: ${name(r.need)}`} onClick={() => A.delEvent(r.eventId!)}><Icon n="x" /></button>}
                  </div>
                ))}
                {!list.length && <p className="muted" style={{ margin: 0 }}>Нічого не потрібно.{f && f.free < 30 ? ' День зайнятий.' : ''}</p>}
              </div>
            </div>
          );
        })}
        {!S.needs.some(n => n.on) && <div className="card s12"><Empty icon="needs" title="Немає потреб" text="Увімкни потреби, і я складу план."><button className="btn acc" onClick={() => go('needs')}>До потреб</button></Empty></div>}
      </div>
    </section>
  );
}
