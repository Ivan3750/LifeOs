'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { NAV, TABS, useStore, vinfo } from '@/lib/store';
import { fmt, MON, pad2, WD } from '@/lib/util';
import { Icon, type IconName } from './Icon';
import { SheetHost } from './Sheets';
import { Palette } from './Palette';

export function ModeSeg() {
  const { S, setMode } = useStore();
  return (
    <div className="modeseg" role="group" aria-label="Режим">
      <button aria-pressed={S.mode !== 'co'} onClick={() => setMode('me')}>Особисте</button>
      <button aria-pressed={S.mode === 'co'} onClick={() => setMode('co')}>Компанія</button>
    </div>
  );
}

function NavBtn({ k }: { k: string }) {
  const { S, view, go } = useStore();
  const [, l, i] = vinfo(k)!;
  const open = S.tasks.filter(t => !t.d).length;
  return (
    <button onClick={() => go(k)} aria-current={k === view ? 'page' : undefined}>
      <Icon n={i as IconName} /><span className="nl">{l}</span>
      {k === 'tasks' && open > 0 && <span className="badge">{open}</span>}
    </button>
  );
}

function MiniTimer() {
  const { S, timerLeft, toggleTimer, go, durOf } = useStore();
  const T = S.timer, dur = durOf(T.mode);
  return (
    <div className="mini">
      <h4>{T.mode === 'focus' ? 'Один фокус.' : 'Пауза.'}<br /><em>{T.mode === 'focus' ? 'Більше справ.' : 'Більше сил.'}</em></h4>
      <p>{T.task || 'Обери задачу й запусти таймер.'}</p>
      <div className="big num">{fmt(timerLeft)}</div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="circ" onClick={toggleTimer} aria-label={T.running ? 'Пауза' : 'Старт'}><Icon n={T.running ? 'pause' : 'play'} /></button>
        <button className="circ ghost" onClick={() => go('focus')} aria-label="Відкрити фокус"><Icon n="arrow" /></button>
        <span style={{ fontSize: 11, color: '#E9D7CB', marginLeft: 4 }}>{Math.round((1 - timerLeft / dur) * 100)}%</span>
      </div>
    </div>
  );
}

function TopBar() {
  const { S, update, now, timerLeft, durOf, go, setPalette } = useStore();
  const [drop, setDrop] = useState(false);
  const n = new Date(now), T = S.timer;
  const showPill = T.running || timerLeft < durOf(T.mode);
  useEffect(() => {
    if (!drop) return;
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.drop,#bell')) setDrop(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [drop]);
  return (
    <div className="top">
      <span className="logo mlogo"><Icon n="logo" /></span>
      <div className="mslot"><ModeSeg /></div>
      <button className="search" onClick={() => setPalette(true)} aria-label="Відкрити пошук і команди">
        <Icon n="search" /><span className="lbl">Пошук чи команда…</span><kbd>Ctrl K</kbd>
      </button>
      <div className="spacer" />
      <div id="pillSlot">
        {showPill && <button className="pill" onClick={() => go('focus')}>{T.running ? <span className="dot" /> : <Icon n="pause" />}<span className="num">{fmt(timerLeft)}</span></button>}
      </div>
      <div className="clock"><span className="d">{WD[n.getDay()]}, {n.getDate()} {MON[n.getMonth()]} · </span><b>{pad2(n.getHours())}:{pad2(n.getMinutes())}</b></div>
      <div style={{ position: 'relative' }}>
        <button className="iconbtn" id="bell" aria-label="Сповіщення" onClick={() => { setDrop(d => !d); update(s => { s.unread = false; }); }}>
          <Icon n="bell" />{S.unread && <span className="ping" />}
        </button>
        {drop && (
          <div className="drop">
            {S.log.length ? S.log.slice(0, 8).map(l => {
              const t = new Date(l.t);
              return <div className="item" key={l.t}><span className="sw c1" /><span className="t">{l.msg}</span><span className="muted num" style={{ fontSize: 11 }}>{pad2(t.getHours())}:{pad2(t.getMinutes())}</span></div>;
            }) : <p className="muted" style={{ padding: 8, margin: 0 }}>Сповіщень поки немає. Тут зʼявляться завершені сесії та виграні угоди.</p>}
          </div>
        )}
      </div>
      <button className="me" onClick={() => go('prefs')} aria-label="Профіль">
        <span className="ava">{(S.name.trim()[0] || '?').toUpperCase()}</span>
        <span className="who"><b>{S.name}</b><small>{S.mode === 'co' ? S.co.name : 'Особистий простір'}</small></span>
      </button>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { S, view, toastMsg, setSheet, setPalette, sheet, palette } = useStore();
  const m = S.mode === 'co' ? 'co' : 'me';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(p => !p); }
      else if (e.key === 'Escape') { setPalette(false); setSheet(null); }
      else if (e.code === 'KeyN' && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(tag) && !sheet && !palette) { e.preventDefault(); setSheet({ kind: 'qa' }); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setPalette, setSheet, sheet, palette]);

  return (
    <>
      <div className="app">
        <aside className="side">
          <div className="brand"><span className="logo"><Icon n="logo" /></span>Pulse OS</div>
          <ModeSeg />
          <nav className="nav">{NAV[m].map(k => <NavBtn key={k} k={k} />)}</nav>
          <MiniTimer />
        </aside>
        <main>
          <TopBar />
          {children}
        </main>
      </div>
      <nav className="tabbar" aria-label="Основні розділи">
        {TABS[m].map(k => <NavBtn key={k} k={k} />)}
        <button onClick={() => setSheet({ kind: 'more' })} aria-current={TABS[m].includes(view) ? undefined : 'page'}><Icon n="more" /><span className="nl">Ще</span></button>
      </nav>
      <button className="fab" onClick={() => setSheet({ kind: 'qa' })} aria-label="Швидко додати"><Icon n="plus" /></button>
      <SheetHost />
      <Palette />
      {toastMsg && <div className="toast" role="status" key={toastMsg.id}>{toastMsg.msg}</div>}
    </>
  );
}
