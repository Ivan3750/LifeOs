'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ExtEvent, Mode, State, UiEvent } from './types';
import { makeState } from './seed';
import { DEFAULT_ACCOUNTS } from './money';
import { makeActions, goalStep } from './actions';
import { mergeStates } from './merge';
import { addD, hhmm, sod, ymd } from './util';
import { dayScore } from './score';

export { goalStep };

const KEY = 'pulse-os-next-v1';
const CAL_KEY = 'pulse-os-cal-cache';
const BASE_KEY = 'pulse-os-sync-base';
/** Browser storage holds about 5 MB; warn well before that. */
const SIZE_WARN = 3_500_000;
/** Parts of the state that belong to this device only: where you are, theme, notifications. They are never overwritten by another device. */
const LOCAL_KEYS = ['view', 'mode', 'theme', 'log', 'unread'] as const;
const keepLocal = (next: State, cur: State): State => { const o = { ...next } as Record<string, unknown>; for (const k of LOCAL_KEYS) o[k] = cur[k]; return o as State; };

export const VIEWS: [string, string, string][] = [
  ['home', 'Головна', 'home'], ['focus', 'Фокус', 'focus'], ['tasks', 'Задачі', 'tasks'], ['habits', 'Звички', 'habits'],
  ['health', 'Здоровʼя', 'health'], ['money', 'Фінанси', 'money'], ['goals', 'Цілі', 'goals'], ['schedule', 'Розклад', 'schedule'],
  ['notes', 'Нотатки', 'notes'], ['prefs', 'Налаштування', 'prefs'],
  ['co', 'Огляд', 'company'], ['leads', 'Клієнти', 'leads'], ['ads', 'Реклама', 'ads'], ['deals', 'Угоди', 'deals'], ['projects', 'Проєкти', 'projects'], ['invoices', 'Рахунки', 'invoice'], ['team', 'Команда', 'team'],
];
export const NAV: Record<Mode, string[]> = {
  me: ['home', 'focus', 'tasks', 'habits', 'health', 'money', 'goals', 'schedule', 'notes', 'prefs'],
  co: ['co', 'leads', 'deals', 'ads', 'projects', 'invoices', 'team', 'tasks', 'schedule', 'notes', 'prefs'],
};
export const TABS: Record<Mode, string[]> = { me: ['home', 'focus', 'tasks', 'money'], co: ['co', 'leads', 'deals', 'invoices'] };
const CO_ONLY = ['co', 'leads', 'ads', 'deals', 'projects', 'invoices', 'team'];
const ME_ONLY = ['home', 'focus', 'habits', 'health', 'money', 'goals'];
export const vinfo = (k: string) => VIEWS.find(x => x[0] === k);

export type ToastAction = { label: string; run: () => void };
/** init pre-fills form fields by key, e.g. { date, s, e } when adding an event at a picked time. */
export type Sheet = { kind: 'qa' } | { kind: 'more' } | { kind: 'form'; key: string; init?: Record<string, string> } | null;
export type CalStatus = { state: 'idle' | 'loading' | 'ok' | 'none' | 'error'; at?: number; errors?: string[]; count?: number };

const durOf = (s: State, m: 'focus' | 'break') => (m === 'focus' ? s.focusMin : s.breakMin) * 60;
const leftOf = (t: State['timer'], at = Date.now()) => (t.running ? Math.max(0, Math.round((t.endAt - at) / 1000)) : t.left);

/** Focus seconds already spent in the current run of the timer. */
export const focusSpent = (s: State, at = Date.now()) => (s.timer.mode === 'focus' ? Math.max(0, durOf(s, 'focus') - leftOf(s.timer, at)) : 0);

/** Writes the focus time spent so far into the session log. The same run keeps updating one session (timer.sid),
    so pausing, resuming and reloading the page never lose minutes or create duplicates. Returns logged minutes. */
