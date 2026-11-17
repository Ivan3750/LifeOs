/** task: what the focus run was for (the task title), when one was picked. */
export type Session = { t: number; m: number; task?: string; demo?: 1 };
/** goal: id of the goal this task moves forward. */
/** due: date to finish by ('YYYY-MM-DD'), doneAt: when it was ticked off. */
export type Task = { id: number; t: string; p: 'hi' | 'lo'; d: boolean; goal?: number; due?: string; doneAt?: number; demo?: 1 };
/** need: id of the need this event was planned for (a slot made by the week planner); ok: it was done, and the need got its mark. */
export type LocalEvent = { id: number; date: string; s: string; e: string; title: string; c: string; need?: number; ok?: 1; demo?: 1 };
export type Habit = { id: number; name: string; days: Record<string, 1>; demo?: 1 };
/** One day, keyed by the date you woke up. bed/wake are 'HH:MM'; sleep hours are derived from them when both are set.
    mood and steps are kept only for data saved by older versions (mood is now logged in State.moods). */
export type HealthDay = {
  water: number; sleep: number; mood: number; steps: number; workout: number; weight: number; bed?: string; wake?: string;
  /** Daytime sleep (a nap after lunch…): extra to the night. s/e are 'HH:MM' on the same day. */
  naps?: Nap[];
  demo?: 1;
};
export type Nap = { id: number; s: string; e: string };
export type HealthField = Exclude<keyof HealthDay, 'demo' | 'bed' | 'wake' | 'naps'>;
/** A mood check-in at a moment of the day. v: 1–10, energy: 1–5 (0 = not set). */
export type MoodEntry = { id: number; t: number; v: number; energy: number; tags: string[]; note: string; demo?: 1 };
/** Time spent on errands and other non-work things (shop, commute…). start/end are timestamps. */
export type Activity = { id: number; kind: string; title: string; start: number; end: number; demo?: 1 };
export type Note = { id: number; title: string; text: string; created: number; updated: number; pinned?: boolean; demo?: 1 };
export type Cur = 'DKK' | 'UAH';
export type AccId = 'dk' | 'ua';
/** A money account. opening: balance before the first record; budget: monthly spending budget in its currency. */
export type Account = { id: AccId; name: string; cur: Cur; opening: number; budget: number };
/** amt is in the currency of its account (acc, 'dk' for records saved before accounts existed).
    xfer links the two halves of a transfer between accounts; transfers are not income or spending. */
/** rec: id of the regular payment that created it, pot: id of the savings pot it feeds (a deposit leaves the account but is not spending). */
export type Tx = { id: number; type: 'in' | 'out'; amt: number; cat: string; note: string; date: string; acc?: AccId; xfer?: number; rec?: number; pot?: number; demo?: 1 };
/** A payment or income that repeats every month on `day` (29–31 means the last day of short months). from: first month it applies to ('YYYY-MM'). */
export type Recurring = { id: number; name: string; type: 'in' | 'out'; amt: number; cat: string; acc: AccId; day: number; from: string; active: boolean };
/** A savings pot. What is saved in it is worked out from the deposit records (Tx.pot), in kroner. */
export type Pot = { id: number; name: string; target: number; due: string };
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
/** A client: someone who has bought, or is about to. It grows out of a lead (lead: its id). What they bring is counted from deals, projects and invoices that carry the same name. */
export type Client = { id: number; name: string; contact: string; source: string; since: string; note: string; lead?: number; demo?: 1 };
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
/** Time on a social network or video platform. why: what it was for (learning, fun, news, work); cmp: afterwards you caught yourself comparing your life with other people's. */
export type SocialEntry = { id: number; date: string; platform: string; min: number; why?: string; cmp?: 1; demo?: 1 };
/** A habit to quit. start: when the current clean streak began; best: the longest streak that was ended by a slip; slips: when it went wrong.
    A slip restarts the streak but the best streak and the total of clean days stay, so progress is never lost. */
export type BadHabit = { id: number; name: string; start: number; best: number; slips: number[]; demo?: 1 };
/** A craving for a bad habit. trigger: what set it off (boredom, stress, social media…), outcome: held on or slipped, tool: what helped (exercise, breathing, game). */
export type Craving = { id: number; t: number; habit: number; trigger: string; outcome: 'resisted' | 'slipped'; tool?: string; demo?: 1 };
export type Mode = 'me' | 'co';
export type Theme = 'system' | 'light' | 'dark';

/** A need: something that goes hungry when it is missed (sport, people, something new, faith, rest…). weekly: how many times a week it should be met.
    min, from, to, days: how long one slot is and when in the day it suits (the week planner uses them).
    cat, kw, workout, machine: what is counted automatically (calendar events of that kind or with those words in the title, workouts logged in «Тіло», logged work on an income goal). */
