import { getTranslations } from "next-intl/server";
import { load, serverApi } from "../../lib/api-server";
import { PageHeader } from "../page-header";
import { Inbox } from "./inbox";
import type { Tone } from "./types";

/** Page Messages commune aux espaces élève, prof et parent. */
export async function MessagesPage({ tone }: { tone: Tone }) {
  const t = await getTranslations("messages");
  const api = await serverApi();
  const [{ threads }, { contacts, classes }] = await Promise.all([
    load(api.messages.threads.$get()),
    load(api.messages.contacts.$get()),
  ]);
  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} description={t(`${tone}.subtitle`)} />
      <Inbox
        tone={tone}
        initialThreads={threads}
        contacts={contacts}
        classes={classes}
      />
    </div>
  );
}
