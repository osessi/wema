import { Pressable, View } from "react-native";
import { radius, space, useTheme } from "../theme";
import { Icon, Text } from "./ui";

export interface Choice {
  id: string;
  label: string;
  help?: string;
}

/** Liste à choix unique (boutons radio), lisible au doigt. */
export function ChoiceList({
  choices,
  value,
  onChange,
}: {
  choices: readonly Choice[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
      {choices.map((c) => {
        const selected = c.id === value;
        return (
          <Pressable
            key={c.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(c.id)}
            style={{
              flexDirection: "row",
              gap: space.md,
              alignItems: "flex-start",
              padding: space.md,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: selected ? colors.ink : colors.line,
              backgroundColor: selected ? colors.surfaceSunk : colors.surface,
            }}
          >
            <Icon
              name={selected ? "radio-button-on" : "radio-button-off"}
              color={selected ? colors.ink : colors.inkMuted}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label">{c.label}</Text>
              {c.help ? <Text variant="small">{c.help}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
