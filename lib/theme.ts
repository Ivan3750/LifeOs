/** Accent colours the person can pick. Everything that was orange follows the choice; the soft tint is mixed from it, so it works in light and dark. */
export const ACCENTS: Record<string, { name: string; a: string; b: string }> = {
  sun: { name: 'Сонце', a: '#FF5B1F', b: '#FF9A5C' },
  sea: { name: 'Море', a: '#2F7DE1', b: '#6FB0F5' },
  forest: { name: 'Ліс', a: '#2FA874', b: '#6CCB9C' },
  berry: { name: 'Ягода', a: '#7B5CE0', b: '#A590F0' },
  rose: { name: 'Троянда', a: '#E0568C', b: '#F28BB2' },
};

/** Puts the accent on the page (or takes it off for the default one). */
export function applyAccent(key?: string) {
  const el = document.documentElement.style, c = key && key !== 'sun' ? ACCENTS[key] : undefined;
  if (!c) { for (const p of ['--accent', '--accent-2', '--accent-soft']) el.removeProperty(p); return; }
  el.setProperty('--accent', c.a); el.setProperty('--accent-2', c.b);
  el.setProperty('--accent-soft', `color-mix(in srgb, ${c.a} 15%, var(--card))`);
}
