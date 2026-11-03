import { useState } from "react";
import { TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { m } from "../i18n/fr";
import { fonts, radius, space, useTheme } from "../theme";
import { Button, Inline } from "./ui";

/** Zone d'écriture en bas d'une conversation. */
export function Composer({
  onSend,
  placeholder = m.messages.placeholder,
}: {
  onSend: (text: string) => Promise<boolean>;
  placeholder?: string;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const send = async () => {
    const text = draft.trim();
    if (!text || pending) return;
    setPending(true);
    if (await onSend(text)) setDraft("");
    setPending(false);
  };
  return (
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
        maxLength={4000}
        multiline
        placeholder={placeholder}
        placeholderTextColor={colors.inkMuted}
        accessibilityLabel={placeholder}
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
          label={pending ? m.messages.sending : m.messages.send}
          pending={pending}
          disabled={draft.trim() === ""}
          onPress={send}
        />
      </Inline>
    </SafeAreaView>
  );
}
