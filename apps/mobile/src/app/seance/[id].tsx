import { router, Stack, useLocalSearchParams } from "expo-router";
import { type ComponentRef, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bubble } from "../../components/bubble";
import { ListenButton } from "../../components/listen-button";
import {
  Button,
  Card,
  Inline,
  Loading,
  Notice,
  Screen,
  Text,
} from "../../components/ui";
import { m } from "../../i18n/fr";
import { api, call } from "../../lib/api";
import { read } from "../../lib/read";
import type { TutorMode } from "../../lib/types";
import { all, useLoad } from "../../lib/use-load";
import { fonts, radius, space, useTheme } from "../../theme";

/** Indices au plus par séance (même borne que l'API). */
const MAX_HINTS = 3;

interface ChatMessage {
  id: string;
  role: "learner" | "tutor";
  content: string;
  guarded: boolean;
}

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, reload } = useLoad(() =>
    all([
      call(api.learner.tutor.sessions[":id"].$get({ param: { id } })),
      call(api.learner.path.$get()),
      call(api.learner.variants.$get()),
    ] as const),
  );
  if (!data)
    return (
      <Screen>
        {error ? <Notice code={error} onRetry={reload} /> : <Loading />}
      </Screen>
    );
  const [{ session, messages }, { classes }, { variants }] = data;
  const notionName = classes
    .flatMap((k) => k.notions)
    .find((n) => n.notionId === session.notionId)?.name;
  const statement = session.variantId
    ? (variants.find((v) => v.id === session.variantId)?.statement ?? null)
    : null;
  return (
    <Chat
      key={session.id}
      sessionId={session.id}
      mode={session.mode}
      open={session.status === "open"}
      hintLevel={session.hintLevel}
      variantId={session.variantId}
      notionName={notionName ?? null}
      statement={statement}
      initialMessages={messages.map((msg) => ({
        id: msg.id,
        role: msg.role === "learner" ? "learner" : "tutor",
        content: msg.content,
        guarded: msg.guarded,
      }))}
    />
  );
}

interface Outcome {
  assessment: { understanding: number; confidence: number } | null;
  hypotheses: number | null;
}

/**
 * Conversation avec le prof IA : fil de messages, lecture à voix haute,
 * indices (aide sur un exercice), fin de séance.
 */
