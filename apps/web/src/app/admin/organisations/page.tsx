import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wema/ui/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wema/ui/components/ui/table";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "../../../components/page-header";
import { load, serverApi } from "../../../lib/api-server";
import { hasPermission } from "../../../lib/session";
import { EmptyState } from "../_ui/fields";
import { OrganizationForm } from "./organization-form";

export default async function OrganizationsPage() {
  const t = await getTranslations();
  const api = await serverApi();
  const { organizations } = await load(api.admin.organizations.$get());
  const canCreate = await hasPermission("organizations.manage");
  return (
    <>
      <PageHeader
        title={t("organizations.title")}
        description={t("organizations.subtitle")}
      />
      <div className="flex flex-col gap-5">
        <Card>
          <CardContent>
            {organizations.length === 0 ? (
              <EmptyState>{t("organizations.none")}</EmptyState>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.name")}</TableHead>
                    <TableHead>{t("organizations.kind")}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizations.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>{o.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            o.kind === "platform" ? "default" : "secondary"
                          }
                        >
                          {t(`organizations.kinds.${o.kind}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/organisations/${o.id}`}>
                            {t("common.open")}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        {canCreate ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">
                {t("organizations.new")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OrganizationForm />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
