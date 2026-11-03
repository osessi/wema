import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import {
  Button,
  Card,
  Icon,
  Loading,
  Notice,
  Screen,
  Text,
} from "../components/ui";
import { m } from "../i18n/fr";
import { api, call } from "../lib/api";
import { webBaseUrl } from "../lib/config";
import { useSession } from "../lib/session";
import { radius, space, useTheme } from "../theme";

type Versions = { termsVersion: string; privacyVersion: string };

/**
 * Acceptation des conditions (comme /compte/conditions sur le web) : tant que
 * `/auth/me` renvoie `mustAcceptTerms`, l'appli n'affiche que cet écran.
 */
export default function AcceptTermsScreen() {
  const { colors } = useTheme();
  const { refresh, logout } = useSession();
  const [versions, setVersions] = useState<Versions | null>(null);
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await call(api.legal.versions.$get());
    if (res.ok)
      setVersions({
        termsVersion: res.data.termsVersion,
        privacyVersion: res.data.privacyVersion,
      });
    else setError(res.code);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const accept = async () => {
    if (!versions) return;
    setPending(true);
    setError(null);
    const res = await call(api.account.terms.$post({ json: versions }));
    if (!res.ok) {
      setPending(false);
      setError(res.code);
      // Version changée entre-temps : on affiche la nouvelle, à relire.
      if (res.code === "terms_outdated") {
        setChecked(false);
        await load();
      }
      return;
    }
    const failed = await refresh();
    setPending(false);
    if (failed) setError(failed);
  };

  const open = (path: string) => {
    void Linking.openURL(`${webBaseUrl()}${path}`).catch(() => undefined);
  };

  return (
    <Screen edges={["top", "bottom"]}>
      <View style={{ gap: space.sm, marginTop: space.xxl }}>
        <Text variant="title" accessibilityRole="header">
          {m.terms.title}
        </Text>
        <Text variant="muted">{m.terms.body}</Text>
      </View>

      {!versions && !error ? <Loading /> : null}
      {versions ? (
        <Notice code={error} />
      ) : (
        <Notice code={error} onRetry={() => void load()} />
      )}

      {versions ? (
        <Card>
          <Pressable
            accessibilityRole="link"
            onPress={() => open("/conditions")}
          >
            <Text style={{ textDecorationLine: "underline" }}>
              {m.terms.terms(versions.termsVersion)}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            onPress={() => open("/confidentialite")}
          >
            <Text style={{ textDecorationLine: "underline" }}>
              {m.terms.privacy(versions.privacyVersion)}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            onPress={() => setChecked((v) => !v)}
            style={{
              flexDirection: "row",
              gap: space.sm,
              alignItems: "flex-start",
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: colors.lineStrong,
                backgroundColor: checked ? colors.action : colors.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {checked ? (
                <Icon name="checkmark" size={16} color={colors.onAction} />
              ) : null}
            </View>
            <Text style={{ flex: 1 }}>{m.terms.checkbox}</Text>
          </Pressable>
          <Button
            label={m.terms.submit}
            onPress={() => void accept()}
            disabled={!checked}
            pending={pending}
          />
          <Button
            label={m.terms.logout}
            variant="ghost"
            onPress={() => void logout()}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