export function logFocus(s: State, at = Date.now()): number {
  const sec = focusSpent(s, at), m = Math.round(sec / 60);
  if (m < 1) return 0;
  const cur = s.timer.sid ? s.sessions.find(x => x.t === s.timer.sid) : undefined;
  if (cur) { cur.m = m; if (s.timer.task) cur.task = s.timer.task; }
  else { const t = at - sec * 1000; s.sessions.push({ t, m, ...(s.timer.task ? { task: s.timer.task } : {}) }); s.timer.sid = t; }
  return m;
}

/** Session log including the minutes of a run that is still going. */
export function liveSessions(s: State, at = Date.now()) {
  const c = { ...s, sessions: s.sessions.map(x => ({ ...x })), timer: { ...s.timer } };
  logFocus(c, at);
  return c.sessions.map(x => (s.timer.running && x.t === c.timer.sid ? { ...x, live: true } : x));
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Makes data from storage or from the server safe to use: every field that has a default gets the same kind of value as the default
    (a list stays a list, a number a number); anything missing is filled in. Records inside the lists are not inspected. */
function coerce(base: unknown, v: unknown): unknown {
  if (Array.isArray(base)) return Array.isArray(v) ? v : base;
  if (isObj(base)) {
    if (!isObj(v)) return base;
    const keys = Object.keys(base);
    // an empty default is a keyed record (health by date…): accept it as it is
    if (!keys.length) return v;
    const out: Record<string, unknown> = { ...v };
    for (const k of keys) out[k] = k in v ? coerce(base[k], v[k]) : base[k];
    return out;
  }
  if (base === null) return v === null || isObj(v) ? v : base;
  return typeof v === typeof base && !(typeof v === 'number' && !Number.isFinite(v)) ? v : base;
}

/** Fills fields that were added in later versions and repairs values of the wrong kind. */
export function fill(s: State): State {
  if (!isObj(s)) return makeState(false);
  const base = makeState(false);
  const out = coerce(base, s) as State;
  // notes used to be a single text field: keep it as the first note of the list
  if (!Array.isArray(s.noteList)) {
    const text = (typeof s.notes === 'string' ? s.notes : '').trim();
    out.noteList = text ? [{ id: 1, title: 'Мої нотатки', text, created: Date.now(), updated: Date.now() }] : [];
    out.notes = '';
  }
  // money used to be one account in kroner: its budget moves onto the Danish account
  if (!Array.isArray(s.money?.accounts)) {
    out.money.accounts = DEFAULT_ACCOUNTS.map(a => (a.id === 'dk' ? { ...a, budget: s.money?.budget ?? a.budget } : { ...a }));
  }
  return out;
}

function load(): State {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
    if (raw) return fill(JSON.parse(raw) as State);
  } catch {
    // unreadable local copy: keep it aside for recovery and take the server copy instead of pushing a blank one over it
    try { if (raw) { localStorage.setItem(KEY + '-broken', raw); localStorage.setItem(SYNC_KEY, JSON.stringify({ version: -1, dirty: false })); } } catch {}
  }
  return makeState(true);
}

/* ---------- server sync bookkeeping ---------- */
const SYNC_KEY = 'pulse-os-sync';
type Meta = { version: number; dirty: boolean };
export type SyncStatus = { state: 'local' | 'syncing' | 'ok' | 'offline' | 'error'; at?: number; msg?: string };
const loadMeta = (): Meta => { try { const m = JSON.parse(localStorage.getItem(SYNC_KEY) || ''); if (typeof m?.version === 'number') return m; } catch {} return { version: 0, dirty: true }; };
const saveMeta = (m: Meta) => { try { localStorage.setItem(SYNC_KEY, JSON.stringify(m)); } catch {} };
/** The copy both sides last agreed on, kept while there are unsent changes so that a conflict can be merged instead of overwritten. */
const loadBase = (): State | null => { try { const t = localStorage.getItem(BASE_KEY); return t ? fill(JSON.parse(t)) : null; } catch { return null; } };
const saveBase = (s: State | null) => { try { if (s) localStorage.setItem(BASE_KEY, JSON.stringify(s)); else localStorage.removeItem(BASE_KEY); } catch {} };

