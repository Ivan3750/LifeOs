/** task: what the focus run was for (the task title), when one was picked. */
export type Session = { t: number; m: number; task?: string; demo?: 1 };
/** goal: id of the goal this task moves forward. */
/** due: date to finish by ('YYYY-MM-DD'), doneAt: when it was ticked off. */
export type Task = { id: number; t: string; p: 'hi' | 'lo'; d: boolean; goal?: number; due?: string; doneAt?: number; demo?: 1 };
export type LocalEvent = { id: number; date: string; s: string; e: string; title: string; c: string; demo?: 1 };
export type Habit = { id: number; name: string; days: Record<string, 1>; demo?: 1 };
/** One day, keyed by the date you woke up. bed/wake are 'HH:MM'; sleep hours are derived from them when both are set.
    mood and steps are kept only for data saved by older versions (mood is now logged in State.moods). */
export type HealthDay = { water: number; sleep: number; mood: number; steps: number; workout: number; weight: number; bed?: string; wake?: string; demo?: 1 };
export type HealthField = Exclude<keyof HealthDay, 'demo' | 'bed' | 'wake'>;
/** A mood check-in at a moment of the day. v: 1–10, energy: 1–5 (0 = not set). */
export type MoodEntry = { id: number; t: number; v: number; energy: number; tags: string[]; note: string; demo?: 1 };
/** Time spent on errands and other non-work things (shop, commute…). start/end are timestamps. */
/** A logged activity. For a Wolt shift: orders (number of deliveries), earned (kr., tips included) and km driven. */
export type Activity = { id: number; kind: string; title: string; start: number; end: number; orders?: number; earned?: number; km?: number; demo?: 1 };
export type Note = { id: number; title: string; text: string; created: number; updated: number; pinned?: boolean; demo?: 1 };
export type Cur = 'DKK' | 'UAH';
export type AccId = 'dk' | 'ua';
/** A money account. opening: balance before the first record; budget: monthly spending budget in its currency. */
export type Account = { id: AccId; name: string; cur: Cur; opening: number; budget: number };
/** amt is in the currency of its account (acc, 'dk' for records saved before accounts existed).
    xfer links the two halves of a transfer between accounts; transfers are not income or spending. */
/** shift: id of the Wolt shift (activity) this income came from, so deleting the shift removes it too. */
export type Tx = { id: number; type: 'in' | 'out'; amt: number; cat: string; note: string; date: string; acc?: AccId; xfer?: number; shift?: number; demo?: 1 };
export type GoalStep = { id: number; t: string; d: boolean };
/** A goal is measured either by a number (cur of target) or, when it has steps, by the share of steps done. */
/** kind 'rating': a goal for a life area that cannot be counted (relationships, rest): it is reached when the area's wheel rating
    climbs from `from` to `target`. Steps are the actions that get you there. */
export type Goal = { id: number; title: string; area: string; target: number; cur: number; unit: string; due: string; steps?: GoalStep[]; kind?: 'rating'; from?: number; demo?: 1 };
export type Stage = 'lead' | 'talk' | 'proposal' | 'won' | 'lost';
export type Deal = { id: number; title: string; client: string; amt: number; stage: Stage; demo?: 1 };
/** deal: the deal this project came from. */
export type Project = { id: number; name: string; client: string; due: string; progress: number; status: 'active' | 'paused' | 'done'; budget: number; deal?: number; demo?: 1 };
/** deal: the deal this invoice was created from, so winning it again does not bill twice. */
export type Invoice = { id: number; no: string; client: string; amt: number; issued: string; due: string; paid: boolean; paidAt: string; deal?: number; project?: number; demo?: 1 };
export type LeadStatus = 'new' | 'contacted' | 'replied' | 'meeting' | 'won' | 'dead';
/** A possible client. next: date of the next contact ('' when none planned); value: expected deal size in kr. */
export type Lead = { id: number; name: string; contact: string; source: string; status: LeadStatus; value: number; next: string; note: string; created: string; demo?: 1 };
/** Money spent on advertising in a channel on a date, in kr. */
export type AdSpend = { id: number; date: string; channel: string; amt: number; note: string; demo?: 1 };
/** A day that is not a normal working day. The day score is judged more gently on it. */
export type OffKind = 'sick' | 'urgent' | 'rest' | 'trip';
export type DayOff = { kind: OffKind; note: string };
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
  /** Take the day start, end and breakfast from logged sleep instead of dayStart/dayEnd (default on). */
  dayFromSleep?: boolean;
  meals: Meal[];
  /** Work days Mon..Sun. Focus is expected only on these days; the weekly goal is split between them. */
  workDays: boolean[];
  /** Days marked as not normal (sick, emergency…), keyed by date. */
  offDays?: Record<string, DayOff>;
  /** Daily goals for the body: glasses of water (default 8) and minutes of movement (default 30). */
  waterGoal?: number; moveGoal?: number;
  /** Weekly earnings goal for Wolt, in kr. (0 or missing: no goal). */
  woltGoal?: number;
  sessions: Session[]; tasks: Task[]; events: LocalEvent[];
  timer: Timer;
  log: { t: number; msg: string }[]; unread: boolean; nextId: number;
  habits: Habit[]; health: Record<string, HealthDay>;
  /** budget is kept only for data from before accounts; the budgets now live on the accounts.
      uahPerDkk: how many hryvnias one krone costs (from NBU or typed in), rateAt: when it was set. */
  money: { budget: number; tx: Tx[]; accounts: Account[]; uahPerDkk: number; rateAt: number; rateSrc: 'nbu' | 'manual' };
  goals: Goal[]; wheel: number[];
  mode: Mode; view: string;
  co: { name: string; goal: number; invSeq: number; deals: Deal[]; projects: Project[]; invoices: Invoice[]; team: Member[]; leads: Lead[]; ads: AdSpend[] };
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
