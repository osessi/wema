import {
  DownloadSimple,
  IdentificationCard,
  Trash,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@wema/ui/components/ui/badge";
import { Button } from "@wema/ui/components/ui/button";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "../../components/page-header";
import { load, serverApi } from "../../lib/api-server";
import { Panel } from "../admin/_ui/kit";
import { ConfirmAction, SimpleAction } from "./_components/confirm-action";
import { AccountFrame } from "./_components/frame";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.account");
  return { title: t("title") };
}

export default async function AccountPage() {
  const t = await getTranslations("legal.account");
  const tUi = await getTranslations("accountUi");
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

      <Panel
        icon={<IdentificationCard weight="fill" />}
        tone="sky"
        title={t("identity")}
        contentClassName="space-y-4"
      >
        <p className="text-lg font-medium">{account.user.displayName}</p>
        {account.identities.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("identities")}</p>
            <ul className="flex flex-wrap gap-2">
              {account.identities.map((i) => (
                <li key={`${i.kind}:${i.identifier}`}>
                  <Badge variant="neutral" className="gap-1.5">
                    <span className="font-mono text-[10px] tracking-[0.06em] uppercase">
                      {t(`kinds.${i.kind}`)}
                    </span>
                    <span className="text-foreground">{i.identifier}</span>
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="space-y-1.5 border-t pt-4 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 font-medium text-foreground">
            {t("legalTitle")}
          </p>
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
      </Panel>

      <Panel
        icon={<DownloadSimple weight="bold" />}
        tone="mint"
        title={t("exportTitle")}
        description={t("exportText")}
        actions={
          <Button asChild variant="outline">
            <a href="/api/account/export" download>
              <DownloadSimple aria-hidden />
              {t("exportButton")}
            </a>
          </Button>
        }
      />

      {account.children.length > 0 ? (
        <Panel
          icon={<UsersThree weight="fill" />}
          tone="rose"
          title={t("childrenTitle")}
          description={t("childrenText")}
          flush
        >
          <ul className="divide-y">
            {account.children.map((child) => {
              const base = `/account/children/${child.learnerId}`;
              const consent = child.consents[0];
              return (
                <li
                  key={child.learnerId}
                  className="space-y-3 px-4 py-4 sm:px-6"
                >
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
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <a href={`/api${base}/export`} download>
                        <DownloadSimple aria-hidden />
                        {t("childExport")}
                      </a>
                    </Button>
                    {child.deletion ? (
                      <div className="space-y-2">
                        <p className="flex flex-wrap items-center gap-2 text-sm">
                          <Badge variant="warning">{tUi("pendingBadge")}</Badge>
                          {pendingText(child.deletion)}
                        </p>
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
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

      <Panel
        icon={<Trash weight="fill" />}
        tone="rose"
        title={t("deleteTitle")}
        description={t("deleteText", { days: account.deletionGraceDays })}
      >
        {account.deletion ? (
          <div className="space-y-2">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="warning">{tUi("pendingBadge")}</Badge>
              {pendingText(account.deletion)}
            </p>
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
      </Panel>
    </AccountFrame>
  );
}
