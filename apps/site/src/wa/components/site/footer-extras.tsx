import { contactHref, loginHref } from '../../config/site';

const chip =
  'inline-flex h-9 items-center gap-2 border border-[color-mix(in_srgb,var(--tsf-ink)_14%,transparent)] px-3 text-[13px] text-[var(--tsf-ink)] transition-colors duration-200 hover:border-[var(--tsf-accent)] hover:bg-[color-mix(in_srgb,var(--tsf-accent)_10%,transparent)]';

const LINKS = [
  { label: 'Écrire à l’équipe', href: contactHref },
  { label: 'Se connecter', href: loginHref },
] as const;

/** Sous les colonnes du pied de page : contact et connexion. */
export function FooterExtras() {
  return (
    <div className="grid gap-6 border-t border-[color-mix(in_srgb,var(--tsf-ink)_11%,transparent)] px-[clamp(12px,2.3cqw,32px)] py-[clamp(20px,2.4cqw,30px)]">
      <div className="flex flex-wrap items-center gap-2">
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} className={chip}>
            {l.label}
          </a>
        ))}
        <span className={`${chip} pointer-events-none`}>Programme officiel de chaque pays</span>
      </div>
    </div>
  );
}
