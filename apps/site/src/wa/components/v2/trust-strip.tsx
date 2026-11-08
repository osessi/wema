const STARS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return {
    x: Math.round((40 + 29 * Math.sin(a)) * 100) / 100,
    y: Math.round((40 - 29 * Math.cos(a)) * 100) / 100,
  };
});

function star(x: number, y: number, r: number): string {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.42;
    return `${Math.round((x + rr * Math.cos(a)) * 100) / 100},${Math.round((y + rr * Math.sin(a)) * 100) / 100}`;
  });
  return pts.join(' ');
}

export function GdprSeal({ className = 'h-16 w-16' }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} role="img" aria-label="Conforme au RGPD">
      <circle cx="40" cy="40" r="39" fill="#003399" />
      {STARS.map((s) => (
        <polygon key={`${s.x}-${s.y}`} points={star(s.x, s.y, 3.6)} fill="#FFCC00" />
      ))}
      <text
        x="40"
        y="44.5"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill="#FFFFFF"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        letterSpacing="0.5"
      >
        RGPD
      </text>
    </svg>
  );
}

function WinnerSeal({
  label,
  top,
  bottom,
  className = 'h-16 w-16',
}: {
  readonly label: string;
  readonly top: string;
  readonly bottom: string;
  readonly className?: string;
}) {
  return (
    <svg viewBox="0 0 80 80" className={className} role="img" aria-label={label}>
      <circle cx="40" cy="40" r="39" fill="#0D0E0B" />
      <circle cx="40" cy="40" r="33" fill="none" stroke="#ffc529" strokeWidth="1.2" />
      <polygon points={star(40, 22, 5)} fill="#ffc529" />
      {[top, bottom].map((line, i) => (
        <text
          key={line}
          x="40"
          y={42 + i * 12}
          textAnchor="middle"
          fontSize="9.5"
          fontWeight="800"
          fill="#FFFFFF"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          letterSpacing="0.4"
        >
          {line}
        </text>
      ))}
    </svg>
  );
}

const BADGE =
  'flex h-24 items-center justify-center border-[var(--tk-line)] px-6 grayscale-[0.15] transition-[filter] hover:grayscale-0';

export function TrustStrip() {
  return (
    <section aria-label="Nos engagements" className="px-5 pb-20 sm:px-8 sm:pb-28">
      <div className="mx-auto w-full max-w-[1160px]">
        <ul className="grid grid-cols-3 border-y border-[var(--tk-line)]">
          <li className={`${BADGE} border-r`}>
            <GdprSeal />
          </li>
          <li className={`${BADGE} border-r`}>
            <WinnerSeal label="Vous validez chaque contenu" top="VALIDÉ" bottom="PAR VOUS" />
          </li>
          <li className={BADGE}>
            <WinnerSeal
              label="Premier mois remboursé si vous n’êtes pas satisfait"
              top="1ER MOIS"
              bottom="REMBOURSÉ"
            />
          </li>
        </ul>
      </div>
    </section>
  );
}
