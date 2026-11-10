import {
  CaretLeft,
  CaretRight,
  EnvelopeSimple,
} from "@phosphor-icons/react/dist/ssr";
import { Button } from "@wema/ui/components/ui/button";
import { EmptyState } from "@wema/ui/components/wema/empty-state";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import { hasPermission } from "../../../lib/session";
import { ContactRequestsTable } from "./contact-requests-table";

const PAGE_SIZE = 25;

export default async function ContactRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  if (!(await hasPermission("contacts.manage"))) notFound();
  const { page: pageParam } = await searchParams;
  const asked = Number.parseInt(pageParam ?? "1", 10);
  const page = Number.isInteger(asked) && asked >= 1 ? asked : 1;
  const t = await getTranslations("contacts");
  const api = await serverApi();
  const data = await load(
    api.admin["contact-requests"].$get({
      query: { page: String(page), pageSize: String(PAGE_SIZE) },
    }),
  );
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {data.total === 0 ? (
        <EmptyState
          icon={<EnvelopeSimple weight="fill" />}
          tone="rose"
          title={t("none")}
          titleAs="h2"
          description={t("noneHint")}
        />
      ) : (
        <>
          <ContactRequestsTable requests={data.requests} />
          {pages > 1 ? (
            <nav
              aria-label={t("paginationLabel")}
              className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"
            >
              <span className="tabular-nums">
                {t("pagination", { page, pages, total: data.total })}
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/contacts?page=${page - 1}`}>
                      <CaretLeft aria-hidden />
                      {t("previous")}
                    </Link>
                  </Button>
                ) : null}
                {page < pages ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/contacts?page=${page + 1}`}>
                      {t("next")}
                      <CaretRight aria-hidden />
                    </Link>
                  </Button>
                ) : null}
              </div>
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
