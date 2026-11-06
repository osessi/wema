import { router, Stack } from "expo-router";
import { Pressable } from "react-native";
import {
  Badge,
  Icon,
  Loading,
  Notice,
  Row,
  Screen,
  Text,
} from "../../components/ui";
import { m } from "../../i18n/fr";
import { api, call } from "../../lib/api";
import { useLoad } from "../../lib/use-load";
import { space } from "../../theme";

export default function MessagesScreen() {
  const { data, error, refreshing, refresh, reload } = useLoad(() =>
    call(api.messages.threads.$get()),
  );
  const sorted = [...(data?.threads ?? [])].sort((a, b) =>
    (b.lastMessage?.createdAt ?? "").localeCompare(
      a.lastMessage?.createdAt ?? "",
    ),
  );
  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={m.messages.new}
              onPress={() => router.push("/nouveau-message")}
              style={{ paddingHorizontal: space.lg }}
            >
              <Icon name="create-outline" size={24} />
            </Pressable>
          ),
        }}
      />
      <Screen refreshing={refreshing} onRefresh={refresh}>
        <Text variant="muted">{m.messages.subtitle}</Text>
        {!data ? (
          error ? (
            <Notice code={error} onRetry={reload} />
          ) : (
            <Loading />
          )
        ) : sorted.length === 0 ? (
          <Text variant="muted">{m.messages.empty}</Text>
        ) : (
          sorted.map((t) => (
            <Row
              key={t.id}
              title={
                t.kind === "class"
                  ? m.messages.classThread(t.className ?? "")
                  : (t.otherName ?? m.messages.title)
              }
              subtitle={t.lastMessage?.body ?? m.messages.noMessages}
              right={
                t.unread > 0 ? (
                  <Badge tone="brand" label={m.messages.unread(t.unread)} />
                ) : undefined
              }
              onPress={() =>
                router.push({
                  pathname: "/conversation/[id]",
                  params: { id: t.id },
                })
              }
            />
          ))
        )}
      </Screen>
    </>
  );
}