export type Need = {
  id: number; key?: string; name: string; weekly: number; on: boolean;
  min: number; from: string; to: string; days: 'any' | 'weekend' | 'weekdays';
  cat?: string; kw?: string[]; workout?: boolean; machine?: boolean;
};
/** One time a need was met. src: how it was marked; ref: the touch, place or event it came from. */
export type NeedLog = { id: number; need: number; date: string; t: number; src?: 'manual' | 'daily' | 'plan' | 'people' | 'place'; ref?: number };
/** The daily minimum: movement and one new thing are ticked here (the person is a touch in the people list). */
export type DailyMark = { move?: 1; nov?: 1 };
/** Someone in your life. every: how often (days) you want to be in touch; next: what comes next, nextDate: when (if known). */
export type Person = { id: number; name: string; kind: 'friend' | 'family' | 'partner' | 'work'; every: number; next?: string; nextDate?: string };
/** A message or a meeting with a person. */
export type Touch = { id: number; person: number; date: string; kind: 'msg' | 'meet' };
/** A club or community. was: last time you were there, going: the day you go next. */
export type Place = { id: number; name: string; what: string; url?: string; was?: string; going?: string };
/** One day of work on a money goal: leads found, clients won, money received. */
export type MachineLog = { id: number; date: string; leads: number; clients: number; money: number };
/** A goal that is a sum of money (a car…): it is broken down into clients and leads per week.
    price: what one client brings, conv: share of leads that become clients (%), saved: what is already there. */
export type Machine = { id: number; title: string; target: number; saved: number; due: string; price: number; conv: number; url?: string; log: MachineLog[] };
/** The Sunday review of one week. ratings: need id → 1–5; focus: needs that get the first slots next week; accepted: suggestions taken. */
export type Review = { ratings: Record<string, number>; focus: number[]; accepted: string[]; done?: number };

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
  sessions: Session[]; tasks: Task[]; events: LocalEvent[];
  timer: Timer;
  log: { t: number; msg: string }[]; unread: boolean; nextId: number;
  habits: Habit[]; health: Record<string, HealthDay>;
  /** budget is kept only for data from before accounts; the budgets now live on the accounts.
      uahPerDkk: how many hryvnias one krone costs (from NBU or typed in), rateAt: when it was set. */
  /** budgetMode 'income': the month's allowance is the income of the month minus saveRate % (falls back to the fixed budgets while there is no income);
      catBudgets: limits per spending category, in kroner. */
  money: { budget: number; tx: Tx[]; accounts: Account[]; uahPerDkk: number; rateAt: number; rateSrc: 'nbu' | 'manual'; budgetMode: 'fixed' | 'income'; saveRate: number; catBudgets: Record<string, number>; recurring: Recurring[]; pots: Pot[] };
  goals: Goal[]; wheel: number[];
  mode: Mode; view: string;
  co: { name: string; goal: number; invSeq: number; deals: Deal[]; projects: Project[]; invoices: Invoice[]; team: Member[]; leads: Lead[]; clients: Client[]; ads: AdSpend[] };
  icalUrls: string[];
  /** Events of subscribed calendars that are hidden on this site only (the calendar itself is not touched). Keys are an occurrence id or a whole series id. */
  hiddenExt?: Record<string, 1>;
  /** What the events mean. evCats: exact (normalised) title → category; evWords: word stem → category → how often it was chosen. The app learns from both. */
  evCats: Record<string, string>; evWords: Record<string, Record<string, number>>;
  social: SocialEntry[];
  badHabits: BadHabit[]; cravings: Craving[];
  /** Daily limit in minutes per platform (0 = no limit). */
  socialGoals: Record<string, number>;
  /** Wanted bedtime and wake-up time: sleep is judged on keeping to them, not only on length. */
  bedTarget: string; wakeTarget: string;
  /** Needs and everything around them. needLog: each time a need was met; daily: the daily minimum by date; reviews: Sunday reviews by the Monday of the week. */
  needs: Need[]; needLog: NeedLog[]; daily: Record<string, DailyMark>; reviews: Record<string, Review>;
  people: Person[]; touches: Touch[]; places: Place[]; machines: Machine[];
};

/** Event as shown in the UI: either one of ours or one pulled from a subscribed calendar. */
export type UiEvent = {
  id: string; date: string; s: string; e: string; title: string; c: string;
  ext?: boolean; allDay?: boolean; location?: string; localId?: number;
  /** Id of a logged activity (0 for the one still running). */
  act?: number;
  /** A daytime sleep: the day it belongs to and its id. */
  nap?: number;
  /** For events from a subscribed calendar: the key of the whole series, and whether the series repeats within the loaded range. */
  series?: string; repeats?: boolean; extId?: string;
};

/** Shape returned by /api/calendar. */
/** series: the same for every occurrence of a repeating event. */
export type ExtEvent = { id: string; series?: string; title: string; start: string; end: string; allDay: boolean; location?: string; src: number };
