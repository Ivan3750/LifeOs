'use client';

import { useMemo } from 'react';
import { useNow, useStore } from '@/lib/store';
import { coach, METRICS, type Area, type Chain, type Link, type Tip } from '@/lib/coach';
import { plural } from '@/lib/util';
import { Icon } from '../Icon';
import { Empty } from '../shared';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function TipCard({ t, go }: { t: Tip; go: (v: string) => void }) {
  return (
    <div className={`tipc ${t.tone}`}>
      <div className="tipc-a">{t.area}</div>
      <h4>{t.title}</h4>
      {t.facts.length > 0 && <div className="tipfacts">{t.facts.map(f => <span key={f}>{f}</span>)}</div>}
      <p className="tipc-why"><b>Чому це важливо.</b> {t.why}</p>
      <p className="tipc-do"><b>Що зробити.</b> {t.action}</p>
      {t.to && <button className="btn ghost sm" onClick={() => go(t.to!)}>Відкрити розділ <Icon n="arrow" /></button>}
    </div>
  );
}

/** One chain: cause → consequence → consequence, with the numbers from your own days, and what to change to break it. */
function ChainCard({ c }: { c: Chain }) {
  const first = c.steps[0];
  const nodes = [{ name: cap(METRICS[first.d].name), sub: first.when }, ...c.steps.map(l => ({ name: cap(METRICS[l.o].name), sub: `${METRICS[l.o].fmt(l.bad.avg)} проти ${METRICS[l.o].fmt(l.good.avg)}${l.lag ? ', наступного дня' : l.o === 'bedTonight' ? ', того ж вечора' : ''}` }))];
  return (
    <div className="chaincard">
      <div className="chain" role="list">
        {nodes.map((n, i) => (
          <div className="chain-i" role="listitem" key={i}>
            {i > 0 && <span className="carr" aria-hidden="true"><Icon n="arrow" /></span>}
            <div className={`cn${i === 0 ? ' root' : ''}`}><b>{n.name}</b><small>{n.sub}</small></div>
          </div>
        ))}
      </div>
      <div className="chain-t">
        <p><b>Що змінити.</b> {first.fix}</p>
        <details><summary>Чому так працює</summary>
          <ul className="howlist">{c.steps.map(l => <li key={l.id}><b>{cap(METRICS[l.d].name)} → {METRICS[l.o].name}.</b> {l.why}</li>)}</ul>
        </details>
      </div>
    </div>
  );
}

function LinkRow({ l }: { l: Link }) {
  return (
    <details className="linkrow">
      <summary><span>{l.text}</span><i className={`lk-s s${4 - l.strength}`}>{l.preliminary ? 'попередньо' : l.strength === 3 ? 'сильний зв’язок' : l.strength === 2 ? 'помітний' : 'слабкий'}</i></summary>
      <p><b>Чому.</b> {l.why}</p><p><b>Що зробити.</b> {l.fix}</p>
    </details>
  );
}

export function CoachPage() {
  const { S, eventsOn, go } = useStore();
  const now = useNow(60_000);
  const day = Math.floor(now / 60_000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const r = useMemo(() => coach(S, eventsOn, new Date(now)), [S, eventsOn, day]);
  const areas = [...new Set(r.links.map(l => METRICS[l.d].area))] as Area[];
  const top = r.tips.filter(t => t.tone !== 'good').slice(0, 6), rest = r.tips.filter(t => !top.includes(t));
  return (
    <section className="view">
      <div className="vh"><div><h2>Поради</h2><p>Я зіставляю сон, настрій, звички, задачі, фокус, цілі, бізнес, події й соцмережі з твоїх днів, шукаю, що на що впливає, і підказую, що змінити та чому.</p></div></div>

      <div className="card cardcol">
        <div className="ch" style={{ margin: 0 }}><Icon n="trophy" className="ic" /><div><h3>Що зробити зараз</h3><p>{r.days ? `Рахую за ${r.days} ${plural(r.days, 'день', 'дні', 'днів')} записів. Найважливіше зверху` : 'Поки замало записів'}</p></div></div>
        {top.length ? <div className="tipgrid">{top.map(t => <TipCard key={t.id} t={t} go={go} />)}</div>
          : <Empty icon="check" title="Термінового нема" text="Нічого, що потребувало б уваги просто зараз. Продовжуй записувати день, і поради зʼявляться, щойно я помічу закономірність." />}
      </div>

      <div className="card cardcol">
        <div className="ch" style={{ margin: 0 }}><Icon n="wave" className="ic" /><div><h3>Ланцюжки в твоїх днях</h3><p>Як одне тягне за собою інше: з твоїх власних записів, а не з загальних порад</p></div></div>
        {r.chains.length ? r.chains.map(c => <ChainCard key={c.id} c={c} />)
          : <p className="help" style={{ margin: 0 }}>Поки не бачу стійких зв’язків. Для цього потрібно хоча б 6–8 днів із записаним сном, часом засинання, настроєм і задачами або фокусом. Що саме бракує, дивись внизу.</p>}
      </div>

      {rest.length > 0 && (
        <div className="card cardcol">
          <div className="ch" style={{ margin: 0 }}><Icon n="flag" className="ic" /><div><h3>Ще</h3><p>Менш термінове й те, що йде добре</p></div></div>
          <div className="tipgrid">{rest.map(t => <TipCard key={t.id} t={t} go={go} />)}</div>
        </div>
      )}

      {r.links.length > 0 && (
        <div className="card cardcol">
          <div className="ch" style={{ margin: 0 }}><Icon n="map" className="ic" /><div><h3>Усі закономірності</h3><p>{r.links.length} {plural(r.links.length, 'зв’язок', 'зв’язки', 'зв’язків')}, що тримаються у твоїх днях. Це співвідношення, а не діагноз</p></div></div>
          {areas.map(a => (
            <div key={a}>
              <div className="subh" style={{ margin: '4px 0 6px' }}>{a}</div>
              <div className="linklist">{r.links.filter(l => METRICS[l.d].area === a).map(l => <LinkRow key={l.id} l={l} />)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card cardcol">
        <div className="ch" style={{ margin: 0 }}><Icon n="edit" className="ic" /><div><h3>Що допоможе радити точніше</h3><p>Чим довше й повніше записи, тим впевненіші висновки</p></div></div>
        <div className="cover">
          {r.coverage.map(c => (
            <div key={c.m} className={c.days >= 8 ? 'ok' : ''}>
              <div className="cover-h"><b>{c.name}</b><span className="num">{c.days} {plural(c.days, 'день', 'дні', 'днів')}</span></div>
              <div className="bar"><i style={{ width: Math.min(100, (c.days / 14) * 100) + '%', background: c.days >= 8 ? 'var(--good)' : 'var(--accent)' }} /></div>
              {c.days < 8 && <small>{c.hint}</small>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