function Chat({
  sessionId,
  mode,
  open,
  hintLevel,
  variantId,
  notionName,
  statement,
  initialMessages,
}: {
  sessionId: string;
  mode: TutorMode;
  open: boolean;
  hintLevel: number;
  variantId: string | null;
  notionName: string | null;
  statement: string | null;
  initialMessages: ChatMessage[];
}) {
  const { colors } = useTheme();
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hints, setHints] = useState(hintLevel);
  const [finished, setFinished] = useState(!open);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const oral = mode === "oral_check";
  const working = busy || waiting !== null;

  const send = async () => {
    const content = draft.trim();
    if (!content || working) return;
    setError(null);
    setDraft("");
    setWaiting(content);
    const result = await call(
      api.learner.tutor.sessions[":id"].messages.$post({
        param: { id: sessionId },
        json: { content },
      }),
    );
    setWaiting(null);
    if (!result.ok) {
      setDraft(content);
      setError(result.code);
      if (result.code === "session_finished") setFinished(true);
      return;
    }
    const message = read(result.data, "message");
    const replyId = read(message, "id");
    const reply = read(message, "content");
    if (typeof replyId !== "string" || typeof reply !== "string")
      return setError("generic");
    setMessages((list) => [
      ...list,
      { id: `local-${replyId}`, role: "learner", content, guarded: false },
      { id: replyId, role: "tutor", content: reply, guarded: false },
    ]);
  };

  const hint = async () => {
    setError(null);
    setBusy(true);
    const result = await call(
      api.learner.tutor.sessions[":id"].hint.$post({
        param: { id: sessionId },
      }),
    );
    setBusy(false);
    if (!result.ok) {
      if (result.code === "hints_exhausted") setHints(MAX_HINTS);
      return setError(result.code);
    }
    const level = read(result.data, "level");
    const message = read(result.data, "message");
    const messageId = read(message, "id");
    const content = read(message, "content");
    setHints(typeof level === "number" ? level : hints + 1);
    if (typeof content === "string")
      setMessages((list) => [
        ...list,
        {
          id: typeof messageId === "string" ? messageId : `hint-${list.length}`,
          role: "tutor",
          content,
          guarded: false,
        },
      ]);
  };

  const finish = async () => {
    setError(null);
    setBusy(true);
    const result = await call(
      api.learner.tutor.sessions[":id"].finish.$post({
        param: { id: sessionId },
      }),
    );
    setBusy(false);
    if (!result.ok) {
      if (result.code === "session_finished") setFinished(true);
      return setError(result.code);
    }
    setFinished(true);
    const assessment = read(result.data, "assessment");
    const understanding = read(assessment, "understanding");
    const confidence = read(assessment, "confidence");
    const hypotheses = read(result.data, "hypotheses");
    setOutcome({
      assessment:
        typeof understanding === "number" && typeof confidence === "number"
          ? { understanding, confidence }
          : null,
      hypotheses: Array.isArray(hypotheses) ? hypotheses.length : null,
    });
  };

  const percent = (v: number) => Math.round(v * 100);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.ground }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <Stack.Screen options={{ title: m.tutor.modes[mode] }} />
      <ScrollView
        ref={scroll}
        contentContainerStyle={{ padding: space.lg, gap: space.md }}
        onContentSizeChange={() =>
          scroll.current?.scrollToEnd({ animated: true })
        }
        keyboardShouldPersistTaps="handled"
      >
        {notionName ? <Text variant="muted">{notionName}</Text> : null}
        {statement ? (
          <Card tone="sunk">
            <Text variant="small">{m.exercises.statement}</Text>
            <Text>{statement}</Text>
            <View style={{ alignItems: "flex-start", marginLeft: -space.md }}>
              <ListenButton text={statement} label={m.exercises.listen} />
            </View>
          </Card>
        ) : null}
        {messages.length === 0 && !waiting && !finished && (
          <Bubble
            mine={false}
            label={m.tutor.chat.tutor}
            tools={<ListenButton text={m.tutor.chat.intro[mode]} />}
          >
            {m.tutor.chat.intro[mode]}
          </Bubble>
        )}
        {messages.map((msg) => (
          <Bubble
            key={msg.id}
            mine={msg.role === "learner"}
            label={
              msg.role === "learner" ? m.tutor.chat.you : m.tutor.chat.tutor
            }
            tools={
              msg.role === "tutor" ? (
                <ListenButton text={msg.content} />
              ) : undefined
            }
          >
            {msg.content}
          </Bubble>
        ))}
        {waiting !== null && (
          <>
            <Bubble mine label={m.tutor.chat.you}>
              {waiting}
            </Bubble>
            <Bubble mine={false} label={m.tutor.chat.tutor}>
              <Text variant="muted">{m.tutor.chat.sending}</Text>
            </Bubble>
          </>
        )}
        <Notice code={error} />
        {finished && (
          <Card tone="sunk">
            <Text variant="label">{m.tutor.chat.finished}</Text>
            {outcome?.assessment ? (
              <Text>
                {m.tutor.chat.assessment(
                  percent(outcome.assessment.understanding),
                  percent(outcome.assessment.confidence),
                )}
              </Text>
            ) : null}
            {outcome?.hypotheses != null ? (
              <Text>{m.tutor.chat.intakeDone(outcome.hypotheses)}</Text>
            ) : null}
            <Inline>
              {mode === "intake" && (
                <Button
                  variant="outline"
                  size="sm"
                  label={m.tutor.chat.seeProfile}
                  onPress={() => router.navigate("/moi")}
                />
              )}
              {variantId && (
                <Button
                  variant="outline"
                  size="sm"
                  label={m.tutor.chat.goExercise}
                  onPress={() =>
                    router.push({
                      pathname: "/exercice/[id]",
                      params: { id: variantId },
                    })
                  }
                />
              )}
            </Inline>
          </Card>
        )}
      </ScrollView>

      {!finished && (
        <SafeAreaView
          edges={["bottom"]}
          style={{
            borderTopWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.surface,
            padding: space.md,
            gap: space.sm,
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            maxLength={2000}
            multiline
            placeholder={
              oral ? m.tutor.chat.placeholderOral : m.tutor.chat.placeholder
            }
            placeholderTextColor={colors.inkMuted}
            accessibilityLabel={m.tutor.chat.placeholder}
            style={{
              minHeight: 44,
              maxHeight: 140,
              borderWidth: 1,
              borderColor: colors.lineStrong,
              borderRadius: radius.md,
              paddingHorizontal: space.md,
              paddingVertical: space.sm,
              color: colors.ink,
              fontFamily: fonts.body,
              fontSize: 16,
            }}
          />
          <Inline>
            <Button
              icon="send"
              label={m.tutor.chat.send}
              disabled={working || draft.trim() === ""}
              pending={waiting !== null}
              onPress={send}
            />
            {mode === "exercise_help" && (
              <Button
                variant="outline"
                icon="bulb-outline"
                label={`${m.tutor.chat.hint} (${m.tutor.chat.hintsLeft(Math.max(0, MAX_HINTS - hints))})`}
                disabled={working || hints >= MAX_HINTS}
                onPress={hint}
              />
            )}
            <Button
              variant="ghost"
              icon="stop-circle-outline"
              label={m.tutor.chat.finish}
              disabled={working}
              onPress={finish}
            />
          </Inline>
        </SafeAreaView>
      )}
    </KeyboardAvoidingView>
  );
}
