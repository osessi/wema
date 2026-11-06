import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { PageHeader } from "../../components/page-header";
import { load, serverApi } from "../../lib/api-server";
import { ConfirmAction, SimpleAction } from "./_components/confirm-action";
import { AccountFrame } from "./_components/frame";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.account");
  return { title: t("title") };
}

function Block({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div className="space-y-1">
        <h2 className="font-display text-xl font-bold">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default async function AccountPage() {
  const t = await getTranslations("legal.account");
  const format = await getFormatter();
  const api = await serverApi();
  const account = await load(api.account.$get());
  const date = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: "long" });

  const pendingText = (d: { reason: string; scheduledFor: string }) =>
    d.reason === "inactivity"
      ? t("pendingInactivity", { date: date(d.scheduledFor) })
      : t("pending", { date: date(d.scheduledFor) });

  return (
    <AccountFrame>
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Block title={t("identity")}>
        <p className="font-medium">{account.user.displayName}</p>
        {account.identities.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("identities")}</p>
            <ul className="flex flex-wrap gap-2">
              {account.identities.map((i) => (
                <li key={`${i.kind}:${i.identifier}`}>
                  <Badge variant="outline">
                    {t(`kinds.${i.kind}`)} · {i.identifier}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{t("legalTitle")}</p>
          <p>
            {account.legal.accepted
              ? t("legalAccepted", {
                  terms: account.legal.accepted.termsVersion,
                  privacy: account.legal.accepted.privacyVersion,
                  date: date(account.legal.accepted.acceptedAt),
                })
              : t("legalNone")}
          </p>
          {account.myConsents.map((c) => (
            <p key={`${c.guardianName}:${c.givenAt}`}>
              {t("myConsents", { name: c.guardianName, date: date(c.givenAt) })}
            </p>
          ))}
        </div>
      </Block>

      <Block title={t("exportTitle")} description={t("exportText")}>
        <Button asChild variant="outline">
          <a href="/api/account/export" download>
            {t("exportButton")}
          </a>
        </Button>
      </Block>

      {account.children.length > 0 ? (
        <Block title={t("childrenTitle")} description={t("childrenText")}>
          <ul className="divide-y">
            {account.children.map((child) => {
              const base = `/account/children/${child.learnerId}`;
              const consent = child.consents[0];
              return (
                <li key={child.learnerId} className="space-y-4 py-4 first:pt-0">
                  <p className="font-medium">{child.displayName}</p>
                  {consent ? (
                    <p className="text-sm text-muted-foreground">
                      {t("consentGiven", {
                        name: consent.guardianName,
                        date: date(consent.givenAt),
                        version: consent.termsVersion,
                      })}{" "}
                      ({t(`methods.${consent.method}`)})
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm">{t("consentMissing")}</p>
                      <ConfirmAction
                        method="POST"
                        path={`${base}/consent`}
                        confirmLabel={t("consentCheckbox")}
                        buttonLabel={t("consentButton")}
                        primary
                      />
                    </div>
                  )}
                  <Button asChild variant="outline" size="sm">
                    <a href={`/api${base}/export`} download>
                      {t("childExport")}
                    </a>
                  </Button>
                  {child.deletion ? (
                    <div className="space-y-2">
                      <p className="text-sm">{pendingText(child.deletion)}</p>
                      <SimpleAction
                        method="DELETE"
                        path={`${base}/deletion`}
                        label={t("cancel")}
                      />
                    </div>
                  ) : (
                    <ConfirmAction
                      method="POST"
                      path={`${base}/deletion`}
                      confirmLabel={t("childDeleteConfirm")}
                      buttonLabel={t("childDelete")}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </Block>
      ) : null}

      <Block
        title={t("deleteTitle")}
        description={t("deleteText", { days: account.deletionGraceDays })}
      >
        {account.deletion ? (
          <div className="space-y-2">
            <p className="text-sm">{pendingText(account.deletion)}</p>
            <SimpleAction
              method="DELETE"
              path="/account/deletion"
              label={t("cancel")}
            />
          </div>
        ) : account.canDeleteSelf ? (
          <ConfirmAction
            method="POST"
            path="/account/deletion"
            confirmLabel={t("deleteConfirm")}
            buttonLabel={t("deleteButton")}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t("deleteGuardian")}</p>
        )}
      </Block>
    </AccountFrame>
  );
}
