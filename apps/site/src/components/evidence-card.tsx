/**
 * Exemple de ligne du profil explicable : une affirmation, sa confiance, ses
 * preuves. C'est ce que voient le parent et le prof.
 */
export function EvidenceCard() {
  return (
    <figure className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <figcaption className="text-sm text-muted-foreground">
        Extrait du profil de Yanis, vu par ses parents
      </figcaption>
      <p className="mt-3 font-display text-xl font-semibold leading-snug">
        Confond encore l'aire et le périmètre quand la figure n'est pas un
        rectangle.
      </p>
      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-[8rem_1fr]">
        <dt className="text-muted-foreground">Confiance</dt>
        <dd>
          <span className="sr-only">Moyenne</span>
          <span aria-hidden="true" className="flex items-center gap-1.5">
            <span className="h-2 w-8 rounded-full bg-ink" />
            <span className="h-2 w-8 rounded-full bg-ink" />
            <span className="h-2 w-8 rounded-full bg-line-strong" />
            <span className="ml-1">Moyenne</span>
          </span>
        </dd>
        <dt className="text-muted-foreground">Preuves</dt>
        <dd>
          <ul className="space-y-1.5">
            <li>Exercice sur le trapèze : aire calculée comme un périmètre</li>
            <li>Photo de la copie du contrôle : même erreur à la question 3</li>
            <li>Mode « explique-moi » : bonne définition de l'aire</li>
          </ul>
        </dd>
        <dt className="text-muted-foreground">Source</dt>
        <dd>Réponses de Yanis, relues par son prof IA</dd>
      </dl>
    </figure>
  );
}