/** Re-renders its component every `step` ms (when enabled). Kept out of the store so a ticking clock does not redraw the whole app. */
export function useNow(step = 1000, enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), step);
    const onShow = () => { if (document.visibilityState === 'visible') setNow(Date.now()); };
    document.addEventListener('visibilitychange', onShow);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onShow); };
  }, [step, enabled]);
  return now;
}
/** Seconds left on the timer at the moment `now`. */
export const timerLeftAt = (s: State, now: number) => leftOf(s.timer, now);

function replaceState(s: State, next: State) {
  for (const k of Object.keys(s)) delete (s as unknown as Record<string, unknown>)[k];
  Object.assign(s, next);
}

function useStoreValue(dbOn: boolean) {
  // The app is rendered on the client only (see ClientApp), so browser storage can be read during init.
  // opening a link like /#leads also switches to the mode that section belongs to
  const [S, setS] = useState<State>(() => {
    const s = load(), h = location.hash.slice(1), mode: Mode = CO_ONLY.includes(h) ? 'co' : ME_ONLY.includes(h) ? 'me' : s.mode;
    return mode === s.mode ? s : { ...s, mode };
  });
  const [view, setView] = useState(() => { const h = location.hash.slice(1); return vinfo(h) ? h : vinfo(S.view) ? S.view : 'home'; });
  const [toastMsg, setToast] = useState<{ msg: string; id: number; action?: ToastAction } | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [palette, setPalette] = useState(false);
  const [ext, setExt] = useState<ExtEvent[]>(() => { try { return JSON.parse(localStorage.getItem(CAL_KEY) || 'null')?.events || []; } catch { return []; } });
  const [cal, setCal] = useState<CalStatus>({ state: 'idle' });
  const toastT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!S) return;
    if (S.theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = S.theme;
  }, [S?.theme]); // eslint-disable-line react-hooks/exhaustive-deps

  const toast = useCallback((msg: string, action?: ToastAction) => {
    clearTimeout(toastT.current);
    setToast({ msg, id: Date.now(), action });
    toastT.current = setTimeout(() => setToast(null), action ? 7000 : 3200);
  }, []);

  /* ---------- the current state and its copy in the browser ----------
     Sref always holds the newest state, also in the middle of an event handler, so actions never work from a stale copy.
     The copy in localStorage is written after a short pause (and when the page is hidden), not on every keystroke. */
  const Sref = useRef(S);
  const saveT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const warned = useRef({ size: false, fail: false });
  const saveLocal = useCallback(() => {
    clearTimeout(saveT.current);
    try {
      const text = JSON.stringify(Sref.current);
      localStorage.setItem(KEY, text);
      if (text.length > SIZE_WARN && !warned.current.size) { warned.current.size = true; toast(`Дані займають ${(text.length / 1e6).toFixed(1)} МБ, а браузер дозволяє близько 5 МБ. Зроби експорт і видали старі записи`); }
    } catch {
      if (!warned.current.fail) { warned.current.fail = true; toast('Не вдалося зберегти дані в браузері (немає місця). Зроби експорт у Налаштуваннях'); }
    }
  }, [toast]);
  useEffect(() => { saveLocal(); }, [saveLocal]); // a first visit has no copy in the browser yet
  useEffect(() => {
    const flushLocal = () => { if (saveT.current) saveLocal(); };
    const onHide = () => { if (document.visibilityState === 'hidden') flushLocal(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushLocal);
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', flushLocal); };
  }, [saveLocal]);

  /* ---------- server sync ----------
     The whole state is one JSON document in MySQL with a version number.
     Local changes are saved after a short pause. A save based on an old version is refused by the server (409);
     then the changes of both devices are merged (see merge.ts) and saved again. */
  const [sync, setSync] = useState<SyncStatus>({ state: dbOn ? 'syncing' : 'local' });
  const [init] = useState(() => { const m = loadMeta(); return { m, b: m.dirty ? loadBase() : null }; });
  const meta = useRef<Meta>(init.m);
  const base = useRef<State | null>(init.b);
  const gen = useRef(0), pushing = useRef(false), pushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pushRef = useRef<(keepalive?: boolean) => void>(() => {});

  const setState = useCallback((s: State) => { Sref.current = s; setS(s); saveLocal(); }, [saveLocal]);

  /** Takes the server copy as the new truth. Position, theme and notifications of this device stay as they are. */
  const adopt = useCallback((data: State, version: number) => {
    setState(keepLocal(fill(data), Sref.current));
    meta.current = { version, dirty: false }; saveMeta(meta.current);
    base.current = null; saveBase(null);
    setSync({ state: 'ok', at: Date.now() });
  }, [setState]);

  const schedulePush = useCallback((ms = 800) => {
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => pushRef.current(), ms);
  }, []);

  const push = useCallback(async (keepalive = false) => {
    if (pushing.current) { schedulePush(500); return; }
    pushing.current = true;
    const g = gen.current, sent = Sref.current;
    setSync(s => ({ ...s, state: 'syncing' }));
    try {
      const res = await fetch('/api/state', { method: 'PUT', keepalive, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: sent, baseVersion: meta.current.version }) });
      if (res.status === 401) { location.reload(); return; }
      const j = await res.json();
      if (res.ok) {
        meta.current.version = j.version;
        if (g === gen.current) { meta.current.dirty = false; base.current = null; saveBase(null); }
        else { base.current = sent; saveBase(sent); }
        saveMeta(meta.current);
        setSync({ state: 'ok', at: Date.now() });
      } else if (res.status === 409) {
        if (j.data) {
          const remote = fill(j.data);
          if (base.current) {
            // both devices changed something: keep the changes of both
            setState(keepLocal(mergeStates(base.current as never, Sref.current as never, remote as never), Sref.current));
            meta.current = { version: j.version, dirty: true }; saveMeta(meta.current);
            base.current = remote; saveBase(remote);
            gen.current++;
            schedulePush(100);
            toast('Зміни з двох пристроїв обʼєднано');
          } else {
            adopt(j.data, j.version);
            toast('Дані змінено на іншому пристрої. Завантажено новішу версію');
          }
        } else { meta.current.version = 0; schedulePush(100); }
      } else {
        setSync({ state: 'error', at: Date.now(), msg: j.message || 'Сервер не зміг зберегти дані' });
        schedulePush(15000);
      }
    } catch {
      setSync({ state: 'offline', at: Date.now() });
      schedulePush(15000);
    } finally {
      pushing.current = false;
      if (meta.current.dirty && g !== gen.current) schedulePush();
    }
  }, [adopt, schedulePush, toast, setState]);
  useEffect(() => { pushRef.current = push; }, [push]);

  const pull = useCallback(async () => {
    if (meta.current.dirty || pushing.current) return;
    try {
      const res = await fetch('/api/state?v=' + meta.current.version, { cache: 'no-store' });
      if (res.status === 401) { location.reload(); return; }
      const j = await res.json();
      if (!res.ok) { setSync({ state: 'error', at: Date.now(), msg: j.message || 'База недоступна' }); return; }
      if (j.data && !meta.current.dirty) adopt(j.data, j.version);
      else setSync({ state: 'ok', at: Date.now() });
    } catch { setSync({ state: 'offline', at: Date.now() }); }
  }, [adopt]);

  // first contact with the server, then poll while the page is visible
  useEffect(() => {
    if (!dbOn) return;
    (async () => {
      try {
        const res = await fetch('/api/state', { cache: 'no-store' });
        if (res.status === 401) { location.reload(); return; }
        const j = await res.json();
        if (!res.ok) { setSync({ state: 'error', at: Date.now(), msg: j.message || 'База недоступна' }); return; }
        if (!j.data) { meta.current = { version: 0, dirty: true }; pushRef.current(); }
        else if (j.version === meta.current.version && meta.current.dirty) pushRef.current();
        else if (j.version !== meta.current.version && meta.current.dirty && base.current) {
          // changes made offline and a newer copy on the server: merge them
          const remote = fill(j.data);
          setState(keepLocal(mergeStates(base.current as never, Sref.current as never, remote as never), Sref.current));
          meta.current = { version: j.version, dirty: true }; saveMeta(meta.current);
          base.current = remote; saveBase(remote);
          gen.current++;
          pushRef.current();
          toast('Зміни з цього пристрою обʼєднано з даними з бази');
        }
        else if (j.version !== meta.current.version) adopt(j.data, j.version);
        else setSync({ state: 'ok', at: Date.now() });
      } catch { setSync({ state: 'offline', at: Date.now() }); }
    })();
    const t = setInterval(() => { if (document.visibilityState === 'visible') pull(); }, 15000);
    const onFocus = () => pull();
    const onHide = () => { if (document.visibilityState === 'hidden' && meta.current.dirty) { clearTimeout(pushTimer.current); pushRef.current(true); } };
    const onLeave = () => { if (meta.current.dirty) { clearTimeout(pushTimer.current); pushRef.current(true); } };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onLeave);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', onLeave); };
  }, [dbOn, adopt, pull, setState, toast]);

  const flush = useCallback(async () => { clearTimeout(pushTimer.current); if (meta.current.dirty) await push(); else await pull(); }, [push, pull]);

  /** Changes the state through fn (which edits a copy). local: the change concerns only this device, so it is not sent to the server. */
  const update = useCallback((fn: (s: State) => void, local = false) => {
    const prev = Sref.current, next = structuredClone(prev);
    fn(next);
    Sref.current = next;
    setS(next);
    clearTimeout(saveT.current);
    saveT.current = setTimeout(saveLocal, 300);
    if (dbOn && !local) {
      if (!meta.current.dirty) { base.current = prev; saveBase(prev); }
      gen.current++; meta.current.dirty = true; saveMeta(meta.current); schedulePush();
    }
  }, [dbOn, schedulePush, saveLocal]);

  /** A deletion that can be taken back: the toast offers «Скасувати», which restores what was removed and keeps later changes. */
  const del = useCallback((fn: (s: State) => void, msg = 'Видалено') => {
    const before = Sref.current;
    update(fn);
    const after = Sref.current;
    toast(msg, {
      label: 'Скасувати',
      run: () => update(s => { replaceState(s, keepLocal(mergeStates(after as never, before as never, s as never), s)); }),
    });
  }, [update, toast]);

  const notify = useCallback((msg: string) => {
    update(s => { s.log.unshift({ t: Date.now(), msg }); s.log = s.log.slice(0, 20); s.unread = true; }, true);
    toast(msg);
  }, [update, toast]);

  const go = useCallback((v: string) => {
    if (!vinfo(v)) v = 'home';
    setView(v);
    setSheet(null);
    update(s => { s.view = v; if (CO_ONLY.includes(v)) s.mode = 'co'; else if (ME_ONLY.includes(v)) s.mode = 'me'; }, true);
    try { history.replaceState(null, '', v === 'home' ? location.pathname : '#' + v); } catch {}
    window.scrollTo({ top: 0 });
  }, [update]);

  const setMode = useCallback((m: Mode) => go(m === 'co' ? 'co' : 'home'), [go]);

  /* ---------- timer ---------- */
  const beep = useCallback(() => {
    try {
      const a = audio.current || (audio.current = new AudioContext());
      [0, 0.25, 0.5].forEach(o => {
        const g = a.createGain(), os = a.createOscillator();
        os.frequency.value = 880; os.connect(g); g.connect(a.destination);
        g.gain.setValueAtTime(0.0001, a.currentTime + o);
        g.gain.exponentialRampToValueAtTime(0.2, a.currentTime + o + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + o + 0.2);
        os.start(a.currentTime + o); os.stop(a.currentTime + o + 0.22);
      });
    } catch {}
  }, []);

  const completeTimer = useCallback((skipped: boolean) => {
    const cur = Sref.current, T = cur.timer, at = Date.now();
    // a run that ran out while the page was closed ends at endAt, not at the moment the page was reopened
    const end = !skipped && T.running ? Math.min(at, T.endAt) : at;
    const done = logFocus(structuredClone(cur), end);
    update(s => {
      const t = s.timer;
      logFocus(s, end);
      t.mode = t.mode === 'focus' ? 'break' : 'focus';
      t.running = false; t.left = durOf(s, t.mode); t.sid = 0;
    });
    if (T.mode === 'focus' && done >= 1) notify(`Сесію фокусу завершено: ${done} хв${T.task ? ' · ' + T.task : ''}`);
    else if (T.mode === 'break' && !skipped) notify('Перерва скінчилась. Повертаємось до роботи');
    if (!skipped) beep();
  }, [update, notify, beep]);

  const toggleTimer = useCallback(() => {
    if (!audio.current) try { audio.current = new AudioContext(); } catch {}
    update(s => {
      const t = s.timer;
      if (t.running) { logFocus(s); t.left = leftOf(t); t.running = false; }
      else { t.running = true; t.endAt = Date.now() + t.left * 1000; }
    });
  }, [update]);

  /** Ends the current run early: the focus time spent so far stays in the log. */
  const stopRun = (s: State, mode: 'focus' | 'break') => {
    const m = logFocus(s);
    s.timer.mode = mode; s.timer.running = false; s.timer.left = durOf(s, mode); s.timer.sid = 0;
    return m;
  };
  const resetTimer = useCallback(() => {
    const cur = Sref.current;
    if (logFocus(structuredClone(cur)) >= 1) toast(`Зараховано ${Math.round(focusSpent(cur) / 60)} хв фокусу`);
    update(s => { stopRun(s, s.timer.mode); });
  }, [update, toast]);
  const setTimerMode = useCallback((m: 'focus' | 'break') => {
    const cur = Sref.current;
    if (cur.timer.mode !== m && logFocus(structuredClone(cur)) >= 1) toast(`Зараховано ${Math.round(focusSpent(cur) / 60)} хв фокусу`);
    update(s => { stopRun(s, m); });
  }, [update, toast]);

  /* ---------- calendar (iCal) ---------- */
  const urlsKey = S ? S.icalUrls.join('|') : null;
  const calAt = useRef(0);
  const refreshCal = useCallback(async () => {
    if (urlsKey === null) return;
    setCal(c => ({ ...c, state: 'loading' }));
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ urls: urlsKey ? urlsKey.split('|') : [], from: addD(sod(new Date()), -14).toISOString(), to: addD(sod(new Date()), 60).toISOString() }),
      });
      if (res.status === 401) { location.reload(); return; }
      const j = await res.json() as { configured: boolean; events: ExtEvent[]; errors: string[] };
      calAt.current = Date.now();
      setExt(j.events);
      setCal({ state: j.configured ? (j.errors.length && !j.events.length ? 'error' : 'ok') : 'none', at: Date.now(), errors: j.errors, count: j.events.length });
      try { localStorage.setItem(CAL_KEY, JSON.stringify({ events: j.events })); } catch {}
    } catch {
      setCal({ state: 'error', at: Date.now(), errors: ['Сервер календаря не відповідає. Перевір зʼєднання і що застосунок запущено.'] });
    }
  }, [urlsKey]);

  // refreshed every 10 minutes, but only while the page is visible; coming back to a stale page refreshes it at once
  useEffect(() => {
    if (urlsKey === null) return;
    const first = setTimeout(refreshCal, 300); // also debounces quick edits of the URL list
    const t = setInterval(() => { if (document.visibilityState === 'visible') refreshCal(); }, 10 * 60 * 1000);
    const onShow = () => { if (document.visibilityState === 'visible' && Date.now() - calAt.current > 10 * 60 * 1000) refreshCal(); };
    document.addEventListener('visibilitychange', onShow);
    return () => { clearTimeout(first); clearInterval(t); document.removeEventListener('visibilitychange', onShow); };
  }, [urlsKey, refreshCal]);

  /** Our events plus subscribed-calendar events for one day, sorted by time. All-day events come first. */
  const eventsOn = useCallback((date: string): UiEvent[] => {
    if (!S) return [];
    const mine: UiEvent[] = S.events.filter(e => e.date === date).map(e => ({ id: 'l' + e.id, localId: e.id, date: e.date, s: e.s, e: e.e, title: e.title, c: e.c }));
    const theirs: UiEvent[] = [];
    for (const x of ext) {
      const st = new Date(x.start), en = new Date(x.end);
      if (x.allDay) {
        // all-day events end on the (exclusive) next day
        const d0 = x.start.slice(0, 10), d1 = x.end.slice(0, 10);
        if (date >= d0 && date < d1) theirs.push({ id: 'x' + x.id + date, date, s: '00:00', e: '23:59', title: x.title, c: 'c4', ext: true, allDay: true, location: x.location });
      } else {
        // timed events also count on the following days they run into (night shifts, trips)
        const d0 = new Date(date + 'T00:00'), d1 = addD(d0, 1);
        if (st < d1 && en > d0) {
          theirs.push({ id: 'x' + x.id + date, date, s: st > d0 ? hhmm(st) : '00:00', e: en < d1 ? hhmm(en) : '23:59', title: x.title, c: 'c4', ext: true, location: x.location });
        }
      }
    }
    // errands and other logged activities take time too; the running one counts up to now
    const acts: UiEvent[] = [];
    const runs = S.act ? [{ id: 0, kind: S.act.kind, title: S.act.title, start: S.act.start, end: Date.now() }] : [];
    for (const a of [...S.activities, ...runs]) {
      const st = new Date(a.start), en = new Date(a.end);
      if (ymd(st) !== date) continue;
      acts.push({ id: 'a' + a.id, date, s: hhmm(st), e: ymd(en) === date ? hhmm(en) : '23:59', title: a.title ? `${a.kind}: ${a.title}` : a.kind, c: 'c2', act: a.id });
    }
    return [...mine, ...theirs, ...acts].sort((a, b) => Number(!a.allDay) - Number(!b.allDay) || a.s.localeCompare(b.s));
  }, [S, ext]);

  /** Day score (with its free-time numbers) for day k. Cached until the data changes, because the home page asks for ~20 of them per draw. */
  const scores = useRef<{ f: unknown; m: Map<string, ReturnType<typeof dayScore>> }>({ f: null, m: new Map() });
  const scoreOn = useCallback((k: string, at: number) => {
    if (scores.current.f !== eventsOn) scores.current = { f: eventsOn, m: new Map() };
    const t = Math.floor(at / 30_000) * 30_000, key = k + '|' + t;
    let r = scores.current.m.get(key);
    if (!r) { r = dayScore(S, k, eventsOn(k), liveSessions(S, t), t); scores.current.m.set(key, r); }
    return r;
  }, [S, eventsOn]);

  /* ---------- actions ---------- */
  const getS = useCallback(() => Sref.current, []);
  // getS only reads the ref when an action runs, never while rendering
  // eslint-disable-next-line react-hooks/refs
  const A = useMemo(() => makeActions({ update, getS, toast, notify, del }), [update, getS, toast, notify, del]);

  return {
    S, update, view, go, setMode, toastMsg, setToast, toast, notify,
    sheet, setSheet, palette, setPalette,
    toggleTimer, resetTimer, setTimerMode, completeTimer, durOf: (m: 'focus' | 'break') => (S ? durOf(S, m) : 0),
    ext, cal, refreshCal, eventsOn, scoreOn, A, sync, flush, dbOn,
  };
}

export type Store = ReturnType<typeof useStoreValue>;
const Ctx = createContext<Store | null>(null);

/** Ends a focus or break run when its time is up. It lives apart from the store so that only this piece ticks every second. */
function TimerWatcher() {
  const { S, completeTimer } = useStore();
  const running = S.timer.running, now = useNow(1000, running);
  const over = running && timerLeftAt(S, now) <= 0;
  const busy = useRef(false);
  useEffect(() => {
    if (over && !busy.current) { busy.current = true; completeTimer(false); }
    if (!running) busy.current = false;
  }, [over, running, completeTimer]);
  return null;
}

export function StoreProvider({ children, db }: { children: ReactNode; db: boolean }) {
  const v = useStoreValue(db);
  return <Ctx.Provider value={v}><TimerWatcher />{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}
