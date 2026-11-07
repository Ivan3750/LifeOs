'use client';

import { GROUPS, parentOf, StoreProvider, TAB_LABEL, useStore } from '@/lib/store';
import { Shell } from './Shell';
import { PinGate } from './PinLock';
import { Home } from './views/Home';
import { Focus } from './views/Focus';
import { TimePage } from './views/Time';
import { CoachPage } from './views/Coach';
import { QuitPage } from './views/Quit';
import { Goals } from './views/Goals';
import { Habits } from './views/Habits';
import { Health } from './views/Health';
import { Notes } from './views/Notes';
import { Schedule } from './views/Schedule';
import { Tasks } from './views/Tasks';
import { WoltPage } from './views/Wolt';
import { Money } from './views/Money';
import { Ads, Clients, CoOverview, Deals, Invoices, Leads, Projects, Team } from './views/Company';
import { Prefs } from './views/Prefs';

const VIEW_COMPONENTS: Record<string, () => React.JSX.Element> = {
  home: Home, focus: Focus, time: TimePage, coach: CoachPage, quit: QuitPage, tasks: Tasks, habits: Habits, health: Health, money: Money, wolt: WoltPage, goals: Goals,
  schedule: Schedule, notes: Notes, prefs: Prefs,
  co: CoOverview, leads: Leads, clients: Clients, ads: Ads, deals: Deals, projects: Projects, invoices: Invoices, team: Team,
};

/** Related sections share one menu entry and switch between each other here: tasks and goals, habits and habits to quit, advice and time use. */
function SubTabs() {
  const { S, view, go } = useStore();
  const group = S.mode === 'co' ? undefined : GROUPS[parentOf(view)];
  if (!group || !group.includes(view)) return null;
  return (
    <div className="subtabs" role="tablist">
      {group.map(k => <button key={k} role="tab" aria-selected={k === view} onClick={() => go(k)}>{TAB_LABEL[k]}</button>)}
    </div>
  );
}

function Current() {
  const { view } = useStore();
  const V = VIEW_COMPONENTS[view] || Home;
  return <><SubTabs /><V key={view} /></>;
}

export default function App({ db }: { db: boolean }) {
  return (
    <StoreProvider db={db}>
      <PinGate><Shell><Current /></Shell></PinGate>
    </StoreProvider>
  );
}
