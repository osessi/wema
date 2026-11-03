import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { ListenButton } from "../../components/listen-button";
import { MathInput } from "../../components/math-input";
import { PhotoReview } from "../../components/photo-review";
import {
  Badge,
  Button,
  Card,
  Icon,
  Inline,
  Loading,
  Notice,
  Screen,
  Section,
  Text,
} from "../../components/ui";
import { m } from "../../i18n/fr";
import { api, call } from "../../lib/api";
import {
  type AssignmentStatus,
  assignmentStatus,
  type Variant,
} from "../../lib/types";
import { all, useLoad } from "../../lib/use-load";
import { space, useTheme } from "../../theme";

export default function ExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, reload } = useLoad(() =>
    all([
      call(api.learner.variants.$get()),
      call(api.learner.assignments.$get()),
    ] as const),
  );
  if (!data)
    return (
      <Screen>
        {error ? <Notice code={error} onRetry={reload} /> : <Loading />}
      </Screen>
    );
  const [{ variants }, { assignments }] = data;
  const variant = variants.find((v) => v.id === id);
  const assignment = assignments.find((a) => a.variantId === id);
  if (!variant)
    return (
      <Screen>
        <Notice text={m.exercises.notFound} />
      </Screen>
    );
  return (
    <Exercise
      key={variant.id}
      variant={variant}
      title={assignment?.title ?? null}
      dueAt={assignment?.dueAt ?? null}
      status={assignment ? assignmentStatus(assignment.status) : null}
    />
  );
}

interface Feedback {
  correct: boolean;
  reason: string | null;
  attemptsLeft: number;
}

/**
 * Exercice : étapes révélées une à une, réponse vérifiée par services/math.
 * On dit seulement si c'est juste : la bonne réponse n'est jamais affichée.
 */
function Exercise({
  variant,
  title,
  dueAt,
  status,
}: {
  variant: Variant;
  title: string | null;
  dueAt: string | null;
  status: AssignmentStatus | null;
}) {
  const { colors } = useTheme();
  const initialSteps = variant.scaffolded
    ? variant.steps.length
    : Math.min(variant.hintLevel, variant.steps.length);
  const [shown, setShown] = useState(initialSteps);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const solved = feedback?.correct === true || status === "done";
  const answered =
    feedback !== null || status === "done" || status === "attempted";
  const blocked = solved || exhausted || feedback?.attemptsLeft === 0;

  const submit = async () => {
    if (answer.length === 0 || pending || blocked) return;
    setPending(true);
    setError(null);
    const result = await call(
      api.learner.variants[":id"].answer.$post({
        param: { id: variant.id },
        json: {
          response: answer,
          hintsUsed: Math.max(0, shown - initialSteps),
        },
      }),
    );
    setPending(false);
    if (result.ok)
      setFeedback({
        correct: result.data.correct,
        reason: result.data.reason ?? null,
        attemptsLeft: result.data.attemptsLeft,
      });
    else {
      if (result.code === "attempts_exhausted") setExhausted(true);
      setError(result.code);
    }
  };

  const openTutor = (mode: "exercise_help" | "oral_check") =>
    router.push({
      pathname: "/prof-ia",
      params: { mode, variant: variant.id },
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: title ?? m.exercises.title }} />
      <View style={{ gap: space.sm }}>
        {dueAt ? <Text variant="muted">{m.common.dueOn(dueAt)}</Text> : null}
        <Inline>
          <Badge tone="sunk" label={m.exercises.level(variant.level)} />
          {variant.scaffolded && (
            <Badge tone="sunk" label={m.exercises.guided} />
          )}
        </Inline>
      </View>

      <Card>
        <Text style={{ fontSize: 19, lineHeight: 28 }} selectable>
          {variant.statement}
        </Text>
        <View style={{ alignItems: "flex-start", marginLeft: -space.md }}>
          <ListenButton text={variant.statement} label={m.exercises.listen} />
        </View>
      </Card>

      {variant.steps.length > 0 && (
        <Section title={m.exercises.steps}>
          {variant.steps.slice(0, shown).map((step, i) => (
            <Text key={step}>{`${i + 1}. ${step}`}</Text>
          ))}
          {shown < variant.steps.length ? (
            <View style={{ alignItems: "flex-start" }}>
              <Button
                variant="outline"
                size="sm"
                icon="bulb-outline"
                label={m.exercises.nextStep}
                onPress={() => setShown((n) => n + 1)}
              />
            </View>
          ) : (
            <Text variant="small">{m.exercises.noMoreSteps}</Text>
          )}
        </Section>
      )}

      <Section title={m.exercises.answer}>
        <Text variant="small">{m.exercises.answerHelp}</Text>
        <MathInput disabled={blocked} onChange={setAnswer} onSubmit={submit} />
        {!blocked && (
          <Button
            size="lg"
            label={pending ? m.exercises.checking : m.exercises.submit}
            pending={pending}
            disabled={answer.length === 0}
            onPress={submit}
          />
        )}
        <Notice code={error} />
      </Section>

      <View accessibilityLiveRegion="polite">
        {feedback?.correct && (
          <Card tone="brand">
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Icon name="checkmark-circle" size={26} color={colors.ink} />
              <Text variant="heading">{m.exercises.correct}</Text>
            </View>
            <Text>{m.exercises.correctHint}</Text>
            <View style={{ alignItems: "flex-start" }}>
              <Button
                label={m.exercises.continue}
                onPress={() => router.navigate("/")}
              />
            </View>
          </Card>
        )}
        {feedback && !feedback.correct && (
          <Card tone="sunk">
            <Text variant="heading">{m.exercises.notYet}</Text>
            <Text>
              {feedback.reason === "wrong_form"
                ? m.exercises.wrongForm
                : m.exercises.notYetHint}
            </Text>
            <Text variant="small">
              {feedback.attemptsLeft === 0
                ? m.exercises.noAttemptsLeft
                : m.exercises.attemptsLeft(feedback.attemptsLeft)}
            </Text>
          </Card>
        )}
        {!feedback && status === "done" && (
          <Card tone="sunk">
            <Text>{m.exercises.alreadyDone}</Text>
          </Card>
        )}
        {!feedback && status === "attempted" && (
          <Card tone="sunk">
            <Text>{m.exercises.alreadyAttempted}</Text>
          </Card>
        )}
      </View>

      <Inline>
        {!solved && (
          <Button
            variant="outline"
            icon="chatbubbles-outline"
            label={m.exercises.askTutor}
            onPress={() => openTutor("exercise_help")}
          />
        )}
        {answered && (
          <Button
            variant="outline"
            icon="mic-outline"
            label={m.exercises.explainOral}
            onPress={() => openTutor("oral_check")}
          />
        )}
      </Inline>

      <PhotoReview variantId={variant.id} />
    </Screen>
  );
}
