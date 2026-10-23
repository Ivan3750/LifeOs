'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ExtEvent, HealthField, Mode, State, UiEvent } from './types';
import { makeState } from './seed';
import { addD, hhmm, money, STAGES, sod, TK, toMin, ymd } from './util';

const KEY = 'pulse-os-next-v1';
const CAL_KEY = 'pulse-os-cal-cache';

export const VIEWS: [string, string, string][] = [
  ['home', 'Головна', 'home'], ['focus', 'Фокус', 'focus'], ['tasks', 'Задачі', 'tasks'], ['habits', 'Звички', 'habits'],
  ['health', 'Здоровʼя', 'health'], ['money', 'Фінанси', 'money'], ['goals', 'Цілі', 'goals'], ['schedule', 'Розклад', 'schedule'],
  ['notes', 'Нотатки', 'notes'], ['prefs', 'Налаштування', 'prefs'],
  ['co', 'Огляд', 'company'], ['deals', 'Угоди', 'deals'], ['projects', 'Проєкти', 'projects'], ['invoices', 'Рахунки', 'invoice'], ['team', 'Команда', 'team'],
];
export const NAV: Record<Mode, string[]> = {
  me: ['home', 'focus', 'tasks', 'habits', 'health', 'money', 'goals', 'schedule', 'notes', 'prefs'],
  co: ['co', 'deals', 'projects', 'invoices', 'team', 'tasks', 'schedule', 'notes', 'prefs'],
};
export const TABS: Record<Mode, string[]> = { me: ['home', 'focus', 'tasks', 'money'], co: ['co', 'deals', 'projects', 'invoices'] };
const CO_ONLY = ['co', 'deals', 'projects', 'invoices', 'team'];
const ME_ONLY = ['home', 'focus', 'habits', 'health', 'money', 'goals'];
export const vinfo = (k: string) => VIEWS.find(x => x[0] === k);

export type Sheet = { kind: 'qa' } | { kind: 'more' } | { kind: 'form'; key: string } | null;
export type CalStatus = { state: 'idle' | 'loading' | 'ok' | 'none' | 'error'; at?: number; errors?: string[]; count?: number };

const durOf = (s: State, m: 'focus' | 'break') => (m === 'focus' ? s.focusMin : s.breakMin) * 60;

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as State;
      // fill fields added in later versions
      const base = makeState(false);
      return { ...base, ...s, co: { ...base.co, ...s.co }, money: { ...base.money, ...s.money } };
    }
  } catch {}
  return makeState(true);
}

