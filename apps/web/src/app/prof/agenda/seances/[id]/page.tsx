import { SessionPage } from "../../../../../components/agenda/session-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SessionPage space="teacher" id={id} />;
}
