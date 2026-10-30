const S = (size: number, body: string, attrs = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" ${attrs}>${body}</svg>`;

const I = {
  logo: S(16, '<path d="M6 20V11a6 6 0 0 1 12 0v9"/>', 'fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"'),
  home: S(18, '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>'),
  focus: S(18, '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>'),
  tasks: S(18, '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 9 2 2 4-4M8 16h8"/>'),
  schedule: S(18, '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  notes: S(18, '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>'),
  prefs: S(18, '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.2 19.8l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.3 14H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.2 7.2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 20.9 10H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>'),
  search: S(16, '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"'),
  bell: S(18, '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a2 2 0 0 0 3.4 0"/>'),
  arrow: S(15, '<path d="M5 12h14M13 6l6 6-6 6"/>', 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"'),
  left: S(14, '<path d="m15 6-6 6 6 6"/>', 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"'),
  right: S(14, '<path d="m9 6 6 6-6 6"/>', 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"'),
  cap: S(40, '<path d="M12 3 1 9l11 6 9-4.9V17h2V9z"/><path d="M5 13.2v4L12 21l7-3.8v-4L12 17z"/>', 'fill="#fff"'),
  clock: S(18, '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  wave: S(18, '<path d="M3 12h4l2-6 4 12 2-6h6"/>'),
  map: S(18, '<path d="M4 6v14l5-2 6 2 5-2V4l-5 2-6-2z"/><path d="M9 4v14M15 6v14"/>'),
  trend: S(18, '<path d="m3 17 6-6 4 4 8-8M15 7h6v6"/>'),
  trophy: S(20, '<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8"/>'),
  flame: S(16, '<path d="M12 2s5 4.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 1-3.5s.5 2.5 2.5 2.5C10 8 12 2 12 2z"/>', 'fill="currentColor"'),
  play: S(14, '<path d="M7 4v16l13-8z"/>', 'fill="currentColor"'),
  pause: S(14, '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>', 'fill="currentColor"'),
  check: S(13, '<path d="m5 12 5 5 9-10"/>', 'fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"'),
  x: S(16, '<path d="M6 6l12 12M18 6 6 18"/>', 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"'),
  habits: S(18, '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5M8 12l3 3 5-6"/>'),
  health: S(18, '<path d="M12 20s-8-4.6-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.4 12 20 12 20z"/><path d="M7 12h3l1.5-2 2 4 1.5-2h2"/>'),
  money: S(18, '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2M6 6V5a2 2 0 0 1 2-2h9"/>'),
  goals: S(18, '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>'),
  life: S(18, '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  company: S(18, '<path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M2 21h20M8 8h3M8 12h3M8 16h3"/>'),
  leads: S(18, '<circle cx="10" cy="8" r="4"/><path d="M2.5 20a7.5 7.5 0 0 1 15 0M19 8v6M16 11h6"/>'),
  ads: S(18, '<path d="M3 10v4a1 1 0 0 0 1 1h3l8 4V5L7 9H4a1 1 0 0 0-1 1zM19 9a4 4 0 0 1 0 6"/>'),
  deals: S(18, '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>'),
  projects: S(18, '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  invoice: S(18, '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>'),
  team: S(18, '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>'),
  more: S(18, '<circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>', 'fill="currentColor"'),
  plus: S(22, '<path d="M12 5v14M5 12h14"/>', 'fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"'),
  refresh: S(16, '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>', 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'),
  pin: S(16, '<path d="M9 4h6l-1 6 4 3v2H6v-2l4-3zM12 15v6"/>'),
  edit: S(16, '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  trash: S(16, '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>'),
  star: S(16, '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'),
  flag: S(14, '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
  link: S(16, '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
};

export type IconName = keyof typeof I;
export const svg = (n: IconName) => I[n];

export function Icon({ n, className, style }: { n: IconName; className?: string; style?: React.CSSProperties }) {
  return <span className={className ?? 'icn'} style={style} aria-hidden="true" dangerouslySetInnerHTML={{ __html: I[n] }} />;
}