function useStoreValue() {
  // The app is rendered on the client only (see ClientApp), so browser storage can be read during init.
  const [S, setS] = useState<State>(load);
  const [view, setView] = useState(() => { const h = location.hash.slice(1); return vinfo(h) ? h : vinfo(S.view) ? S.view : 'home'; });
  const [now, setNow] = useState(() => Date.now());
  const [toastMsg, setToast] = useState<{ msg: string; id: number } | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [palette, setPalette] = useState(false);
  const [ext, setExt] = useState<ExtEvent[]>(() => { try { return JSON.parse(localStorage.getItem(CAL_KEY) || 'null')?.events || []; } catch { return []; } });
  const [cal, setCal] = useState<CalStatus>({ state: 'idle' });
  const toastT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    if (!S) return;
    if (S.theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = S.theme;
  }, [S?.theme]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback((fn: (s: State) => void) => {
    setS(prev => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      fn(next);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const toast = useCallback((msg: string) => {
    clearTimeout(toastT.current);
    setToast({ msg, id: Date.now() });
    toastT.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const notify = useCallback((msg: string) => {
    update(s => { s.log.unshift({ t: Date.now(), msg }); s.log = s.log.slice(0, 20); s.unread = true; });
    toast(msg);
  }, [update, toast]);

  const go = useCallback((v: string) => {
    if (!vinfo(v)) v = 'home';
    setView(v);
    setSheet(null);
    update(s => { s.view = v; if (CO_ONLY.includes(v)) s.mode = 'co'; else if (ME_ONLY.includes(v)) s.mode = 'me'; });
    try { history.replaceState(null, '', v === 'home' ? location.pathname : '#' + v); } catch {}
    window.scrollTo({ top: 0 });
  }, [update]);

  const setMode = useCallback((m: Mode) => go(m === 'co' ? 'co' : 'home'), [go]);

  /* ---------- timer ---------- */
  const timerLeft = S ? (S.timer.running ? Math.max(0, Math.round((S.timer.endAt - now) / 1000)) : S.timer.left) : 0;

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
    if (!S) return;
    const T = S.timer, dur = durOf(S, T.mode);
    const done = T.mode === 'focus' ? (skipped ? Math.round((dur - timerLeft) / 60) : dur / 60) : 0;
    update(s => {
      const t = s.timer;
      if (t.mode === 'focus') { if (done >= 1) s.sessions.push({ t: Date.now() - done * 6e4, m: done }); t.mode = 'break'; }
      else t.mode = 'focus';
      t.running = false; t.left = durOf(s, t.mode);
    });
    if (T.mode === 'focus' && done >= 1) notify(`Сесію фокусу завершено: ${done} хв${T.task ? ' · ' + T.task : ''}`);
    else if (T.mode === 'break' && !skipped) notify('Перерва скінчилась. Повертаємось до роботи');
    if (!skipped) beep();
  }, [S, timerLeft, update, notify, beep]);

  const completing = useRef(false);
  useEffect(() => {
    if (S?.timer.running && timerLeft <= 0 && !completing.current) {
      completing.current = true;
      completeTimer(false);
    }
    if (!S?.timer.running) completing.current = false;
  }, [S?.timer.running, timerLeft, completeTimer]);

  const toggleTimer = useCallback(() => {
    if (!audio.current) try { audio.current = new AudioContext(); } catch {}
    update(s => {
      const t = s.timer;
      if (t.running) { t.left = Math.max(0, Math.round((t.endAt - Date.now()) / 1000)); t.running = false; }
      else { t.running = true; t.endAt = Date.now() + t.left * 1000; }
    });
  }, [update]);

  const resetTimer = useCallback(() => update(s => { s.timer.running = false; s.timer.left = durOf(s, s.timer.mode); }), [update]);
  const setTimerMode = useCallback((m: 'focus' | 'break') => update(s => { s.timer.mode = m; s.timer.running = false; s.timer.left = durOf(s, m); }), [update]);

  /* ---------- calendar (iCal) ---------- */
  const urlsKey = S ? S.icalUrls.join('|') : null;
  const refreshCal = useCallback(async () => {
    if (urlsKey === null) return;
    setCal(c => ({ ...c, state: 'loading' }));
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ urls: urlsKey ? urlsKey.split('|') : [], from: addD(sod(new Date()), -14).toISOString(), to: addD(sod(new Date()), 60).toISOString() }),
      });
      const j = await res.json() as { configured: boolean; events: ExtEvent[]; errors: string[] };
      setExt(j.events);
      setCal({ state: j.configured ? (j.errors.length && !j.events.length ? 'error' : 'ok') : 'none', at: Date.now(), errors: j.errors, count: j.events.length });
      try { localStorage.setItem(CAL_KEY, JSON.stringify({ events: j.events })); } catch {}
    } catch {
      setCal({ state: 'error', at: Date.now(), errors: ['Сервер календаря не відповідає. Перевір, що застосунок запущено через npm run dev.'] });
    }
  }, [urlsKey]);

  useEffect(() => {
    if (urlsKey === null) return;
    const first = setTimeout(refreshCal, 300); // also debounces quick edits of the URL list
    const t = setInterval(refreshCal, 10 * 60 * 1000);
    return () => { clearTimeout(first); clearInterval(t); };
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
      } else if (ymd(st) === date) {
        theirs.push({ id: 'x' + x.id, date, s: hhmm(st), e: ymd(en) === date ? hhmm(en) : '23:59', title: x.title, c: 'c4', ext: true, location: x.location });
      }
    }
    return [...mine, ...theirs].sort((a, b) => Number(!a.allDay) - Number(!b.allDay) || a.s.localeCompare(b.s));
  }, [S, ext]);

  /* ---------- actions ---------- */
  const A = useMemo(() => {
    const hday = (s: State, k = TK()) => s.health[k] || (s.health[k] = { water: 0, sleep: 0, mood: 0, steps: 0, workout: 0, weight: 0 });
    const LIM: Record<HealthField, [number, number]> = { water: [0, 20], sleep: [0, 16], steps: [0, 80000], workout: [0, 600], weight: [0, 350], mood: [0, 5] };
    return {
      setH(f: HealthField, v: number) { update(s => { const h = hday(s); const [a, b] = LIM[f]; h[f] = Math.max(a, Math.min(b, Math.round(v * 10) / 10)); delete h.demo; }); },
      addH(f: HealthField, d: number) { update(s => { const h = hday(s); const [a, b] = LIM[f]; h[f] = Math.max(a, Math.min(b, Math.round((h[f] + d) * 10) / 10)); delete h.demo; }); },
      addTask(text: string, p: 'hi' | 'lo' = 'lo') { text = text.trim(); if (!text) return; update(s => { s.tasks.unshift({ id: s.nextId++, t: text, p, d: false }); }); toast('Задачу додано'); },
      toggleTask(id: number) { update(s => { const t = s.tasks.find(x => x.id === id); if (!t) return; t.d = !t.d; if (t.d && s.timer.task === t.t) s.timer.task = ''; }); },
      delTask(id: number) { update(s => { s.tasks = s.tasks.filter(x => x.id !== id); }); },
      addTx(type: 'in' | 'out', amt: number, cat: string, note: string, date: string) {
        if (!(amt > 0)) return;
        update(s => { s.money.tx.push({ id: s.nextId++, type, amt, cat, note: (note || '').trim(), date }); });
        toast((type === 'out' ? 'Витрату' : 'Дохід') + ' записано: ' + money(amt));
      },
      delTx(id: number) { update(s => { s.money.tx = s.money.tx.filter(x => x.id !== id); }); },
      addEvent(v: { title: string; date: string; s: string; e: string; c: string }) {
        if (toMin(v.e) <= toMin(v.s)) { toast('Кінець має бути пізніше за початок'); return false; }
        update(s => { s.events.push({ id: s.nextId++, ...v }); }); toast('Подію додано'); return true;
      },
      delEvent(id: number) { update(s => { s.events = s.events.filter(x => x.id !== id); }); },
      addHabit(name: string) { name = name.trim(); if (!name) return; update(s => { s.habits.push({ id: s.nextId++, name, days: {} }); }); toast('Звичку додано'); },
      toggleHabit(id: number, k = TK()) {
        if (!S) return;
        const willAllDone = k === TK() && S.habits.every(h => h.id === id ? !h.days[k] : h.days[k]);
        update(s => { const h = s.habits.find(x => x.id === id); if (!h) return; if (h.days[k]) delete h.days[k]; else h.days[k] = 1; });
        if (willAllDone) toast('Усі звички на сьогодні виконано!');
      },
      delHabit(id: number) { update(s => { s.habits = s.habits.filter(x => x.id !== id); }); },
      addNote(text: string) {
        const n = new Date();
        update(s => { s.notes = `${n.getDate()}.${n.getMonth() + 1}, ${hhmm(n)}\n${text}` + (s.notes ? '\n\n' + s.notes : ''); });
        toast('Нотатку збережено');
      },
      addGoal(v: { title: string; area: string; target: number; unit: string; due: string }) { update(s => { s.goals.push({ id: s.nextId++, cur: 0, ...v }); }); toast('Ціль додано'); },
      stepGoal(id: number, dir: number) {
        if (!S) return;
        const g = S.goals.find(x => x.id === id); if (!g) return;
        const step = goalStep(g.target), cur = Math.max(0, Math.round((g.cur + dir * step) * 100) / 100);
        update(s => { const x = s.goals.find(y => y.id === id)!; x.cur = cur; delete x.demo; });
        if (g.cur < g.target && cur >= g.target) notify('Ціль досягнуто: ' + g.title);
      },
      delGoal(id: number) { update(s => { s.goals = s.goals.filter(x => x.id !== id); }); },
      addDeal(v: { title: string; client: string; amt: number; stage: string }) { update(s => { s.co.deals.push({ id: s.nextId++, title: v.title, client: v.client, amt: v.amt || 0, stage: (v.stage || 'lead') as 'lead' }); }); toast('Угоду додано'); },
      moveDeal(id: number, dir: number) {
        if (!S) return;
        const d = S.co.deals.find(x => x.id === id); if (!d) return;
        const i = STAGES.findIndex(st => st[0] === d.stage), n = Math.max(0, Math.min(3, i + dir));
        if (n === i) return;
        const won = STAGES[n][0] === 'won';
        update(s => {
          const x = s.co.deals.find(y => y.id === id)!; x.stage = STAGES[n][0]; delete x.demo;
          if (won) { s.co.invSeq++; s.co.invoices.push({ id: s.nextId++, no: 'INV-' + String(s.co.invSeq).padStart(3, '0'), client: x.client || x.title, amt: x.amt, issued: TK(), due: ymd(addD(new Date(), 14)), paid: false, paidAt: '' }); }
        });
        if (won) notify(`Угоду виграно: ${d.title}. Рахунок створено автоматично`);
      },
      loseDeal(id: number) { update(s => { const x = s.co.deals.find(y => y.id === id); if (x) x.stage = 'lost'; }); toast('Угоду позначено як програну'); },
      addProject(v: { name: string; client: string; budget: number; due: string }) { update(s => { s.co.projects.push({ id: s.nextId++, ...v, budget: v.budget || 0, progress: 0, status: 'active' }); }); toast('Проєкт додано'); },
      setProgress(id: number, p: number) {
        if (!S) return;
        const pr = S.co.projects.find(x => x.id === id); if (!pr) return;
        update(s => { const x = s.co.projects.find(y => y.id === id)!; x.progress = p; delete x.demo; if (p >= 100) x.status = 'done'; else if (x.status === 'done') x.status = 'active'; });
        if (p >= 100 && pr.status !== 'done') notify('Проєкт завершено: ' + pr.name);
      },
      cycleProject(id: number) { update(s => { const x = s.co.projects.find(y => y.id === id); if (!x) return; x.status = ({ active: 'paused', paused: 'done', done: 'active' } as const)[x.status]; if (x.status === 'done') x.progress = 100; }); },
      delProject(id: number) { update(s => { s.co.projects = s.co.projects.filter(x => x.id !== id); }); },
      addInvoice(v: { client: string; amt: number; due: string }) {
        update(s => { s.co.invSeq++; s.co.invoices.push({ id: s.nextId++, no: 'INV-' + String(s.co.invSeq).padStart(3, '0'), client: v.client, amt: v.amt || 0, issued: TK(), due: v.due || ymd(addD(new Date(), 14)), paid: false, paidAt: '' }); });
        toast('Рахунок створено');
      },
      togglePaid(id: number) {
        if (!S) return;
        const i = S.co.invoices.find(x => x.id === id); if (!i) return;
        update(s => { const x = s.co.invoices.find(y => y.id === id)!; x.paid = !x.paid; x.paidAt = x.paid ? TK() : ''; });
        if (!i.paid) toast(`Оплату ${money(i.amt)} зараховано`);
      },
      delInvoice(id: number) { update(s => { s.co.invoices = s.co.invoices.filter(x => x.id !== id); }); },
      addMember(v: { name: string; role: string }) { update(s => { s.co.team.push({ id: s.nextId++, ...v, load: 50 }); }); toast('Учасника додано'); },
      setLoad(id: number, l: number) { update(s => { const m = s.co.team.find(x => x.id === id); if (m) m.load = l; }); },
      delMember(id: number) { update(s => { s.co.team = s.co.team.filter(x => x.id !== id); }); },
    };
  }, [S, update, toast, notify]);

  return {
    S, update, view, go, setMode, now, toastMsg, toast, notify,
    sheet, setSheet, palette, setPalette,
    timerLeft, toggleTimer, resetTimer, setTimerMode, completeTimer, durOf: (m: 'focus' | 'break') => (S ? durOf(S, m) : 0),
    ext, cal, refreshCal, eventsOn, A,
  };
}

export const goalStep = (target: number) => (target >= 200 ? Math.round(target / 20) : target >= 40 ? 5 : 1);

export type Store = ReturnType<typeof useStoreValue>;
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const v = useStoreValue();
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}
