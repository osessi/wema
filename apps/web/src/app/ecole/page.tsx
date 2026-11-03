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
            className="rounded-xl focus-visible:outline-2"
          >
            <Card className="h-full transition-colors hover:bg-muted">
              <CardHeader>
                <CardTitle className="font-display text-lg">{s.name}</CardTitle>
                <CardDescription>{t(`kinds.${s.kind}`)}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
