import Link from "next/link";

/** Le carré jaune « W » de l'application, suivi du nom. */
export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 rounded-md"
      aria-label="Wema, accueil"
    >
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-lg bg-brand font-display text-lg font-bold text-ink-on-brand"
      >
        W
      </span>
      <span className="font-display text-xl font-bold tracking-tight">
        Wema
      </span>
    </Link>
  );
}
