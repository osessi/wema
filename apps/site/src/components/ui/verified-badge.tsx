/**
 * Badge « vérifié » (forme festonnée, à la manière des comptes certifiés),
 * jaune Wema avec la coche sombre.
 */
function sealPath(bumps: number, outer: number, inner: number): string {
  const c = 12;
  const point = (r: number, a: number) =>
    `${(c + r * Math.cos(a)).toFixed(3)} ${(c + r * Math.sin(a)).toFixed(3)}`;
  const step = (Math.PI * 2) / bumps;
  let d = `M ${point(inner, -Math.PI / 2)}`;
  for (let i = 0; i < bumps; i += 1) {
    const a0 = -Math.PI / 2 + i * step;
    d += ` Q ${point(outer * 1.08, a0 + step / 2)} ${point(inner, a0 + step)}`;
  }
  return `${d} Z`;
}

const SEAL = sealPath(10, 11.2, 9.6);

export function VerifiedBadge({
  size = 18,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
    >
      <path d={SEAL} fill="#FFC529" />
      <path
        d="M7.6 12.3l3 3 5.9-6.3"
        fill="none"
        stroke="#1A1403"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
