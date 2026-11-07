'use client';

import { useMemo } from 'react';
import { useNow, useStore } from '@/lib/store';
import { adviceCards } from '@/lib/advice';
import { plural } from '@/lib/util';
import { Icon } from '../Icon';
import { Empty } from '../shared';
import { AdviceItem, LinksCard } from '../Advice';
import { ClaudeReportCard } from '../Brief';

export function CoachPage() {
  const { S, eventsOn } = useStore();
  const now = useNow(60_000);
  const day = Math.floor(now / 60_000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const r = useMemo(() => adviceCards(S, eventsOn, new Date(now)), [S, eventsOn, day]);
  return (
    <section className="view">
      <div className="vh"><div><h2>Поради</h2><p>Що зробити сьогодні й чому. Я дивлюся на твої записи: сон, настрій, звички, задачі, гроші, події. Усе, що тут написано, випливає з твоїх днів, а не із загальних порад.</p></div></div>

      <div className="grid" style={{ marginTop: 18 }}>
        <div className="s12 pghead">
          <Icon n="trophy" className="ic" />
          <div><h3>Що зробити сьогодні</h3><p>{r.days ? `Рахую за ${r.days} ${plural(r.days, 'день', 'дні', 'днів')} записів. Найважливіше зверху` : 'Поки замало записів'}</p></div>
        </div>
        {r.todo.length
          ? <div className="s12 advicegrid">{r.todo.map(a => <AdviceItem key={a.id} a={a} />)}</div>
          : <div className="card s12"><Empty icon="check" title="Термінового нема" text="Нічого, що потребувало б уваги просто зараз. Записуй день, і поради зʼявляться, щойно я помічу закономірність." /></div>}

        {r.good.length > 0 && (
          <>
            <div className="s12 pghead"><Icon n="check" className="ic" /><div><h3>Що йде добре</h3><p>Так тримати</p></div></div>
            <div className="s12 advicegrid">{r.good.map(a => <AdviceItem key={a.id} a={a} />)}</div>
          </>
        )}

        <LinksCard />

        <ClaudeReportCard />

        <div className="card s12 cardcol">
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
      </div>
    </section>
  );
}
