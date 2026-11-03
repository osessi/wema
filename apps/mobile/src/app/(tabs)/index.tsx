import { router } from "expo-router";
import { View } from "react-native";
import {
  Button,
  Card,
  Icon,
  Loading,
  Notice,
  Row,
  Screen,
  Section,
  Text,
} from "../../components/ui";
import { m } from "../../i18n/fr";
import { actionTarget } from "../../lib/actions";
import { api, call } from "../../lib/api";
import { useMe } from "../../lib/session";
import { all, useLoad } from "../../lib/use-load";
import { radius, space, useTheme } from "../../theme";

export default function HomeScreen() {
  const me = useMe();
  const { colors } = useTheme();
  const { data, error, refreshing, refresh, reload } = useLoad(() =>
    all([
      call(api.learner.next.$get()),
      call(api.learner.nudges.$get()),
      call(api.learner.assignments.$get()),
      call(api.learner.path.$get()),
    ] as const),
  );

  if (!data)
    return (
      <Screen>
        {error ? <Notice code={error} onRetry={reload} /> : <Loading />}
      </Screen>
    );

  const [{ actions }, { nudges }, { assignments }, { classes }] = data;
  const [first, ...others] = actions;
  const firstTarget = first ? actionTarget(first) : null;
  const upcoming = assignments
    .filter((a) => a.status === "todo" || a.status === "late")
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 4);
  const unread = nudges.filter((n) => n.status === "ready");
  const notions = classes.flatMap((k) => k.notions);
  const count = (s: string) => notions.filter((n) => n.status === s).length;
  const mastered = count("mastered");

  const markRead = async (id: string) => {
    const done = await call(
      api.learner.nudges[":id"].read.$post({ param: { id } }),
    );
    if (done.ok) void reload();
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={{ gap: space.xs }}>
        <Text variant="title" accessibilityRole="header">
          {m.home.hello(me.user.displayName)}
        </Text>
        <Text variant="muted">{m.home.description}</Text>
      </View>

      <Card tone="brand">
        <Text variant="label">{m.home.nextStep}</Text>
        <Text variant="heading">
          {first
            ? `${m.actions[first.kind]}${first.notionName ? ` · ${first.notionName}` : ""}`
            : m.home.nextEmpty}
        </Text>
        {first ? <Text variant="muted">{first.reason}</Text> : null}
        {first && firstTarget ? (
          <View style={{ alignItems: "flex-start" }}>
            <Button
              size="lg"
              icon="arrow-forward"
              label={m.actions.go[firstTarget.label]}
              onPress={() => router.push(firstTarget.href)}
            />
          </View>
        ) : null}
      </Card>

      {unread.length > 0 && (
        <Section title={m.home.nudges}>
          {unread.map((n) => (
            <Card key={n.id}>
              <View style={{ flexDirection: "row", gap: space.md }}>
                <Icon
                  name="chatbubble-ellipses-outline"
                  color={colors.inkMuted}
                />
                <Text style={{ flex: 1 }}>{n.content}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Button
                  label={m.home.markRead}
                  variant="outline"
                  size="sm"
                  onPress={() => void markRead(n.id)}
                />
              </View>
            </Card>
          ))}
        </Section>
      )}

      <Section title={m.home.upcoming}>
        {upcoming.length === 0 ? (
          <Text variant="muted">{m.home.noUpcoming}</Text>
        ) : (
          upcoming.map((a) => (
            <Row
              key={a.id}
              title={a.title}
              subtitle={`${m.common.dueOn(a.dueAt)}${a.status === "late" ? ` · ${m.assignmentStatus.late}` : ""}`}
              {...(a.variantId
                ? {
                    onPress: () =>
                      router.push({
                        pathname: "/exercice/[id]",
                        params: { id: a.variantId ?? "" },
                      }),
                  }
                : {})}
            />
          ))
        )}
        <View style={{ alignItems: "flex-start" }}>
          <Button
            variant="ghost"
            size="sm"
            label={m.home.allAssignments}
            onPress={() => router.navigate("/devoirs")}
          />
        </View>
      </Section>

      <Section title={m.home.progress}>
        {notions.length === 0 ? (
          <Text variant="muted">{m.progress.empty}</Text>
        ) : (
          <Card>
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{
                min: 0,
                max: notions.length,
                now: mastered,
              }}
              style={{
                height: 10,
                borderRadius: radius.pill,
                backgroundColor: colors.surfaceSunk,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${(mastered / notions.length) * 100}%`,
                  height: "100%",
                  backgroundColor: colors.action,
                }}
              />
            </View>
            <Text variant="small">
              {m.home.progressSummary(
                mastered,
                count("in_progress"),
                count("needs_work"),
                notions.length,
              )}
            </Text>
          </Card>
        )}
        <View style={{ alignItems: "flex-start" }}>
          <Button
            variant="ghost"
            size="sm"
            label={m.home.seeProgress}
            onPress={() => router.push("/progression")}
          />
        </View>
      </Section>

      {others.length > 0 && (
        <Section title={m.home.otherActions}>
          {others.map((a) => {
            const target = actionTarget(a);
            return (
              <Row
                key={`${a.kind}-${"notionId" in a ? a.notionId : ""}`}
                title={`${m.actions[a.kind]}${a.notionName ? ` · ${a.notionName}` : ""}`}
                subtitle={a.reason}
                onPress={() => router.push(target.href)}
              />
            );
          })}
        </Section>
      )}
    </Screen>
  );
}
