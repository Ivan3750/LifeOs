'use client';

import { StoreProvider, useStore } from '@/lib/store';
import { Shell } from './Shell';
import { Home } from './views/Home';
import { Focus, Goals, Habits, Health, Notes, Schedule, Tasks } from './views/Personal';
import { Money } from './views/Money';
import { Ads, CoOverview, Deals, Invoices, Leads, Projects, Team } from './views/Company';
import { Prefs } from './views/Prefs';

const VIEW_COMPONENTS: Record<string, () => React.JSX.Element> = {
  home: Home, focus: Focus, tasks: Tasks, habits: Habits, health: Health, money: Money, goals: Goals,
  schedule: Schedule, notes: Notes, prefs: Prefs,
  co: CoOverview, leads: Leads, ads: Ads, deals: Deals, projects: Projects, invoices: Invoices, team: Team,
};

function Current() {
  const { view } = useStore();
  const V = VIEW_COMPONENTS[view] || Home;
  return <V key={view} />;
}

export default function App({ db }: { db: boolean }) {
  return (
    <StoreProvider db={db}>
      <Shell><Current /></Shell>
    </StoreProvider>
  );
}
