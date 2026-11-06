import { appLinks } from "../lib/site";

/** L'action principale du site : une seule par écran. */
export function PrimaryCta({
  label = "Commencer l'essai gratuit",
  href = appLinks.signup,
}: {
  label?: string;
  href?: string;
}) {
  return (
    <a
      href={href}
      className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-6 font-medium text-primary-foreground transition-colors hover:bg-ink/85"
    >
      {label}
    </a>
  );
}

/** Bloc de fin de page : une phrase, l'action principale, la connexion. */
export function ClosingCta({ title, text }: { title: string; text: string }) {
  return (
    <section className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <h2 className="max-w-2xl text-3xl font-bold sm:text-4xl">{title}</h2>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">{text}</p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
          <PrimaryCta />
          <a
            href={appLinks.login}
            className="font-medium underline decoration-line-strong underline-offset-4 hover:decoration-ink"
          >
            J'ai déjà un compte
          </a>
        </div>
      </div>
    </section>
  );
}
