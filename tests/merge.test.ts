import { describe, expect, it } from 'vitest';
import { mergeStates } from '@/lib/merge';

type S = { nextId: number; tasks: { id: number; t: string; d: boolean }[]; habits: { id: number; days: Record<string, 1> }[]; name: string; timer: { left: number; running: boolean } };
const base = (): S => ({ nextId: 10, tasks: [{ id: 1, t: 'a', d: false }, { id: 2, t: 'b', d: false }], habits: [{ id: 5, days: { '2026-01-01': 1 } }], name: 'x', timer: { left: 1500, running: false } });
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe('mergeStates', () => {
  it('keeps an item added on each device', () => {
    const l = clone(base()), r = clone(base());
    l.tasks.push({ id: 10, t: 'local', d: false }); l.nextId = 11;
    r.tasks.push({ id: 11, t: 'remote', d: false }); r.nextId = 12;
    const m = mergeStates(base(), l, r);
    expect(m.tasks.map(t => t.t).sort()).toEqual(['a', 'b', 'local', 'remote']);
    expect(m.nextId).toBe(12);
  });

  it('gives a new id to a local record that collides with a different remote one', () => {
    const l = clone(base()), r = clone(base());
    l.tasks.push({ id: 10, t: 'local', d: false }); l.nextId = 11;
    r.tasks.push({ id: 10, t: 'remote', d: false }); r.nextId = 11;
    const m = mergeStates(base(), l, r);
    expect(m.tasks).toHaveLength(4);
    expect(new Set(m.tasks.map(t => t.id)).size).toBe(4);
    expect(m.nextId).toBeGreaterThan(Math.max(...m.tasks.map(t => t.id)));
  });

  it('applies a local edit and a remote edit of different items', () => {
    const l = clone(base()), r = clone(base());
    l.tasks[0].d = true; r.tasks[1].t = 'B!';
    const m = mergeStates(base(), l, r);
    expect(m.tasks).toEqual([{ id: 1, t: 'a', d: true }, { id: 2, t: 'B!', d: false }]);
  });

  it('keeps a local deletion unless the other device changed the item', () => {
    const l = clone(base()), r = clone(base());
    l.tasks = l.tasks.filter(t => t.id !== 1 && t.id !== 2);
    r.tasks[1].t = 'edited elsewhere';
    const m = mergeStates(base(), l, r);
    expect(m.tasks).toEqual([{ id: 2, t: 'edited elsewhere', d: false }]);
  });

  it('keeps a remote deletion', () => {
    const l = clone(base()), r = clone(base());
    r.tasks = r.tasks.filter(t => t.id !== 1);
    expect(mergeStates(base(), l, r).tasks.map(t => t.id)).toEqual([2]);
  });

  it('merges keyed records such as habit days', () => {
    const l = clone(base()), r = clone(base());
    l.habits[0].days['2026-01-02'] = 1;
    r.habits[0].days['2026-01-03'] = 1;
    expect(Object.keys(mergeStates(base(), l, r).habits[0].days).sort()).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
  });

  it('lets local win when both changed the same value, and keeps the timer whole', () => {
    const l = clone(base()), r = clone(base());
    l.name = 'local'; r.name = 'remote';
    l.timer = { left: 100, running: true }; r.timer = { left: 900, running: false };
    const m = mergeStates(base(), l, r);
    expect(m.name).toBe('local');
    expect(m.timer).toEqual({ left: 100, running: true });
  });

  it('takes the remote value when only the remote changed', () => {
    const l = clone(base()), r = clone(base());
    r.name = 'remote';
    expect(mergeStates(base(), l, r).name).toBe('remote');
  });
});
