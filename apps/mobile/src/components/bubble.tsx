import type { ReactNode } from "react";
import { View } from "react-native";
import { radius, space, useTheme } from "../theme";
import { Text } from "./ui";

/** Bulle d'une conversation : l'élève à droite (fond creusé), l'autre à gauche (carte). */
export function Bubble({
  mine,
  label,
  children,
  tools,
}: {
  mine: boolean;
  label: string;
  children: ReactNode;
  tools?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: mine ? "flex-end" : "flex-start", gap: 2 }}>
      <Text variant="small">{label}</Text>
      <View
        style={{
          maxWidth: "88%",
          borderRadius: radius.xl,
          paddingHorizontal: space.lg,
          paddingVertical: space.sm,
          backgroundColor: mine ? colors.surfaceSunk : colors.surface,
          borderWidth: mine ? 0 : 1,
          borderColor: colors.line,
          gap: space.xs,
        }}
      >
        {typeof children === "string" ? <Text>{children}</Text> : children}
        {tools}
      </View>
    </View>
  );
}
