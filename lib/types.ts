export type Session = { t: number; m: number; demo?: 1 };
export type Task = { id: number; t: string; p: 'hi' | 'lo'; d: boolean; demo?: 1 };
export type LocalEvent = { id: number; date: string; s: string; e: string; title: string; c: string; demo?: 1 };
export type Habit = { id: number; name: string; days: Record<string, 1>; demo?: 1 };
export type HealthDay = { water: number; sleep: number; mood: number; steps: number; workout: number; weight: number; demo?: 1 };
export type HealthField = Exclude<keyof HealthDay, 'demo'>;
export type Tx = { id: number; type: 'in' | 'out'; amt: number; cat: string; note: string; date: string; demo?: 1 };
export type Goal = { id: number; title: string; area: string; target: number; cur: number; unit: string; due: string; demo?: 1 };
export type Stage = 'lead' | 'talk' | 'proposal' | 'won' | 'lost';
export type Deal = { id: number; title: string; client: string; amt: number; stage: Stage; demo?: 1 };
export type Project = { id: number; name: string; client: string; due: string; progress: number; status: 'active' | 'paused' | 'done'; budget: number; demo?: 1 };
export type Invoice = { id: number; no: string; client: string; amt: number; issued: string; due: string; paid: boolean; paidAt: string; demo?: 1 };
export type Member = { id: number; name: string; role: string; load: number; demo?: 1 };
/** sid: start time of the session the current focus run is written to (0 when nothing is logged yet). */
export type Timer = { mode: 'focus' | 'break'; left: number; running: boolean; endAt: number; task: string; sid?: number };
export type Mode = 'me' | 'co';
export type Theme = 'system' | 'light' | 'dark';

export type State = {
  v: 1;
  name: string; goal: number; focusMin: number; breakMin: number;
  demo: boolean; notes: string; theme: Theme;
  sessions: Session[]; tasks: Task[]; events: LocalEvent[];
  timer: Timer;
  log: { t: number; msg: string }[]; unread: boolean; nextId: number;
  habits: Habit[]; health: Record<string, HealthDay>;
  money: { budget: number; tx: Tx[] };
  goals: Goal[]; wheel: number[];
  mode: Mode; view: string;
  co: { name: string; goal: number; invSeq: number; deals: Deal[]; projects: Project[]; invoices: Invoice[]; team: Member[] };
  icalUrls: string[];
};

/** Event as shown in the UI: either one of ours or one pulled from a subscribed calendar. */
export type UiEvent = {
  id: string; date: string; s: string; e: string; title: string; c: string;
  ext?: boolean; allDay?: boolean; location?: string; localId?: number;
};

/** Shape returned by /api/calendar. */
export type ExtEvent = { id: string; title: string; start: string; end: string; allDay: boolean; location?: string; src: number };
