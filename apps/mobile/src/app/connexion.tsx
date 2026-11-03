import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import {
  Button,
  Card,
  Field,
  Inline,
  Notice,
  Screen,
  Text,
} from "../components/ui";
import { m } from "../i18n/fr";
import { apiBaseUrl } from "../lib/config";
import { useSession } from "../lib/session";
import { radius, space, useTheme } from "../theme";

type Method = "email" | "code";

export default function LoginScreen() {
  const { colors } = useTheme();
  const { loginWithEmail, loginWithCode } = useSession();
  const [method, setMethod] = useState<Method>("email");
  const [id, setId] = useState("");
  const [secret, setSecret] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!id.trim() || !secret) return;
    setPending(true);
    setError(null);
    const failed =
      method === "email"
        ? await loginWithEmail(id.trim(), secret)
        : await loginWithCode(id.trim(), secret);
    setPending(false);
    if (failed) setError(failed);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen edges={["top", "bottom"]}>
        <View style={{ gap: space.sm, marginTop: space.xxl }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: radius.xl,
              backgroundColor: colors.brand,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text variant="title" style={{ color: colors.inkOnBrand }}>
              W
            </Text>
          </View>
          <Text variant="title" accessibilityRole="header">
            {m.login.title}
          </Text>
          <Text variant="muted">{m.login.subtitle}</Text>
        </View>

        <Card>
          <Inline>
            {(["email", "code"] as const).map((k) => (
              <Pressable
                key={k}
                accessibilityRole="tab"
                accessibilityState={{ selected: method === k }}
                onPress={() => {
                  setMethod(k);
                  setError(null);
                }}
                style={{
                  paddingHorizontal: space.md,
                  paddingVertical: space.sm,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: method === k ? colors.ink : colors.lineStrong,
                  backgroundColor:
                    method === k ? colors.surfaceSunk : "transparent",
                }}
              >
                <Text variant="label">
                  {k === "email" ? m.login.withEmail : m.login.withCode}
                </Text>
              </Pressable>
            ))}
          </Inline>

          {method === "email" ? (
            <>
              <Field
                label={m.login.email}
                value={id}
                onChangeText={setId}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="username"
              />
              <Field
                label={m.login.password}
                value={secret}
                onChangeText={setSecret}
                secureTextEntry
                autoComplete="current-password"
                textContentType="password"
                onSubmitEditing={submit}
              />
            </>
          ) : (
            <>
              <Text variant="small">{m.login.usernameHint}</Text>
              <Field
                label={m.login.username}
                value={id}
                onChangeText={setId}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
              />
              <Field
                label={m.login.code}
                value={secret}
                onChangeText={setSecret}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                onSubmitEditing={submit}
              />
            </>
          )}
          <Button
            label={pending ? m.login.pending : m.login.submit}
            size="lg"
            pending={pending}
            disabled={!id.trim() || !secret}
            onPress={submit}
          />
        </Card>
        <Notice code={error} />
        <Text variant="small">{m.login.server(apiBaseUrl())}</Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}
