import { describe, expect, it } from 'vitest';
import { makeActions } from '@/lib/actions';
import { makeState } from '@/lib/seed';
import { clientRows, leadHeat, leadScript } from '@/lib/clients';
import { ymd, addD } from '@/lib/util';
import type { State } from '@/lib/types';

function setup() {
  const S: State = makeState(false);
  const A = makeActions({ update: fn => fn(S), getS: () => S, toast: () => {}, notify: () => {}, del: fn => fn(S) });
  return { S, A };
}
const day = (n: number) => ymd(addD(new Date(), n));

describe('leads and clients', () => {
  it('a lead becomes a client once, with its details', () => {
    const { S, A } = setup();
    A.addLead({ name: 'Кавʼярня Zorya', contact: '@zorya', source: 'Instagram', value: 30000, next: day(1), note: 'просили кошторис' });
    const id = S.co.leads[0].id;
    A.leadToClient(id); A.leadToClient(id);
    expect(S.co.leads[0].status).toBe('won');
    expect(S.co.clients).toHaveLength(1);
    expect(S.co.clients[0]).toMatchObject({ name: 'Кавʼярня Zorya', contact: '@zorya', source: 'Instagram', lead: id });
  });
  it('converting to a deal also makes the client and does not duplicate it', () => {
    const { S, A } = setup();
    A.addLead({ name: 'FitLab', contact: '', source: 'Google', value: 80000, next: '', note: '' });
    A.leadToDeal(S.co.leads[0].id);
    expect(S.co.deals).toHaveLength(1);
    expect(S.co.deals[0].client).toBe('FitLab');
    expect(S.co.clients).toHaveLength(1);
    expect(A.addClient({ name: ' fitlab ', contact: '', source: 'Google', note: '' })).toBe(false);
  });
  it('adds up what each client brought, matching names loosely, and flags those who went quiet', () => {
    const { S } = setup();
    S.co.clients.push({ id: 1, name: 'FitLab', contact: '', source: 'Google', since: '2026-01-01', note: '' });
    S.co.invoices.push(
      { id: 2, no: 'INV-1', client: 'fitlab', amt: 1000, issued: day(-100), due: day(-90), paid: true, paidAt: day(-90) },
      { id: 3, no: 'INV-2', client: 'Shopik', amt: 500, issued: day(-5), due: day(5), paid: false, paidAt: '' },
    );
    S.co.deals.push({ id: 4, title: 'Лендінг', client: 'Shopik', amt: 2000, stage: 'proposal' });
    const rows = clientRows(S), fit = rows.find(r => r.name === 'FitLab')!, shop = rows.find(r => r.name === 'Shopik')!;
    expect(fit).toMatchObject({ card: true, revenue: 1000, unpaid: 0 });
    expect(fit.dormant).toBe(90);
    expect(shop).toMatchObject({ card: false, unpaid: 500, deals: 1, dormant: null });
  });
  it('rates how warm a lead is', () => {
    const base = { id: 1, name: 'A', contact: '', source: 'Google', value: 0, next: day(1), note: '', created: day(0) } as const;
    expect(leadHeat({ ...base, status: 'new' })).toBe('cold');
    expect(leadHeat({ ...base, status: 'replied' })).toBe('warm');
    expect(leadHeat({ ...base, status: 'meeting' })).toBe('hot');
    expect(leadHeat({ ...base, status: 'meeting', next: day(-10) })).toBe('warm');
    expect(leadHeat({ ...base, status: 'contacted', value: 50000 })).toBe('warm');
  });
  it('fills the person in a message', () => {
    expect(leadScript({ id: 1, name: 'Dr. Jensen, стоматологія', contact: '', source: '', status: 'new', value: 0, next: '', note: '', created: '' }, 'Іван')).toContain('Dr. Jensen!');
  });
});
