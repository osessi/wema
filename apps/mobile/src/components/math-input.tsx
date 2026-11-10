import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { m } from "../i18n/fr";
import {
  eraseAt,
  insertAt,
  MATH_KEYS,
  type MathKey,
  toAnswerText,
} from "../lib/math-answer";
import { fonts, radius, space, useTheme } from "../theme";
import { Icon } from "./ui";

const a11yLabel = (key: MathKey) =>
  key.a11y === "sqrt"
    ? m.keyboard.sqrt
    : key.a11y === "power"
      ? m.keyboard.power
      : key.a11y === "fraction"
        ? m.keyboard.fraction
        : key.a11y === "or"
          ? m.keyboard.or
          : key.label;

/**
 * Champ de réponse avec des touches mathématiques (MathLive n'existe pas en
 * natif). L'élève tape au clavier du téléphone ou avec les touches ; la
 * réponse remontée est déjà au format de services/math.
 */
export function MathInput({
  disabled,
  onChange,
  onSubmit,
}: {
  disabled: boolean;
  onChange: (answer: string) => void;
  onSubmit: () => void;
}) {
  const { colors } = useTheme();
  const [value, setValue] = useState("");
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  const update = (next: { value: string; cursor: number }) => {
    setValue(next.value);
    setSelection({ start: next.cursor, end: next.cursor });
    onChange(toAnswerText(next.value));
  };

  return (
    <View style={{ gap: space.md }}>
      <TextInput
        value={value}
        editable={!disabled}
        selection={selection}
        onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
        onChangeText={(text) => {
          setValue(text);
          onChange(toAnswerText(text));
        }}
        onSubmitEditing={onSubmit}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        returnKeyType="done"
        placeholder={m.exercises.answerPlaceholder}
        placeholderTextColor={colors.inkMuted}
        accessibilityLabel={m.exercises.answer}
        style={[
          styles.field,
          {
            borderColor: colors.lineStrong,
            backgroundColor: colors.surface,
            color: colors.ink,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      />
      {!disabled && (
        <View accessibilityLabel={m.keyboard.label} style={{ gap: space.sm }}>
          {MATH_KEYS.map((row) => (
            <View key={row.map((k) => k.label).join("")} style={styles.row}>
              {row.map((key) => (
                <Pressable
                  key={key.label}
                  accessibilityRole="button"
                  accessibilityLabel={a11yLabel(key)}
                  onPress={() => update(insertAt(value, selection, key))}
                  style={({ pressed }) => [
                    styles.key,
                    {
                      borderColor: colors.line,
                      backgroundColor: pressed
                        ? colors.surfaceSunk
                        : colors.surface,
                    },
                  ]}
                >
                  <Text style={[styles.keyText, { color: colors.ink }]}>
                    {key.label}
                  </Text>
                </Pressable>
              ))}
              {row === MATH_KEYS[MATH_KEYS.length - 1] && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={m.keyboard.erase}
                  onPress={() => update(eraseAt(value, selection))}
                  style={({ pressed }) => [
                    styles.key,
                    {
                      borderColor: colors.line,
                      backgroundColor: pressed
                        ? colors.surfaceSunk
                        : colors.surface,
                    },
                  ]}
                >
                  <Icon name="backspace-outline" />
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontFamily: fonts.medium,
    fontSize: 22,
  },
  row: { flexDirection: "row", gap: space.sm },
  key: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: { fontFamily: fonts.medium, fontSize: 18 },
});
