'use client';

import { useMemo, useState } from 'react';
import { useNow, useStore } from '@/lib/store';
import { coach, METRICS, type Area, type Chain, type Link, type Tip } from '@/lib/coach';
import { plural } from '@/lib/util';
import { Icon, type IconName } from '../Icon';
import { Empty } from '../shared';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const AREA_ICON: Record<Area, IconName> = {
  'Сон і тіло': 'moon', 'Настрій': 'wave', 'Робота й бізнес': 'focus', 'Компанія': 'company', 'Цілі й розвиток': 'goals', 'Увага й час': 'clock', 'Гроші': 'money', 'Люди': 'team',
};

/** One tip as a row: what to do on top, the facts and the reason one tap away. */
function TipRow({ t, go }: { t: Tip; go: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`trow ${t.tone}${open ? ' open' : ''}`}>
      <button className="trow-h" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span className="nxi"><Icon n={t.tone === 'good' ? 'check' : AREA_ICON[t.area]} /></span>
        <span className="t"><b>{t.title}</b><small><em>Що зробити:</em> {t.action}</small></span>
        <span className="trow-c" aria-hidden="true"><Icon n="right" /></span>
      </button>
      {open && (
        <div className="trow-b">
          {t.facts.length > 0 && <div className="tipfacts">{t.facts.map(f => <span key={f}>{f}</span>)}</div>}
          <p><b>Чому це важливо.</b> {t.why}</p>
          {t.to && <button className="btn ghost sm" onClick={() => go(t.to!)}>Відкрити розділ <Icon n="arrow" /></button>}
        </div>
      )}
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
  const minute = Math.floor(now / 60_000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const r = useMemo(() => coach(S, eventsOn, new Date(now)), [S, eventsOn, minute]);
  const areas = [...new Set(r.links.map(l => METRICS[l.d].area))] as Area[];
  const co = r.tips.filter(t => t.area === 'Компанія'), me = r.tips.filter(t => t.area !== 'Компанія');
  const urgent = me.filter(t => t.tone !== 'good').slice(0, 5), rest = me.filter(t => !urgent.includes(t));
  const warns = r.tips.filter(t => t.tone === 'warn').length, goods = r.tips.filter(t => t.tone === 'good').length;
  const hasCo = S.co.leads.length + S.co.deals.length + S.co.projects.length + S.co.invoices.length > 0;
  const stats: [string, string, string][] = [
    ['Днів у записах', String(r.days), r.days >= 8 ? 'достатньо для висновків' : 'чим більше, тим точніше'],
    ['Потребує уваги', String(warns), warns ? 'розкрий і почни з верхнього' : 'усе спокійно'],
    ['Компанія', String(co.filter(t => t.tone !== 'good').length), hasCo ? 'справ, що чекають на тебе' : 'ще без записів'],
    ['Іде добре', String(goods), goods ? 'тримай цей напрямок' : 'поки нічого не виділив'],
  ];
  return (
    <section className="view">
      <div className="vh"><div><h2>Поради</h2><p>Підказки з твоїх власних днів: що зробити, і чому саме це. Натисни на пораду, щоб побачити цифри й пояснення.</p></div></div>

      <div className="grid">
        {stats.map(([l, v, s]) => <div key={l} className="card s3 stat"><div className="k">{l}</div><div className="v num">{v}</div><div className="k" style={{ marginTop: 4 }}>{s}</div></div>)}
      </div>

      <div className="card cardcol">
        <div className="ch" style={{ margin: 0 }}><Icon n="company" className="ic" /><div><h3>Компанія</h3><p>{co.length ? 'Клієнти, рахунки й проєкти: із іменами, сумами та строками' : hasCo ? 'Прострочень і справ, що чекають, нема' : 'Додай першого потенційного клієнта в режимі «Компанія», і тут зʼявляться поради'}</p></div><button className="sel" onClick={() => go('co')}>Огляд компанії</button></div>
        {co.length ? <div className="tlist">{co.map(t => <TipRow key={t.id} t={t} go={go} />)}</div>
          : <Empty icon={hasCo ? 'check' : 'leads'} title={hasCo ? 'По компанії все гаразд' : 'Компанія ще порожня'} text={hasCo ? 'Нікому відповідати, прострочених рахунків і проєктів нема.' : 'Починай з «Ліди»: запиши людину, якій хочеш щось продати.'} />}
      </div>

      <div className="card cardcol">
        <div className="ch" style={{ margin: 0 }}><Icon n="trophy" className="ic" /><div><h3>Що зробити зараз</h3><p>{r.days ? `Особисте, за ${r.days} ${plural(r.days, 'день', 'дні', 'днів')} записів. Найважливіше зверху` : 'Поки замало записів'}</p></div></div>
        {urgent.length ? <div className="tlist">{urgent.map(t => <TipRow key={t.id} t={t} go={go} />)}</div>
          : <Empty icon="check" title="Термінового нема" text="Продовжуй записувати день, і поради зʼявляться, щойно я помічу закономірність." />}
      </div>

      {rest.length > 0 && (
        <div className="card cardcol">
          <div className="ch" style={{ margin: 0 }}><Icon n="flag" className="ic" /><div><h3>Ще</h3><p>Менш термінове й те, що йде добре</p></div></div>
          <div className="tlist">{rest.map(t => <TipRow key={t.id} t={t} go={go} />)}</div>
        </div>
      )}

      {r.chains.length > 0 && (
        <div className="card cardcol">
          <div className="ch" style={{ margin: 0 }}><Icon n="wave" className="ic" /><div><h3>Що тягне за собою що</h3><p>Ланцюжки з твоїх записів: одне запускає інше</p></div></div>
          {r.chains.map(c => <ChainCard key={c.id} c={c} />)}
        </div>
      )}

      {r.links.length > 0 && (
        <div className="card cardcol">
          <div className="ch" style={{ margin: 0 }}><Icon n="map" className="ic" /><div><h3>Усі закономірності</h3><p>{r.links.length} {plural(r.links.length, 'зв’язок', 'зв’язки', 'зв’язків')} у твоїх днях. Це збіги, а не діагноз</p></div></div>
          {areas.map(a => (
            <div key={a}>
              <div className="subh" style={{ margin: '4px 0 6px' }}>{a}</div>
              <div className="linklist">{r.links.filter(l => METRICS[l.d].area === a).map(l => <LinkRow key={l.id} l={l} />)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card cardcol">
        <div className="ch" style={{ margin: 0 }}><Icon n="edit" className="ic" /><div><h3>Що допоможе радити точніше</h3><p>{r.chains.length || r.links.length ? 'Чим довше й повніше записи, тим впевненіші висновки' : 'Зв’язки між сном, настроєм і задачами зʼявляться, коли буде хоча б 6–8 днів записів'}</p></div></div>
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
