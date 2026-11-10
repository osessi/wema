import { Buildings, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { GlowTile } from "@wema/ui/brand";
import { Badge } from "@wema/ui/components/ui/badge";
import { Card } from "@wema/ui/components/ui/card";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import { hasPermission } from "../../../lib/session";
import { MonoLabel } from "../_ui/kit";
import { KIND_LOOK, type OrganizationKind } from "./kinds";
import { NewOrganizationDialog } from "./organization-form";

const ORDER: OrganizationKind[] = ["platform", "school", "tutoring", "family"];

export default async function OrganizationsPage() {
  const t = await getTranslations();
  const api = await serverApi();
  const { organizations } = await load(api.admin.organizations.$get());
  const canCreate = await hasPermission("organizations.manage");
  const groups = ORDER.map((kind) => ({
    kind,
    items: organizations.filter((o) => o.kind === kind),
  })).filter((g) => g.items.length > 0);
  return (
    <>
      <PageHeader
        title={t("organizations.title")}
        description={t("organizations.subtitle")}
        actions={canCreate ? <NewOrganizationDialog /> : undefined}
      />
      {organizations.length === 0 ? (
        <EmptyState
          icon={<Buildings weight="fill" />}
          tone="mint"
          illustration={"lockers"}
          title={t("organizations.none")}
          titleAs="h2"
          description={t("organizations.noneHint")}
          action={canCreate ? <NewOrganizationDialog /> : undefined}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <section
              key={g.kind}
              aria-labelledby={`org-kind-${g.kind}`}
              className="space-y-3"
            >
              <MonoLabel>
                <span id={`org-kind-${g.kind}`}>
                  {t(`organizations.groups.${g.kind}`)}
                </span>{" "}
                · <span className="tabular-nums">{g.items.length}</span>
              </MonoLabel>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.items.map((o) => {
                  const look = KIND_LOOK[o.kind];
                  return (
                    <li key={o.id}>
                      <Link
                        href={`/admin/organisations/${o.id}`}
                        className="group block h-full rounded-card outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        <Card className="h-full flex-row items-center gap-3 p-4 transition-colors group-hover:bg-muted/40">
                          <GlowTile tone={look.tone} size={40}>
                            <look.Icon weight="fill" />
                          </GlowTile>
                          <span className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                            <span className="w-full truncate text-sm font-semibold">
                              {o.name}
                            </span>
                            <Badge variant={look.badge}>
                              {t(`organizations.kinds.${o.kind}`)}
                            </Badge>
                          </span>
                          <CaretRight
                            aria-hidden
                            className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                          />
                          <span className="sr-only">{t("common.open")}</span>
                        </Card>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
