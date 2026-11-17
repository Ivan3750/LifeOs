'use client';

/** A short burst of confetti that plays once when it appears. Mount it when something is completed; it removes itself visually, costs nothing and respects reduced motion. */
export function Burst({ n = 16 }: { n?: number }) {
  const colors = ['var(--accent)', 'var(--good)', 'var(--water)', 'var(--sleep)', 'var(--warn)'];
  return (
    <span className="burst" aria-hidden="true">
      {[...Array(n)].map((_, i) => {
        const a = (i / n) * 360 + (i % 2 ? 8 : -8), d = 60 + (i % 4) * 22;
        return <i key={i} style={{ ['--a' as string]: a + 'deg', ['--d' as string]: d + 'px', background: colors[i % colors.length], animationDelay: (i % 5) * 20 + 'ms' }} />;
      })}
    </span>
  );
}
