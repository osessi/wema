import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Switch, View } from "react-native";
import {
  Badge,
  Button,
  Card,
  Field,
  Icon,
  Inline,
  Loading,
  Notice,
  Row,
  Screen,
  Section,
  StatusBadge,
  Text,
} from "../../components/ui";
import { m } from "../../i18n/fr";
import { api, call } from "../../lib/api";
import {
  type PushState,
  pushPermission,
  registerForPush,
} from "../../lib/push";
import { useMe, useSession } from "../../lib/session";
import { LEARNER_PREFERENCES } from "../../lib/types";
import { useLoad } from "../../lib/use-load";
import { radius, space, useTheme } from "../../theme";

const INTEREST = "interest:";

const prefLabel = (key: string, statement: string) =>
  Object.entries(m.profile.prefs).find(([k]) => k === key)?.[1] ?? statement;

const sourceLabel = (source: string) =>
  Object.entries(m.profile.sources).find(([k]) => k === source)?.[1] ?? source;

const hypothesisStatus = (status: string) =>
  Object.entries(m.profile.hypothesisStatus).find(([k]) => k === status)?.[1] ??
  status;

export default function MeScreen() {
  const me = useMe();
  const { logout } = useSession();
  const { colors } = useTheme();
  const { data, error, refreshing, refresh, reload } = useLoad(() =>
    call(api.learner.profile.$get()),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [interest, setInterest] = useState("");
  const [push, setPush] = useState<PushState | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    void pushPermission().then(setPush);
  }, []);

  const declare = async (body: {
    key: string;
    value: boolean;
    label?: string;
  }) => {
    setSaving(true);
    setSaveError(null);
    const result = await call(api.learner.preferences.$post({ json: body }));
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.code);
      return false;
    }
    await reload();
    return true;
  };

  const percent = (v: number) => Math.round(v * 100);
  const profile = data;
  const active = new Set(
    profile?.hypotheses
      .filter((h) => h.status === "supported")
      .map((h) => h.key) ?? [],
  );
  const interests = [...active]
    .filter((k) => k.startsWith(INTEREST))
    .map((k) => k.slice(INTEREST.length));

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={{ gap: space.xs }}>
        <Text variant="title" accessibilityRole="header">
          {me.user.displayName}
        </Text>
        <Text variant="muted">{m.profile.description}</Text>
      </View>

      <Row
        title={m.profile.myPath}
        subtitle={m.progress.description}
        onPress={() => router.push("/progression")}
      />

      {!profile ? (
        error ? (
          <Notice code={error} onRetry={reload} />
        ) : (
          <Loading />
        )
      ) : (
        <>
          <Section title={m.profile.understood}>
            {profile.hypotheses.length === 0 ? (
              <Card>
                <Text variant="muted">{m.profile.noHypotheses}</Text>
                <View style={{ alignItems: "flex-start" }}>
                  <Button
                    label={m.profile.startIntake}
                    onPress={() =>
                      router.navigate({
                        pathname: "/prof-ia",
                        params: { mode: "intake" },
                      })
                    }
                  />
                </View>
              </Card>
            ) : (
              profile.hypotheses.map((h) => (
                <Card key={h.key}>
                  <Inline>
                    <Text variant="label" style={{ flex: 1 }}>
                      {prefLabel(h.key, h.statement)}
                    </Text>
                    <Badge
                      tone={h.status === "supported" ? "solid" : "outline"}
                      label={hypothesisStatus(h.status)}
                    />
                  </Inline>
                  <View
                    accessibilityRole="progressbar"
                    accessibilityValue={{
                      min: 0,
                      max: 100,
                      now: percent(h.confidence),
                    }}
                    style={{
                      height: 6,
                      borderRadius: radius.pill,
                      backgroundColor: colors.surfaceSunk,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        width: `${percent(h.confidence)}%`,
                        height: "100%",
                        backgroundColor: colors.action,
                      }}
                    />
                  </View>
                  <Text variant="small">
                    {`${m.profile.confidence(percent(h.confidence))} · ${m.profile.sourceLabel(
                      h.sources.map(sourceLabel).join(", "),
                    )} · ${m.profile.evidence(h.evidenceCount)}`}
                  </Text>
                </Card>
              ))
            )}
          </Section>

          <Section title={m.profile.preferences}>
            <Text variant="muted">{m.profile.preferencesHelp}</Text>
            <Card>
              {LEARNER_PREFERENCES.map((key) => (
                <View
                  key={key}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.md,
                  }}
                >
                  <Text style={{ flex: 1 }}>{m.profile.prefs[key]}</Text>
                  <Switch
                    accessibilityLabel={m.profile.prefs[key]}
                    value={active.has(key)}
                    disabled={saving}
                    trackColor={{
                      true: colors.action,
                      false: colors.lineStrong,
                    }}
                    onValueChange={(value) => void declare({ key, value })}
                  />
                </View>
              ))}
            </Card>
            <Card>
              <Text variant="label">{m.profile.interests}</Text>
              <Text variant="small">{m.profile.interestsHelp}</Text>
              {interests.length > 0 && (
                <Inline>
                  {interests.map((label) => (
                    <Button
                      key={label}
                      variant="outline"
                      size="sm"
                      icon="close"
                      label={label}
                      disabled={saving}
                      onPress={() =>
                        void declare({ key: "interest", label, value: false })
                      }
                    />
                  ))}
                </Inline>
              )}
              <Field
                value={interest}
                maxLength={40}
                onChangeText={setInterest}
                placeholder={m.profile.interestPlaceholder}
                accessibilityLabel={m.profile.interests}
              />
              <View style={{ alignItems: "flex-start" }}>
                <Button
                  variant="outline"
                  icon="add"
                  label={m.profile.addInterest}
                  disabled={saving || interest.trim() === ""}
                  onPress={async () => {
                    if (
                      await declare({
                        key: "interest",
                        label: interest.trim(),
                        value: true,
                      })
                    )
                      setInterest("");
                  }}
                />
              </View>
            </Card>
            <Notice code={saveError} />
          </Section>

          {profile.needs.length > 0 && (
            <Section title={m.profile.needs}>
              <Card>
                {profile.needs.map((n) => (
                  <Text key={n.id}>{`• ${n.adaptation}`}</Text>
                ))}
              </Card>
            </Section>
          )}

          {profile.notions.length > 0 && (
            <Section title={m.progress.title}>
              {profile.notions.map((n) => (
                <Card key={n.notionId}>
                  <Text variant="label">
                    {n.name ?? m.common.notionUnknown}
                    {n.subject ? ` · ${n.subject}` : ""}
                  </Text>
                  <StatusBadge status={n.status} />
                  <Text variant="small">
                    {m.progress.mastery(percent(n.mastery))}
                  </Text>
                </Card>
              ))}
            </Section>
          )}
        </>
      )}

      <Section title={m.profile.notifications}>
        <Card>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Icon name="notifications-outline" />
            <Text style={{ flex: 1 }}>
              {push === "granted"
                ? m.profile.notificationsOn
                : push === "unavailable"
                  ? m.profile.notificationsUnavailable
                  : m.profile.notificationsOff}
            </Text>
          </View>
          {(push === "undetermined" || push === "denied") && (
            <View style={{ alignItems: "flex-start" }}>
              <Button
                variant="outline"
                label={m.profile.notificationsEnable}
                onPress={() => void registerForPush(true).then(setPush)}
              />
            </View>
          )}
        </Card>
      </Section>

      <Button
        variant="outline"
        icon="log-out-outline"
        label={m.profile.logout}
        pending={leaving}
        onPress={async () => {
          setLeaving(true);
          await logout();
        }}
      />
    </Screen>
  );
}
