import { router } from "expo-router";
import { useState } from "react";
import { ChoiceList } from "../components/choice-list";
import { Button, Field, Loading, Notice, Screen, Text } from "../components/ui";
import { m } from "../i18n/fr";
import { api, call } from "../lib/api";
import { read } from "../lib/read";
import { useLoad } from "../lib/use-load";

export default function NewMessageScreen() {
  const { data, error, reload } = useLoad(() =>
    call(api.messages.contacts.$get()),
  );
  const [to, setTo] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  if (!data)
    return (
      <Screen>
        {error ? <Notice code={error} onRetry={reload} /> : <Loading />}
      </Screen>
    );
  // Un élève écrit aux profs de ses classes.
  const teachers = data.contacts.filter((c) =>
    c.links.some((l) => l.relation === "teacher"),
  );

  const send = async () => {
    if (!to || !body.trim()) return;
    setPending(true);
    setSendError(null);
    const result = await call(
      api.messages.send.$post({
        json: { to: { kind: "user", userId: to }, body: body.trim() },
      }),
    );
    setPending(false);
    if (!result.ok) return setSendError(result.code);
    const threadId = read(result.data, "threadId");
    if (typeof threadId === "string")
      router.replace({
        pathname: "/conversation/[id]",
        params: { id: threadId },
      });
    else router.back();
  };

  return (
    <Screen>
      <Text variant="muted">{m.messages.newHint}</Text>
      {teachers.length === 0 ? (
        <Text variant="muted">{m.messages.noContacts}</Text>
      ) : (
        <>
          <Text variant="label">{m.messages.to}</Text>
          <ChoiceList
            value={to}
            onChange={setTo}
            choices={teachers.map((c) => ({
              id: c.userId,
              label: c.displayName,
              help: c.links
                .filter((l) => l.relation === "teacher")
                .map((l) => m.messages.relation.teacher(l.className))
                .join(" · "),
            }))}
          />
          <Field
            label={m.messages.placeholder}
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={4000}
            style={{ minHeight: 120, textAlignVertical: "top" }}
          />
          <Button
            size="lg"
            icon="send"
            label={pending ? m.messages.sending : m.messages.send}
            pending={pending}
            disabled={!to || body.trim() === ""}
            onPress={send}
          />
          <Notice code={sendError} />
        </>
      )}
    </Screen>
  );
}
