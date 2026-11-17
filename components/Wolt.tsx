'use client';

import { useNow, useStore } from '@/lib/store';
import { fmtCur } from '@/lib/money';
import { periodStart, WOLT, woltStats } from '@/lib/wolt';
import { Icon } from './Icon';

export { WOLT };
const hm = (h: number) => (h >= 1 ? `${Math.floor(h)} год ${Math.round((h % 1) * 60)} хв` : `${Math.round(h * 60)} хв`);

/** A small Wolt strip for other pages: this week at a glance and a way into the full Wolt page. */
export function WoltCard({ span = 's12' }: { span?: string }) {
  const { S, A, go } = useStore();
  const live = S.act?.kind === WOLT ? S.act : null;
  const now = useNow(30_000, !!live);
  const w = woltStats(S, periodStart('week'), now, live || undefined);
  return (
    <div className={`card ${span} woltmini`}>
      <span className="ic woltic">W</span>
      <div className="wm-t"><b>Wolt цього тижня</b><span className="muted">{w.hours ? `${hm(w.hours)} · ${fmtCur(w.earned, 'DKK')}${w.perHour ? ` · ${fmtCur(w.perHour, 'DKK')}/год` : ''}` : 'Змін ще не було'}</span></div>
      <div className="row" style={{ marginLeft: 'auto' }}>
        {live
          ? <button className="btn acc sm" onClick={() => go('wolt')}><span className="livedot" />Зміна йде</button>
          : <button className="btn ghost sm" disabled={!!S.act} onClick={() => { A.startAct(WOLT, 'Зміна'); go('wolt'); }}><Icon n="play" />Почати зміну</button>}
        <button className="btn ghost sm" onClick={() => go('wolt')}>Відкрити Wolt</button>
      </div>
    </div>
  );
}
