'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { buildTables, presetPeriod, SECTIONS, toCsv, toJson, type Period, type SectionKey } from '@/lib/export';
import { zip } from '@/lib/zip';
import { addD, TK, ymd } from '@/lib/util';
import type { ExtEvent } from '@/lib/types';
import { Icon } from './Icon';

const PRESETS = [['week', 'Тиждень'], ['month', 'Місяць'], ['quarter', '3 місяці'], ['year', 'Рік'], ['all', 'Увесь час'], ['custom', 'Свій період']] as const;
type Preset = (typeof PRESETS)[number][0];

function save(name: string, type: string, data: string | Uint8Array<ArrayBuffer>) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Report for a chosen period: any of the sections, with the events of the connected calendars, as one JSON or a zip of tables for Excel. */
export function ExportCard() {
  const { S, ext, toast } = useStore();
  const [preset, setPreset] = useState<Preset>('month');
  const [custom, setCustom] = useState<Period>({ from: ymd(addD(new Date(), -29)), to: TK() });
  const [on, setOn] = useState<Record<SectionKey, boolean>>(() => Object.fromEntries(SECTIONS.map(([k]) => [k, true])) as Record<SectionKey, boolean>);
  const [fmt, setFmt] = useState<'zip' | 'json'>('zip');
  const [busy, setBusy] = useState(false);
  const p: Period = preset === 'custom' ? custom : presetPeriod(preset);
  const picked = SECTIONS.filter(([k]) => on[k]).length;

  /** Calendar events for exactly this period: asked from the server, so old and future dates are included, not just the cached window. */
  const calendarEvents = async (): Promise<{ events: ExtEvent[]; note?: string }> => {
    const hasCal = S.icalUrls.length > 0 || ext.length > 0;
    if (!on.events || !hasCal) return { events: [] };
    const lo = addD(new Date(), -730), hi = addD(new Date(), 730);
    const from = new Date(Math.max(+new Date(p.from + 'T00:00'), +lo)), to = new Date(Math.min(+new Date(p.to + 'T23:59:59'), +hi));
    try {
      const res = await fetch('/api/calendar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ urls: S.icalUrls, from: from.toISOString(), to: to.toISOString() }) });
      const j = await res.json() as { events: ExtEvent[]; errors: string[] };
      return { events: j.events, note: j.errors?.length ? 'Частину календарів завантажити не вдалося' : undefined };
    } catch {
      return { events: ext, note: 'Календарі недоступні, додано події з пам’яті застосунку' };
    }
  };

  const run = async () => {
    if (p.from > p.to) { toast('Початок періоду має бути раніше за кінець'); return; }
    setBusy(true);
    try {
      const { events, note } = await calendarEvents();
      const tables = buildTables(S, events, p, on);
      if (!tables.length) { toast('За цей період нічого нема'); return; }
      const stamp = `${p.from === '0000-01-01' ? 'all' : p.from}_${p.to}`;
      if (fmt === 'json') save(`lifeos-zvit-${stamp}.json`, 'application/json', JSON.stringify(toJson(tables, p, { name: S.name }), null, 2));
      else save(`lifeos-zvit-${stamp}.zip`, 'application/zip', zip(tables.map(t => ({ name: `${t.file}.csv`, text: toCsv(t) }))));
      toast(note || `Готово: ${tables.length} ${tables.length === 1 ? 'таблиця' : 'таблиць'} за ${p.from === '0000-01-01' ? 'весь час' : `${p.from} — ${p.to}`}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="card exportcard">
      <div className="ch" style={{ marginBottom: 0 }}>
        <Icon n="trend" className="ic" />
        <div><h3>Звіт за період</h3><p>Вибери період і що включити: можна додати події з усіх підключених календарів.</p></div>
      </div>

      <div className="tabs" role="group" aria-label="Період">
        {PRESETS.map(([k, l]) => <button key={k} aria-pressed={preset === k} onClick={() => setPreset(k)}>{l}</button>)}
      </div>
      {preset === 'custom' && (
        <div className="row">
          <label className="field" htmlFor="exFrom">З<input id="exFrom" type="date" value={custom.from} max={custom.to} onChange={e => setCustom({ ...custom, from: e.target.value })} /></label>
          <label className="field" htmlFor="exTo">По<input id="exTo" type="date" value={custom.to} min={custom.from} onChange={e => setCustom({ ...custom, to: e.target.value })} /></label>
        </div>
      )}

      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <b style={{ fontSize: 13 }}>Що включити</b>
          <span className="row" style={{ gap: 12 }}>
            <button className="linkbtn" onClick={() => setOn(Object.fromEntries(SECTIONS.map(([k]) => [k, true])) as Record<SectionKey, boolean>)}>усе</button>
            <button className="linkbtn" onClick={() => setOn(Object.fromEntries(SECTIONS.map(([k]) => [k, false])) as Record<SectionKey, boolean>)}>нічого</button>
          </span>
        </div>
        <div className="checks">
          {SECTIONS.map(([k, l]) => (
            <label key={k} className={`check${on[k] ? ' on' : ''}`}>
              <input type="checkbox" checked={on[k]} onChange={e => setOn({ ...on, [k]: e.target.checked })} />
              <span className="box">{on[k] && <Icon n="check" />}</span>{l}
            </label>
          ))}
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="tabs" role="group" aria-label="Формат" style={{ flex: '0 1 auto' }}>
          <button aria-pressed={fmt === 'zip'} onClick={() => setFmt('zip')}>Таблиці для Excel (ZIP)</button>
          <button aria-pressed={fmt === 'json'} onClick={() => setFmt('json')}>JSON</button>
        </div>
        <button className="btn acc" disabled={busy || !picked} onClick={run}>{busy ? 'Готую…' : 'Завантажити звіт'}</button>
      </div>
    </div>
  );
}
