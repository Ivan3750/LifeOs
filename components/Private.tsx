'use client';

import { useState, type ReactNode } from 'react';
import { useStore } from '@/lib/store';

/** A row of tabs inside one section. */
export function TabRow<T extends string>({ tabs, value, onChange, label }: { tabs: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="tabrow" role="tablist" aria-label={label}>
      {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={k === value} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  );
}

/** Private text. With «Приховувати приватні тексти» on in the settings it stays blurred until it is tapped (a guard against onlookers, not encryption). */
export function PrivateText({ children }: { children: ReactNode }) {
  const { S } = useStore();
  const [shown, setShown] = useState(false);
  if (!S.ui.hideText || shown) return <>{children}</>;
  return (
    <span className="private-veil" role="button" tabIndex={0} title="Натисни, щоб показати" aria-label="Приватний текст, натисни, щоб показати"
      onClick={() => setShown(true)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShown(true); } }}>{children}</span>
  );
}

/** A dated record with a delete button, used by the personal sections. */
export function NoteCard({ meta, children, onDelete, label = 'Видалити запис' }: { meta: ReactNode; children: ReactNode; onDelete: () => void; label?: string }) {
  return (
    <div className="note">
      <div className="meta">{meta}<button className="ib" aria-label={label} title={label} onClick={onDelete}>×</button></div>
      {children}
    </div>
  );
}
