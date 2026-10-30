'use client';

import { useState } from 'react';
import { liveSessions, useNow, useStore } from '@/lib/store';
import { fmtCur, realTx, txDKK } from '@/lib/money';
import { TK, wStart } from '@/lib/util';
import { Icon } from './Icon';

export const WOLT = 'Wolt';
const hrs = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} год ${Math.round(m % 60)} хв` : `${Math.round(m)} хв`);

/** Wolt shifts against what they pay and against the focus time left for WebHjerte. */
export function WoltCard({ span = 's12' }: { span?: string }) {
  const { S, A, setSheet } = useStore();
  const now = useNow(15_000, !!S.act || S.timer.running);
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const from = period === 'week' ? wStart().getTime() : new Date(TK().slice(0, 7) + '-01T00:00').getTime();
  const fromK = new Date(from).toLocaleDateString('sv-SE');
  const running = S.act?.kind === WOLT ? [{ start: S.act.start, end: now }] : [];
  const shiftMin = [...S.activities.filter(a => a.kind === WOLT), ...running]
    .reduce((m, a) => m + Math.max(0, Math.min(a.end, now) - Math.max(a.start, from)) / 6e4, 0);
  const earned = realTx(S).filter(t => t.type === 'in' && t.cat === WOLT && t.date >= fromK).reduce((a, t) => a + txDKK(S, t), 0);
  const focusMin = liveSessions(S, now).filter(s => s.t >= from).reduce((a, s) => a + s.m, 0);
  const perHour = shiftMin >= 30 ? earned / (shiftMin / 60) : 0;
  const share = shiftMin + focusMin ? Math.round((shiftMin / (shiftMin + focusMin)) * 100) : 0;
  const isRunning = running.length > 0;
  return (
    <div className={`card ${span} wolt`}>
      <div className="ch">
        <span className="ic woltic">W</span>
        <div><h3>Wolt і WebHjerte</h3><p>Скільки годин іде на доставку, скільки вона платить і скільки лишається на свою справу</p></div>
        <div className="seg" style={{ marginLeft: 'auto' }}>
          <button aria-pressed={period === 'week'} onClick={() => setPeriod('week')}>Тиждень</button>
          <button aria-pressed={period === 'month'} onClick={() => setPeriod('month')}>Місяць</button>
        </div>
      </div>
      <div className="woltstats">
        <div><span>Wolt</span><b className="num">{hrs(shiftMin)}</b></div>
        <div><span>Заробіток</span><b className="num">{fmtCur(earned, 'DKK')}</b></div>
        <div><span>За годину</span><b className="num">{perHour ? fmtCur(perHour, 'DKK') : '—'}</b></div>
        <div><span>Фокус</span><b className="num">{hrs(focusMin)}</b></div>
      </div>
      {shiftMin + focusMin > 0 && (
        <div className="woltbar" title={`Wolt ${share}% · фокус ${100 - share}%`}>
          <i className="w" style={{ width: share + '%' }} /><i className="f" style={{ width: 100 - share + '%' }} />
        </div>
      )}
      <p className="help" style={{ marginTop: 10 }}>
        {shiftMin < 1 && !earned ? 'Запускай «Зміну Wolt», коли виходиш на доставку, і записуй заробіток як дохід «Wolt». Тоді тут буде видно, скільки коштує година твого часу.'
          : <>Wolt забирає <b>{share}%</b> часу, який іде на роботу (Wolt + фокус).{perHour > 0 && <> Година доставки дає <b>{fmtCur(perHour, 'DKK')}</b>: щоб година на WebHjerte була вигіднішою, клієнтські проєкти мають приносити більше.</>}{shiftMin >= 30 && !earned && ' Заробіток ще не записано, тому ціну години не порахувати.'}</>}
      </p>
      <div className="row" style={{ marginTop: 6 }}>
        {isRunning
          ? <button className="btn acc" onClick={() => A.stopAct()}><Icon n="pause" />Завершити зміну</button>
          : <button className="btn" onClick={() => A.startAct(WOLT, 'Зміна')} disabled={!!S.act}><Icon n="play" />Почати зміну Wolt</button>}
        <button className="btn ghost" onClick={() => setSheet({ kind: 'form', key: 'in', init: { cat: WOLT, note: 'Wolt' } })}>+ Заробіток Wolt</button>
        {S.act && !isRunning && <span className="muted" style={{ fontSize: 12 }}>Зараз іде «{S.act.kind}», спершу заверши його.</span>}
      </div>
    </div>
  );
}
