import { router } from "expo-router";
import { View } from "react-native";
import {
  Button,
  Icon,
  Loading,
  Notice,
  Screen,
  Section,
  StatusBadge,
  Text,
} from "../components/ui";
import { m } from "../i18n/fr";
import { api, call } from "../lib/api";
import type { NotionStatus, PathNotion } from "../lib/types";
import { all, useLoad } from "../lib/use-load";
import { fonts, type Palette, radius, space, useTheme } from "../theme";

/** Notion où se trouve l'élève : celle de sa prochaine action, sinon la première non validée. */
function hereOf(notions: PathNotion[], suggested: string | null) {
  return (
    notions.find((n) => n.notionId === suggested)?.notionId ??
    notions.find((n) => n.status === "in_progress" || n.status === "needs_work")
      ?.notionId ??
    notions.find((n) => n.status === "not_seen")?.notionId ??
    null
  );
}

const dot = (status: NotionStatus, colors: Palette) =>
  ({
    not_seen: { bg: colors.surfaceSunk, fg: colors.inkMuted },
    needs_work: { bg: colors.peach, fg: colors.peachInk },
    in_progress: { bg: colors.butter, fg: colors.butterInk },
    mastered: { bg: colors.action, fg: colors.onAction },
  })[status];

export default function ProgressScreen() {
  const { colors } = useTheme();
  const { data, error, refreshing, refresh, reload } = useLoad(() =>
    all([
      call(api.learner.path.$get()),
      call(api.learner.next.$get()),
    ] as const),
  );
  if (!data)
    return (
      <Screen>
        {error ? <Notice code={error} onRetry={reload} /> : <Loading />}
      </Screen>
    );
  const [{ classes }, { actions }] = data;
  const firstNotion = actions.find((a) => "notionId" in a);
  const suggested =
    firstNotion && "notionId" in firstNotion ? firstNotion.notionId : null;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Text variant="muted">{m.progress.description}</Text>
      {classes.length === 0 && <Text variant="muted">{m.progress.empty}</Text>}
      {classes.map((k) => {
        const here = hereOf(k.notions, suggested);
        return (
          <Section key={k.classId} title={k.name}>
            {k.notions.length === 0 ? (
              <Text variant="muted">{m.progress.emptyClass}</Text>
            ) : (
              k.notions.map((n, i) => {
                const isHere = n.notionId === here;
                const last = i === k.notions.length - 1;
                const tone = dot(n.status, colors);
                return (
                  <View
                    key={n.notionId}
                    style={{ flexDirection: "row", gap: space.md }}
                  >
                    <View style={{ alignItems: "center", width: 40 }}>
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: radius.pill,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: tone.bg,
                          borderWidth: isHere ? 3 : 1,
                          borderColor: isHere ? colors.brand : colors.line,
                        }}
                      >
                        {n.status === "mastered" ? (
                          <Icon name="checkmark" color={tone.fg} />
                        ) : (
                          <Text
                            style={{
                              color: tone.fg,
                              fontFamily: fonts.display,
                            }}
                          >
                            {i + 1}
                          </Text>
                        )}
                      </View>
                      {!last && (
                        <View
                          style={{
                            flex: 1,
                            width: 2,
                            backgroundColor: colors.line,
                          }}
                        />
                      )}
                    </View>
                    <View
                      style={{
                        flex: 1,
                        gap: space.sm,
                        marginBottom: space.lg,
                        padding: space.lg,
                        borderRadius: radius.xl,
                        borderWidth: 1,
                        borderColor: isHere ? colors.brand : colors.line,
                        backgroundColor: colors.surface,
                      }}
                    >
                      {isHere && (
                        <View
                          style={{
                            alignSelf: "flex-start",
                            flexDirection: "row",
                            gap: space.xs,
                            alignItems: "center",
                            backgroundColor: colors.brand,
                            borderRadius: radius.pill,
                            paddingHorizontal: space.sm,
                            paddingVertical: 2,
                          }}
                        >
                          <Icon
                            name="location"
                            size={14}
                            color={colors.inkOnBrand}
                          />
                          <Text
                            variant="small"
                            style={{ color: colors.inkOnBrand }}
                          >
                            {m.progress.here}
                          </Text>
                        </View>
                      )}
                      <Text variant="label">{n.name}</Text>
                      <StatusBadge status={n.status} />
                      <Text variant="small">
                        {n.mastery !== null
                          ? `${m.progress.mastery(Math.round(n.mastery * 100))} · `
                          : ""}
                        {m.progress.observations(n.observations)}
                      </Text>
                      {n.status !== "mastered" && (
                        <View
                          style={{
                            alignItems: "flex-start",
                            marginLeft: -space.md,
                          }}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            label={m.progress.work}
                            onPress={() =>
                              router.navigate({
                                pathname: "/prof-ia",
                                params: {
                                  mode: "course_question",
                                  notion: n.notionId,
                                },
                              })
                            }
                          />
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </Section>
        );
      })}
    </Screen>
  );
}
