import { Button } from "@wema/ui/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import { hasPermission } from "../../../lib/session";
import { EmptyState } from "../_ui/fields";
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
        <EmptyState>{t("none")}</EmptyState>
      ) : (
        <>
          <ContactRequestsTable requests={data.requests} />
          {pages > 1 ? (
            <nav className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>{t("pagination", { page, pages, total: data.total })}</span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/contacts?page=${page - 1}`}>
                      {t("previous")}
                    </Link>
                  </Button>
                ) : null}
                {page < pages ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/contacts?page=${page + 1}`}>
                      {t("next")}
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
