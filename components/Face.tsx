import { moodColor } from '@/lib/score';

/** A round face for a mood of 1–10 (five looks), tinted with the mood colour. */
export function Face({ v, size = 40, ring = false }: { v: number; size?: number; ring?: boolean }) {
  const lvl = Math.min(5, Math.max(1, Math.ceil(v / 2)));
  const mouth = ['M8 17.6Q12 13.4 16 17.6', 'M8.6 16.8Q12 14.6 15.4 16.8', 'M9 16.2H15', 'M8.6 14.8Q12 17.8 15.4 14.8', 'M7.8 13.8Q12 20 16.2 13.8Z'][lvl - 1];
  const happyEyes = lvl >= 4;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="face">
      <circle cx="12" cy="12" r="11" fill={moodColor(v)} stroke={ring ? 'var(--ink)' : 'none'} strokeWidth="1.5" />
      {happyEyes
        ? <path d="M7.4 10.2q1.6-2 3.2 0M13.4 10.2q1.6-2 3.2 0" fill="none" stroke="#1b1612" strokeWidth="1.6" strokeLinecap="round" />
        : <><circle cx="9" cy="10" r="1.4" fill="#1b1612" /><circle cx="15" cy="10" r="1.4" fill="#1b1612" /></>}
      <path d={mouth} fill={lvl === 5 ? '#1b1612' : 'none'} stroke="#1b1612" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
