/** task: what the focus run was for (the task title), when one was picked. */
export type Session = { t: number; m: number; task?: string; demo?: 1 };
/** goal: id of the goal this task moves forward. */
/** due: date to finish by ('YYYY-MM-DD'), doneAt: when it was ticked off. */
export type Task = { id: number; t: string; p: 'hi' | 'lo'; d: boolean; goal?: number; due?: string; doneAt?: number; demo?: 1 };
export type LocalEvent = { id: number; date: string; s: string; e: string; title: string; c: string; demo?: 1 };
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
/** A logged activity (errands, commute, shop…). start/end are timestamps. */
export type Activity = { id: number; kind: string; title: string; start: number; end: number; demo?: 1 };
export type Note = { id: number; title: string; text: string; created: number; updated: number; pinned?: boolean; demo?: 1 };
export type GoalStep = { id: number; t: string; d: boolean };
/** A goal is measured either by a number (cur of target) or, when it has steps, by the share of steps done. */
/** kind 'rating': a goal for a life area that cannot be counted (relationships, rest): it is reached when the area's wheel rating
    climbs from `from` to `target`. Steps are the actions that get you there. */
export type Goal = { id: number; title: string; area: string; target: number; cur: number; unit: string; due: string; steps?: GoalStep[]; kind?: 'rating'; from?: number; demo?: 1 };
/** A day that is not a normal working day. The day score is judged more gently on it. */
export type OffKind = 'sick' | 'urgent' | 'rest' | 'trip';
export type DayOff = { kind: OffKind; note: string };
/** sid: start time of the session the current focus run is written to (0 when nothing is logged yet).
    dur: length in seconds of a run that is not the usual one (a short «just start» run); missing means the usual length. */
export type Timer = { mode: 'focus' | 'break'; left: number; running: boolean; endAt: number; task: string; sid?: number; dur?: number };
/** A daily meal that takes time out of the free hours. s/e are 'HH:MM'. */
export type Meal = { key: 'breakfast' | 'lunch' | 'dinner'; label: string; s: string; e: string; on: boolean };
/** Time on a social network or video platform. why: what it was for (learning, fun, news, work); cmp: afterwards you caught yourself comparing your life with other people's. */
export type SocialEntry = { id: number; date: string; platform: string; min: number; why?: string; cmp?: 1; demo?: 1 };
/** A habit to quit. start: when the current clean streak began; best: the longest streak that was ended by a slip; slips: when it went wrong.
    A slip restarts the streak but the best streak and the total of clean days stay, so progress is never lost. */
export type BadHabit = { id: number; name: string; start: number; best: number; slips: number[]; demo?: 1 };
/** A craving for a bad habit. trigger: what set it off (boredom, stress, social media…), outcome: held on or slipped, tool: what helped (exercise, breathing, game). */
export type Craving = { id: number; t: number; habit: number; trigger: string; outcome: 'resisted' | 'slipped'; tool?: string; demo?: 1 };
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
  sessions: Session[]; tasks: Task[]; events: LocalEvent[];
  timer: Timer;
  log: { t: number; msg: string }[]; unread: boolean; nextId: number;
  habits: Habit[]; health: Record<string, HealthDay>;
  goals: Goal[]; wheel: number[];
  view: string;
  /** The main things picked for one day (task ids). */
  plan: { date: string; ids: number[] };
  /** One line per day: what went well. */
  wins: Record<string, string>;
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
