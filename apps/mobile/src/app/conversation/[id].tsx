import { Stack, useLocalSearchParams } from "expo-router";
import { type ComponentRef, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Bubble } from "../../components/bubble";
import { Composer } from "../../components/composer";
import { Card, Loading, Notice, Screen, Text } from "../../components/ui";
import { m } from "../../i18n/fr";
import { api, call } from "../../lib/api";
import { useLoad } from "../../lib/use-load";
import { space, useTheme } from "../../theme";

const time = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { data, error, reload } = useLoad(() =>
    call(api.messages.threads[":id"].$get({ param: { id } })),
  );
  const [sendError, setSendError] = useState<string | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  // Ouvrir le fil le marque comme lu.
  const loaded = data !== null;
  useEffect(() => {
    if (loaded)
      void call(api.messages.threads[":id"].read.$post({ param: { id } }));
  }, [loaded, id]);

  if (!data)
    return (
      <Screen>
        {error ? <Notice code={error} onRetry={reload} /> : <Loading />}
      </Screen>
    );
  const { thread, messages } = data;
  const title =
    thread.kind === "class"
      ? m.messages.classThread(thread.className ?? "")
      : (thread.otherName ?? m.messages.title);

  const send = async (body: string) => {
    setSendError(null);
    const result = await call(
      api.messages.threads[":id"].messages.$post({
        param: { id },
        json: { body },
      }),
    );
    if (!result.ok) {
      setSendError(result.code);
      return false;
    }
    await reload();
    return true;
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.ground }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <Stack.Screen options={{ title }} />
      <ScrollView
        ref={scroll}
        contentContainerStyle={{ padding: space.lg, gap: space.md }}
        onContentSizeChange={() =>
          scroll.current?.scrollToEnd({ animated: false })
        }
      >
        {messages.length === 0 && (
          <Text variant="muted">{m.messages.noMessages}</Text>
        )}
        {messages.map((msg) => (
          <Bubble
            key={msg.id}
            mine={msg.mine}
            label={`${msg.mine ? m.messages.you : (msg.senderName ?? "")} · ${time(msg.createdAt)}`}
          >
            {msg.body}
          </Bubble>
        ))}
        <Notice code={sendError} />
        {!thread.canWrite && (
          <Card tone="sunk">
            <Text variant="small">
              {thread.kind === "class"
                ? m.messages.readOnly
                : m.messages.closed}
            </Text>
          </Card>
        )}
      </ScrollView>
      {thread.canWrite && <Composer onSend={send} />}
    </KeyboardAvoidingView>
  );
}
