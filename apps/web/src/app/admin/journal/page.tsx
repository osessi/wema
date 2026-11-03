import { EmptyState, PageHeader, Table } from "@wema/ui";
import { getFormatter, getTranslations } from "next-intl/server";
import { load, serverApi } from "../../../lib/api-server";

export default async function AuditPage() {
  const t = await getTranslations("audit");
  const format = await getFormatter();
  const api = await serverApi();
  const { entries } = await load(api.admin.audit.$get({ query: {} }));
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {entries.length === 0 ? (
        <EmptyState>{t("none")}</EmptyState>
      ) : (
        <div className="w-card">
          <Table head={[t("when"), t("who"), t("action"), t("target"), ""]}>
            {entries.map((e) => (
              <tr key={e.id}>
                <td style={{ whiteSpace: "nowrap" }}>
                  {format.dateTime(new Date(e.at), {
                    dateStyle: "short",
                    timeStyle: "medium",
                  })}
                </td>
                <td>{e.actorName ?? t("system")}</td>
                <td>
                  <code>{e.action}</code>
                </td>
                <td className="w-muted">
                  {e.targetType}
                  {e.targetId ? (
                    <span title={e.targetId}> · {e.targetId.slice(0, 8)}</span>
                  ) : null}
                </td>
                <td>
                  {Object.keys(e.details).length > 0 ? (
                    <details>
                      <summary
                        className="w-small"
                        style={{ cursor: "pointer" }}
                      >
                        {t("details")}
                      </summary>
                      <pre
                        className="w-small"
                        style={{
                          margin: "6px 0 0",
                          whiteSpace: "pre-wrap",
                          maxWidth: 420,
                        }}
                      >
                        {JSON.stringify(e.details, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </>
  );
}
