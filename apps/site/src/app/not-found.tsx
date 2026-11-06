import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <h1 className="text-4xl font-bold sm:text-5xl">
        Cette page n'existe pas.
      </h1>
      <p className="mt-4 max-w-prose text-lg text-muted-foreground">
        Le lien est peut-être ancien. Repartez de l'accueil.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-12 items-center rounded-xl bg-primary px-6 font-medium text-primary-foreground"
      >
        Revenir à l'accueil
      </Link>
    </section>
  );
}
