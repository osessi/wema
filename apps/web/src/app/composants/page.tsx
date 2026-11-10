import type { Metadata } from "next";
import { Showcase } from "./_components/showcase";

// Vitrine des composants de @wema/ui : publique (aucun appel à l'API, donc
// aucune session demandée), données fictives, jamais indexée.
export const metadata: Metadata = {
  title: "Composants · Wema",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <Showcase />;
}
