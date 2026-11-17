import type { Goal, Need, State } from './types';
import type { NeedStat } from './needs';

/* Goals and needs are one thing seen from two sides: a goal is where you want to get, its needs are what you do every week to get there. */

export type GoalTemplate = { key: string; title: string; area: string; needs: string[]; hint: string };

/** Goals most people around a life like this one start with: each is tied to the needs it is made of. */
export const GOAL_TEMPLATES: GoalTemplate[] = [
  { key: 'fit', title: 'Бути в формі', area: 'Здоровʼя', needs: ['sport'], hint: 'Спорт щотижня' },
  { key: 'circle', title: 'Мати своє коло людей', area: 'Друзі', needs: ['people'], hint: 'Зустрічі, клуби, спільноти' },
  { key: 'love', title: 'Тепло у стосунках', area: 'Стосунки', needs: ['love'], hint: 'Час удвох щотижня' },
  { key: 'danish', title: 'Говорити данською', area: 'Розвиток', needs: ['danish'], hint: 'Трохи данської майже щодня' },
  { key: 'faith', title: 'Жити за вірою', area: 'Розвиток', needs: ['faith'], hint: 'Молитва, церква, спільнота' },
  { key: 'income', title: 'Дохід з WebHjerte', area: 'Карʼєра', needs: ['income'], hint: 'Робочі блоки, ліди, клієнти' },
  { key: 'balance', title: 'Відпочивати й пробувати нове', area: 'Відпочинок', needs: ['rest', 'new'], hint: 'Щоб не згоріти' },
];

/** The needs that make up a goal, with how much of this week's rhythm is done (0–1: every need counts the same, each capped at its target). */
export function rhythmOf(stats: NeedStat[], goal: number): { needs: NeedStat[]; share: number } {
  const needs = stats.filter(s => s.need.goal === goal);
  const share = needs.length ? needs.reduce((a, s) => a + Math.min(1, s.need.weekly ? s.done / s.need.weekly : 1), 0) / needs.length : 0;
  return { needs, share };
}

/** A goal that has no steps and no number is measured by its weekly rhythm alone. */
export const rhythmOnly = (g: Goal, hasNeeds: boolean) => hasNeeds && g.kind !== 'rating' && !g.steps?.length && !g.target;

/** Needs that belong to no goal. */
export const basicNeeds = (S: Pick<State, 'needs'>): Need[] => S.needs.filter(n => !n.goal);
