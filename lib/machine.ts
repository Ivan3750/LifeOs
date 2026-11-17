import type { Machine, MachineLog } from './types';
import { daysBetween, weekKeys } from './needs';
import { addD, DAY, sod, wStart, ymd } from './util';

/* A money goal broken down: the money needed → clients → leads → what to do this week. */

export const earned = (m: Machine, upTo?: string) => m.log.filter(l => !upTo || l.date <= upTo).reduce((a, l) => a + l.money, 0);

/** Share of leads that became clients, from what was really logged once there are enough leads to say; otherwise what was guessed. */
export function convOf(m: Machine): { pct: number; real: boolean } {
  const leads = m.log.reduce((a, l) => a + l.leads, 0), clients = m.log.reduce((a, l) => a + l.clients, 0);
  return leads >= 10 ? { pct: Math.max(1, Math.min(100, Math.round((clients / leads) * 100))), real: true } : { pct: Math.max(1, Math.min(100, m.conv || 20)), real: false };
}

export type MachinePlan = {
  /** Money still missing at the start of this week. */
  left: number;
  weeksLeft: number;
  /** What the whole way takes from the start of this week: clients, leads. */
  clients: number; leads: number;
  /** The weekly target. */
  perWeek: { leads: number; clients: number; money: number };
  /** What was done this week. */
  week: { leads: number; clients: number; money: number };
  /** Share of this week's work that is done, 0–1 (leads and clients count the same). */
  share: number;
  conv: { pct: number; real: boolean };
  /** Money missing right now. */
  now: number;
  done: boolean;
};

/** The plan for the week that contains `at`. The weekly target is fixed at the start of the week, so doing the work does not move the goalposts. */
export function machinePlan(m: Machine, at = new Date()): MachinePlan {
  const ws = wStart(at), keys = weekKeys(ws);
  const before = ymd(addD(ws, -1)), price = Math.max(1, m.price || 1), conv = convOf(m);
  const week = m.log.filter(l => keys.includes(l.date)).reduce((a, l) => ({ leads: a.leads + l.leads, clients: a.clients + l.clients, money: a.money + l.money }), { leads: 0, clients: 0, money: 0 });
  const left = Math.max(0, m.target - m.saved - earned(m, before));
  const weeksLeft = m.due ? Math.max(1, Math.ceil((sod(new Date(m.due + 'T00:00')).getTime() - ws.getTime() + DAY) / (7 * DAY))) : 1;
  const clients = Math.ceil(left / price), leads = Math.ceil(clients / (conv.pct / 100));
  const perWeek = { leads: Math.ceil(leads / weeksLeft), clients: Math.ceil(clients / weeksLeft), money: Math.ceil(left / weeksLeft) };
  const parts = [perWeek.leads ? Math.min(1, week.leads / perWeek.leads) : 1, perWeek.clients ? Math.min(1, week.clients / perWeek.clients) : 1];
  const now = Math.max(0, m.target - m.saved - earned(m));
  return { left, weeksLeft, clients, leads, perWeek, week, share: left <= 0 ? 1 : (parts[0] + parts[1]) / 2, conv, now, done: now <= 0 };
}

export const logOn = (m: Machine, k: string): MachineLog | undefined => m.log.find(l => l.date === k);
export const daysLeft = (m: Machine, today = ymd(new Date())) => (m.due ? daysBetween(today, m.due) : null);
