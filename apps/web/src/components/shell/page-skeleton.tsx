import { Skeleton } from "@wema/ui/components/ui/skeleton";

/**
 * Squelette d'une page d'espace, affiché pendant le chargement (loading.tsx) :
 * sur-titre, titre, sous-titre, puis une rangée de cartes.
 */
export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-24 rounded-sm" />
        <Skeleton className="h-8 w-64 max-w-full rounded-md" />
        <Skeleton className="h-4 w-96 max-w-full rounded-sm" />
      </div>
      <Skeleton className="h-36 w-full rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: cartes factices, sans identité.
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
