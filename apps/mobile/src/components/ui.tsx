import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Text as RNText,
  ScrollView,
  StyleSheet,
  TextInput,
  type TextInputProps,
  type TextProps,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { errorMessage, m } from "../i18n/fr";
import type { NotionStatus } from "../lib/types";
import { fonts, type Palette, radius, space, useTheme } from "../theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export function Icon({
  name,
  size = 20,
  color,
}: {
  name: IconName;
  size?: number;
  color?: ComponentProps<typeof Ionicons>["color"];
}) {
  const { colors } = useTheme();
  return <Ionicons name={name} size={size} color={color ?? colors.ink} />;
}

/** Écran défilant, avec « tirer pour actualiser » si `onRefresh` est fourni. */
export function Screen({
  children,
  refreshing = false,
  onRefresh,
  edges = [],
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: ("top" | "bottom")[];
}) {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      edges={edges}
      style={{ flex: 1, backgroundColor: colors.ground }}
    >
      <ScrollView
        contentContainerStyle={styles.screen}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.inkMuted}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

type Variant = "title" | "heading" | "body" | "muted" | "small" | "label";

export function Text({
  variant = "body",
  style,
  ...props
}: TextProps & { variant?: Variant }) {
  const { colors } = useTheme();
  return (
    <RNText
      {...props}
      style={[textStyle(variant, colors), style]}
      maxFontSizeMultiplier={1.6}
    />
  );
}

function textStyle(variant: Variant, colors: Palette) {
  switch (variant) {
    case "title":
      return {
        fontFamily: fonts.display,
        fontSize: 28,
        lineHeight: 34,
        color: colors.ink,
      };
    case "heading":
      return {
        fontFamily: fonts.display,
        fontSize: 20,
        lineHeight: 26,
        color: colors.ink,
      };
    case "muted":
      return {
        fontFamily: fonts.body,
        fontSize: 15,
        lineHeight: 21,
        color: colors.inkMuted,
      };
    case "small":
      return {
        fontFamily: fonts.body,
        fontSize: 13,
        lineHeight: 18,
        color: colors.inkMuted,
      };
    case "label":
      return {
        fontFamily: fonts.semibold,
        fontSize: 15,
        lineHeight: 21,
        color: colors.ink,
      };
    default:
      return {
        fontFamily: fonts.body,
        fontSize: 16,
        lineHeight: 23,
        color: colors.ink,
      };
  }
}

export function Card({
  children,
  tone = "plain",
  style,
}: {
  children: ReactNode;
  tone?: "plain" | "brand" | "sunk";
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const tones = {
    plain: { backgroundColor: colors.surface, borderColor: colors.line },
    brand: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
    sunk: { backgroundColor: colors.surfaceSunk, borderColor: colors.line },
  };
  return <View style={[styles.card, tones[tone], style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled = false,
  pending = false,
  size = "md",
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "ghost";
  icon?: IconName;
  disabled?: boolean;
  pending?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const { colors } = useTheme();
  const fg = variant === "primary" ? colors.onAction : colors.ink;
  const off = disabled || pending;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy: pending }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        size === "sm" && styles.buttonSm,
        size === "lg" && styles.buttonLg,
        variant === "primary" && { backgroundColor: colors.action },
        variant === "outline" && {
          borderWidth: 1,
          borderColor: colors.lineStrong,
          backgroundColor: colors.surface,
        },
        { opacity: off ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      {pending ? (
        <ActivityIndicator color={fg} size="small" />
      ) : icon ? (
        <Icon name={icon} size={size === "sm" ? 16 : 18} color={fg} />
      ) : null}
      <RNText
        style={{
          color: fg,
          fontFamily: fonts.semibold,
          fontSize: size === "sm" ? 14 : 16,
        }}
      >
        {label}
      </RNText>
    </Pressable>
  );
}

export function Badge({
  label,
  tone = "outline",
}: {
  label: string;
  tone?: "outline" | "solid" | "sunk" | "peach" | "butter" | "brand";
}) {
  const { colors } = useTheme();
  const tones = {
    outline: { bg: "transparent", fg: colors.ink, border: colors.lineStrong },
    solid: { bg: colors.action, fg: colors.onAction, border: colors.action },
    sunk: { bg: colors.surfaceSunk, fg: colors.inkMuted, border: colors.line },
    peach: { bg: colors.peach, fg: colors.peachInk, border: colors.peach },
    butter: { bg: colors.butter, fg: colors.butterInk, border: colors.butter },
    brand: { bg: colors.brand, fg: colors.inkOnBrand, border: colors.brand },
  };
  const t = tones[tone];
  return (
    <View
      style={[styles.badge, { backgroundColor: t.bg, borderColor: t.border }]}
    >
      <RNText style={{ color: t.fg, fontFamily: fonts.medium, fontSize: 12 }}>
        {label}
      </RNText>
    </View>
  );
}

/** Statut d'une notion selon la charte : Non vue, À travailler, En cours, Validé. */
export const STATUS_TONE: Record<
  NotionStatus,
  "sunk" | "peach" | "butter" | "solid"
> = {
  not_seen: "sunk",
  needs_work: "peach",
  in_progress: "butter",
  mastered: "solid",
};

export function StatusBadge({ status }: { status: NotionStatus }) {
  return <Badge label={m.status[status]} tone={STATUS_TONE[status]} />;
}

export function Field(props: TextInputProps & { label?: string }) {
  const { colors } = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: space.xs }}>
      {label ? <Text variant="label">{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.inkMuted}
        {...rest}
        style={[
          styles.input,
          {
            borderColor: colors.lineStrong,
            backgroundColor: colors.surface,
            color: colors.ink,
          },
          style,
        ]}
      />
    </View>
  );
}

/** Message d'erreur sobre (jamais en rouge pour une réponse d'élève). */
export function Notice({
  code,
  text,
  onRetry,
}: {
  code?: string | null;
  text?: string | null;
  onRetry?: () => void;
}) {
  if (!code && !text) return null;
  return (
    <Card tone="sunk">
      <Text accessibilityRole="alert">
        {text ?? errorMessage(code ?? "generic")}
      </Text>
      {onRetry ? (
        <View style={{ alignItems: "flex-start" }}>
          <Button
            label={m.common.retry}
            variant="outline"
            size="sm"
            onPress={onRetry}
          />
        </View>
      ) : null}
    </Card>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={styles.loading} accessibilityLabel={m.common.loading}>
      <ActivityIndicator color={colors.inkMuted} />
    </View>
  );
}

/** Ligne cliquable (liste de devoirs, séances, conversations). */
export function Row({
  title,
  subtitle,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string | null;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: colors.line,
          backgroundColor: pressed ? colors.surfaceSunk : colors.surface,
        },
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label">{title}</Text>
        {subtitle ? <Text variant="small">{subtitle}</Text> : null}
      </View>
      {right}
      {onPress ? (
        <Icon name="chevron-forward" size={18} color={colors.inkMuted} />
      ) : null}
    </Pressable>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: space.md }}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

export function Inline({ children }: { children: ReactNode }) {
  return <View style={styles.inline}>{children}</View>;
}

export const styles = StyleSheet.create({
  screen: { padding: space.lg, gap: space.xl, paddingBottom: space.xxl * 2 },
  card: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space.lg,
    gap: space.md,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    minHeight: 44,
  },
  buttonSm: { minHeight: 36, paddingHorizontal: space.md },
  buttonLg: { minHeight: 52, paddingHorizontal: space.xl },
  badge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  loading: { padding: space.xxl, alignItems: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space.lg,
  },
  inline: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
