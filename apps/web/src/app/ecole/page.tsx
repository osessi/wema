import { Buildings, CaretRight } from "@phosphor-icons/react/ssr";
import { GlowTile } from "@wema/ui/components/brand/glow-tile";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../components/page-header";
import { getSpaces } from "../../lib/spaces";

export default async function Page() {
  const t = await getTranslations("school.select");
  const { schools } = await getSpaces();
  const only = schools.length === 1 ? schools[0] : undefined;
  if (only) redirect(`/ecole/${only.id}`);
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {schools.map((s) => (
          <Link
            key={s.id}
            href={`/ecole/${s.id}`}
            className="group block h-full rounded-[20px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Card
              tone="sky"
              className="h-full transition-colors group-hover:bg-muted/40"
              shellClassName="transition-transform duration-300 group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
            >
              <CardHeader className="grid-cols-[auto_1fr_auto] items-center gap-x-3">
                <GlowTile tone="sky" size={40} className="row-span-2">
                  <Buildings weight="fill" />
                </GlowTile>
                <CardTitle className="text-base">
                  <h2>{s.name}</h2>
                </CardTitle>
                <CaretRight
                  aria-hidden
                  className="row-span-2 size-4 text-muted-foreground"
                />
                <CardDescription>{t(`kinds.${s.kind}`)}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
