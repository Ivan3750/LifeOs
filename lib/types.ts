export type Session = { t: number; m: number; demo?: 1 };
export type Task = { id: number; t: string; p: 'hi' | 'lo'; d: boolean; demo?: 1 };
export type LocalEvent = { id: number; date: string; s: string; e: string; title: string; c: string; demo?: 1 };
export type Habit = { id: number; name: string; days: Record<string, 1>; demo?: 1 };
/** One day, keyed by the date you woke up. bed/wake are 'HH:MM'; sleep hours are derived from them when both are set.
    mood and steps are kept only for data saved by older versions (mood is now logged in State.moods). */
export type HealthDay = { water: number; sleep: number; mood: number; steps: number; workout: number; weight: number; bed?: string; wake?: string; demo?: 1 };
export type HealthField = Exclude<keyof HealthDay, 'demo' | 'bed' | 'wake'>;
/** A mood check-in at a moment of the day. v: 1–10, energy: 1–5 (0 = not set). */
export type MoodEntry = { id: number; t: number; v: number; energy: number; tags: string[]; note: string; demo?: 1 };
/** Time spent on errands and other non-work things (shop, commute…). start/end are timestamps. */
export type Activity = { id: number; kind: string; title: string; start: number; end: number; demo?: 1 };
export type Note = { id: number; title: string; text: string; created: number; updated: number; pinned?: boolean; demo?: 1 };
export type Tx = { id: number; type: 'in' | 'out'; amt: number; cat: string; note: string; date: string; demo?: 1 };
export type Goal = { id: number; title: string; area: string; target: number; cur: number; unit: string; due: string; demo?: 1 };
export type Stage = 'lead' | 'talk' | 'proposal' | 'won' | 'lost';
export type Deal = { id: number; title: string; client: string; amt: number; stage: Stage; demo?: 1 };
export type Project = { id: number; name: string; client: string; due: string; progress: number; status: 'active' | 'paused' | 'done'; budget: number; demo?: 1 };
export type Invoice = { id: number; no: string; client: string; amt: number; issued: string; due: string; paid: boolean; paidAt: string; demo?: 1 };
export type Member = { id: number; name: string; role: string; load: number; demo?: 1 };
/** sid: start time of the session the current focus run is written to (0 when nothing is logged yet). */
export type Timer = { mode: 'focus' | 'break'; left: number; running: boolean; endAt: number; task: string; sid?: number };
/** A daily meal that takes time out of the free hours. s/e are 'HH:MM'. */
export type Meal = { key: 'breakfast' | 'lunch' | 'dinner'; label: string; s: string; e: string; on: boolean };
export type Mode = 'me' | 'co';
export type Theme = 'system' | 'light' | 'dark';

export type State = {
  v: 1;
  name: string; goal: number; focusMin: number; breakMin: number;
  demo: boolean; notes: string; theme: Theme;
  noteList: Note[]; moods: MoodEntry[];
  activities: Activity[]; act: { kind: string; title: string; start: number } | null;
  /** Waking day used to count free hours when no wake/bed time is logged. */
  dayStart: string; dayEnd: string;
  meals: Meal[];
  /** Work days Mon..Sun. Focus is expected only on these days; the weekly goal is split between them. */
  workDays: boolean[];
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
  /** Id of a logged activity (0 for the one still running). */
  act?: number;
};

/** Shape returned by /api/calendar. */
export type ExtEvent = { id: string; title: string; start: string; end: string; allDay: boolean; location?: string; src: number };
