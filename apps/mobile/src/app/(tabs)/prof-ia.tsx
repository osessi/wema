import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ChoiceList } from "../../components/choice-list";
import {
  Badge,
  Button,
  Card,
  Loading,
  Notice,
  Row,
  Screen,
  Section,
  Text,
} from "../../components/ui";
import { m } from "../../i18n/fr";
import { api, call } from "../../lib/api";
import { read } from "../../lib/read";
import {
  EXERCISE_MODES,
  isTutorMode,
  TUTOR_MODES,
  type TutorMode,
} from "../../lib/types";
import { all, useLoad } from "../../lib/use-load";

const first = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? null;

export default function TutorScreen() {
  const params = useLocalSearchParams<{
    mode?: string;
    notion?: string;
    variant?: string;
  }>();
  const { data, error, refreshing, refresh, reload } = useLoad(() =>
    all([
      call(api.learner.tutor.sessions.$get()),
      call(api.learner.path.$get()),
      call(api.learner.variants.$get()),
      call(api.learner.assignments.$get()),
    ] as const),
  );
  const [mode, setMode] = useState<TutorMode>("course_question");
  const [notionId, setNotionId] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Arrivée depuis l'accueil, un exercice ou le chemin : on préremplit.
  const wantedMode = first(params.mode);
  const wantedNotion = first(params.notion);
  const wantedVariant = first(params.variant);
  useEffect(() => {
    if (isTutorMode(wantedMode)) setMode(wantedMode);
    if (wantedNotion) setNotionId(wantedNotion);
    if (wantedVariant) setVariantId(wantedVariant);
  }, [wantedMode, wantedNotion, wantedVariant]);

  if (!data)
    return (
      <Screen>
        {error ? <Notice code={error} onRetry={reload} /> : <Loading />}
      </Screen>
    );
  const [{ sessions }, { classes }, { variants }, { assignments }] = data;
  const notionNames = new Map(
    classes.flatMap((k) => k.notions.map((n) => [n.notionId, n.name])),
  );
  const notions = classes.flatMap((k) =>
    k.notions.map((n) => ({ id: n.notionId, label: `${n.name} · ${k.name}` })),
  );
  const titles = new Map(
    assignments.flatMap((a) => (a.variantId ? [[a.variantId, a.title]] : [])),
  );
  const exercises = variants.map((v) => ({
    id: v.id,
    label:
      titles.get(v.id) ??
      (v.statement.length > 70 ? `${v.statement.slice(0, 70)}…` : v.statement),
  }));
  const sorted = [...sessions].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  const onExercise = EXERCISE_MODES.includes(mode);
  const onNotion = !onExercise && mode !== "intake";
  const ready =
    mode === "intake" ||
    (onExercise && exercises.some((e) => e.id === variantId)) ||
    (onNotion && notions.some((n) => n.id === notionId));

  const start = async () => {
    setPending(true);
    setStartError(null);
    const json =
      mode === "intake"
        ? { mode }
        : onExercise
          ? { mode, variantId: variantId ?? "" }
          : { mode, notionId: notionId ?? "" };
    const result = await call(api.learner.tutor.sessions.$post({ json }));
    setPending(false);
    if (!result.ok) return setStartError(result.code);
    const id = read(read(result.data, "session"), "id");
    if (typeof id === "string")
      router.push({ pathname: "/seance/[id]", params: { id } });
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Text variant="muted">{m.tutor.description}</Text>
      <Card>
        <Text variant="heading">{m.tutor.newSession}</Text>
        <Text variant="label">{m.tutor.mode}</Text>
        <ChoiceList
          value={mode}
          onChange={(v) => {
            if (isTutorMode(v)) setMode(v);
          }}
          choices={TUTOR_MODES.map((k) => ({
            id: k,
            label: m.tutor.modes[k],
            help: m.tutor.modeHelp[k],
          }))}
        />
        {onNotion &&
          (notions.length === 0 ? (
            <Text variant="small">{m.tutor.noNotions}</Text>
          ) : (
            <>
              <Text variant="label">{m.tutor.notion}</Text>
              <ChoiceList
                value={notionId}
                onChange={setNotionId}
                choices={notions}
              />
            </>
          ))}
        {onExercise &&
          (exercises.length === 0 ? (
            <Text variant="small">{m.tutor.noExercises}</Text>
          ) : (
            <>
              <Text variant="label">{m.tutor.exercise}</Text>
              <ChoiceList
                value={variantId}
                onChange={setVariantId}
                choices={exercises}
              />
            </>
          ))}
        <Button
          size="lg"
          label={m.tutor.start}
          pending={pending}
          disabled={!ready}
          onPress={start}
        />
        <Notice code={startError} />
      </Card>

      <Section title={m.tutor.sessions}>
        {sorted.length === 0 ? (
          <Text variant="muted">{m.tutor.noSessions}</Text>
        ) : (
          sorted.map((s) => (
            <Row
              key={s.id}
              title={m.tutor.modes[s.mode]}
              subtitle={`${s.notionId && notionNames.get(s.notionId) ? `${notionNames.get(s.notionId)} · ` : ""}${m.tutor.startedOn(s.createdAt)}`}
              right={
                <Badge
                  tone={s.status === "open" ? "outline" : "sunk"}
                  label={
                    s.status === "open" ? m.tutor.ongoing : m.tutor.finished
                  }
                />
              }
              onPress={() =>
                router.push({ pathname: "/seance/[id]", params: { id: s.id } })
              }
            />
          ))
        )}
      </Section>
    </Screen>
  );
}
