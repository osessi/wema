export function HeroTrustLine({ dark = false }: { readonly dark?: boolean } = {}) {
  const dot = `size-[4px] rotate-45 ${dark ? 'bg-[#0D0E0B]/35' : 'bg-white/35'}`;
  return (
    <ul
      aria-label="Nos engagements"
      className={`flex flex-wrap items-center gap-x-3.5 gap-y-2 font-mono text-[10.5px] tracking-[0.06em] uppercase lg:justify-end ${dark ? 'text-[#0D0E0B]/65' : 'text-white/65'}`}
    >
      <li>Jamais la réponse</li>
      <li aria-hidden="true" className={dot} />
      <li>Calculs vérifiés</li>
      <li aria-hidden="true" className={dot} />
      <li>Programmes officiels</li>
    </ul>
  );
}
