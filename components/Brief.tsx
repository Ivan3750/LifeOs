'use client';

import { useMemo } from 'react';
import { useNow, useStore } from '@/lib/store';
import { dayBrief } from '@/lib/briefing';
import { claudeReport } from '@/lib/report';
import { Icon } from './Icon';

/** Yesterday next to the usual: the quickest way to see what changed without opening a single section. */
export function YesterdayCard() {
  const { S, go } = useStore();
  const now = useNow(60_000), day = Math.floor(now / 3_600_000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const b = useMemo(() => dayBrief(S, new Date(now)), [S, day]);
  if (!b.lines.length) return null;
  const head = b.worse + b.better === 0 ? 'Вчора був схожий на твій звичайний день'
    : [b.better ? `краще за звичайне: ${b.better}` : '', b.worse ? `гірше: ${b.worse}` : ''].filter(Boolean).join(', ');
  return (
    <div className="card s12">
      <div className="ch"><Icon n="trend" className="ic" /><div><h3>Вчора проти звичайного</h3><p>{head}. Звичайне це твоє середнє за 2 тижні до того</p></div></div>
      <div className="briefgrid">
        {b.lines.map(l => (
          <button key={l.key} className={`brief ${l.tone}`} onClick={() => go(l.to)}>
            <span>{l.label}</span><b className="num">{l.value}</b><small>зазвичай {l.usual}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

/** A ready text of the last 30 days and the questions to ask, to paste into an ordinary Claude chat: a real analysis from the person's own
    subscription, no key and no data leaving the app by itself. */
export function ClaudeReportCard() {
  const { S, toast } = useStore();
  const copy = () => {
    const t = claudeReport(S);
    const done = () => toast('Звіт скопійовано. Відкрий Claude й встав його');
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, () => toast('Не вдалося скопіювати'));
    else toast('Копіювання недоступне в цьому браузері');
  };
  return (
    <div className="card s12">
      <div className="ch"><Icon n="life" className="ic" /><div><h3>Розібрати разом із Claude</h3><p>Без ключів і налаштувань: копіюєш звіт за 30 днів і вставляєш у звичайний чат</p></div></div>
      <div className="row">
        <button className="btn acc" onClick={copy}><Icon n="copy" />Скопіювати звіт і запит</button>
        <a className="btn ghost" href="https://claude.ai/new" target="_blank" rel="noopener noreferrer">Відкрити Claude <Icon n="arrow" /></a>
      </div>
      <p className="help" style={{ margin: '12px 0 0' }}>У звіті тільки цифри: сон, настрій, фокус, звички, витрати за категоріями й назви цілей. Нотатки, коментарі до платежів і назви подій не копіюються. Дані нікуди не надсилаються, доки ти сам їх не вставиш.</p>
    </div>
  );
}
