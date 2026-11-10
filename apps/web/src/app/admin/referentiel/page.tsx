import {
  CaretRight,
  GlobeHemisphereWest,
} from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@wema/ui/components/ui/badge";
import { Card } from "@wema/ui/components/ui/card";
import { Progress } from "@wema/ui/components/ui/progress";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import { hasPermission } from "../../../lib/session";
import { NewCountryDialog } from "./country-form";

const nf = new Intl.NumberFormat("fr-FR");

export default async function CurriculumPage() {
  const t = await getTranslations();
  const api = await serverApi();
  const { countries } = await load(api.admin.curriculum.countries.$get());
  const canWrite = await hasPermission("curriculum.write");
  // Les pays sont peu nombreux : un référentiel par pays pour les compteurs.
  const curricula = await Promise.all(
    countries.map((c) =>
      load(
        api.admin.curriculum.countries[":id"].curriculum.$get({
          param: { id: c.id },
        }),
      ),
    ),
  );
  const cards = countries.map((c, i) => {
    const cur = curricula[i];
    const notions = (cur?.notions ?? []).filter((n) => !n.archived);
    return {
      ...c,
      grades: (cur?.grades ?? []).filter((g) => !g.archived).length,
      programs: (cur?.programs ?? []).filter((p) => !p.archived).length,
      notions: notions.length,
      verified: notions.filter((n) => n.verified).length,
    };
  });

  return (
    <>
      <PageHeader
        title={t("curriculum.title")}
        description={t("curriculum.subtitle")}
        actions={canWrite ? <NewCountryDialog /> : undefined}
      />
      {cards.length === 0 ? (
        <EmptyState
          icon={<GlobeHemisphereWest weight="fill" />}
          tone="sky"
          title={t("curriculum.noCountries")}
          titleAs="h2"
          action={canWrite ? <NewCountryDialog /> : undefined}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => {
            const pending = c.notions - c.verified;
            return (
              <li key={c.id}>
                <Link
                  href={`/admin/referentiel/${c.id}`}
                  className="group block h-full rounded-card outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <Card
                    className={`h-full gap-4 p-5 transition-colors group-hover:bg-muted/40 ${c.archived ? "opacity-70" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        aria-hidden
                        className="grid h-14 min-w-14 place-items-center rounded-[10px] bg-foreground px-2 font-mono text-2xl font-medium tracking-[0.04em] text-background"
                      >
                        {c.code}
                      </span>
                      <span className="flex items-center gap-2">
                        {c.archived ? (
                          <Badge variant="neutral">
                            {t("common.archived")}
                          </Badge>
                        ) : pending > 0 ? (
                          <Badge variant="warning" className="tabular-nums">
                            {t("curriculum.pendingCount", { count: pending })}
                          </Badge>
                        ) : c.notions > 0 ? (
                          <Badge variant="success">
                            {t("curriculum.allVerified")}
                          </Badge>
                        ) : null}
                        <CaretRight
                          aria-hidden
                          className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                        />
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <h2 className="text-lg font-semibold tracking-tight">
                        {c.name}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {c.unitLabel.plural}
                      </p>
                    </div>
                    <dl className="mt-auto grid grid-cols-3 gap-2 border-t pt-4">
                      {(
                        [
                          ["grades", c.grades],
                          ["programs", c.programs],
                          ["notionsLabel", c.notions],
                        ] as const
                      ).map(([key, value]) => (
                        <div key={key} className="space-y-0.5">
                          <dt className="font-mono text-[10.5px] tracking-[0.06em] text-muted-foreground uppercase">
                            {t(`curriculum.${key}`)}
                          </dt>
                          <dd className="text-xl font-light tabular-nums">
                            {nf.format(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {c.notions > 0 ? (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{t("curriculum.verifiedShort")}</span>
                          <span className="tabular-nums">
                            {nf.format(c.verified)} / {nf.format(c.notions)}
                          </span>
                        </div>
                        <Progress
                          value={(c.verified / c.notions) * 100}
                          aria-label={t("curriculum.verifiedShort")}
                          indicatorClassName="bg-success-text"
                        />
                      </div>
                    ) : null}
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
