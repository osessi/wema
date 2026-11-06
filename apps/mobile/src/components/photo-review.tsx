import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Image, View } from "react-native";
import { m } from "../i18n/fr";
import { preparePhoto, type Review, sendPhoto } from "../lib/photo";
import { radius, space, useTheme } from "../theme";
import { Badge, Button, Card, Icon, Inline, Notice, Section, Text } from "./ui";

type Stage =
  | { kind: "idle" }
  | { kind: "preview"; uri: string }
  | { kind: "sending"; uri: string }
  | { kind: "done"; review: Review };

/**
 * Photo de la feuille : l'appareil photo (ou la galerie) via expo-image-picker,
 * réduite en JPEG, puis relue par le prof IA. Rien n'est gardé sur le serveur.
 */
export function PhotoReview({ variantId }: { variantId: string }) {
  const { colors } = useTheme();
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  const pick = async (source: "camera" | "library") => {
    setError(null);
    setNotice(null);
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setNotice(
        source === "camera" ? m.photo.cameraDenied : m.photo.libraryDenied,
      );
      return;
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: 1,
      exif: false,
    };
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    setPreparing(true);
    try {
      const uri = await preparePhoto(asset.uri, asset.width, asset.height);
      setStage({ kind: "preview", uri });
    } catch {
      setError("photo_unsupported_format");
    } finally {
      setPreparing(false);
    }
  };

  const send = async (uri: string) => {
    setStage({ kind: "sending", uri });
    setError(null);
    const result = await sendPhoto(variantId, uri);
    if (result.ok) setStage({ kind: "done", review: result.data });
    else {
      setError(result.code);
      setStage({ kind: "preview", uri });
    }
  };

  return (
    <Section title={m.photo.title}>
      <Text variant="muted">{m.photo.description}</Text>

      {(stage.kind === "idle" || stage.kind === "done") && (
        <Inline>
          <Button
            icon="camera-outline"
            variant="outline"
            label={stage.kind === "done" ? m.photo.another : m.photo.takePhoto}
            pending={preparing}
            onPress={() => void pick("camera")}
          />
          <Button
            icon="image-outline"
            variant="ghost"
            label={m.photo.chooseImage}
            disabled={preparing}
            onPress={() => void pick("library")}
          />
        </Inline>
      )}
      {preparing && <Text variant="small">{m.photo.preparing}</Text>}

      {(stage.kind === "preview" || stage.kind === "sending") && (
        <Card>
          <Image
            source={{ uri: stage.uri }}
            accessibilityIgnoresInvertColors
            style={{
              width: "100%",
              aspectRatio: 3 / 4,
              borderRadius: radius.lg,
              backgroundColor: colors.surfaceSunk,
            }}
            resizeMode="contain"
          />
          <Text variant="small">{m.photo.privacy}</Text>
          <Inline>
            <Button
              icon="send-outline"
              label={
                stage.kind === "sending" ? m.photo.reading : m.photo.confirm
              }
              pending={stage.kind === "sending"}
              onPress={() => void send(stage.uri)}
            />
            <Button
              variant="ghost"
              label={m.photo.retake}
              disabled={stage.kind === "sending"}
              onPress={() => setStage({ kind: "idle" })}
            />
          </Inline>
        </Card>
      )}

      <Notice code={error} text={notice} />

      {stage.kind === "done" &&
        (stage.review.readable ? (
          <Card>
            <Text variant="label">{m.photo.stepsTitle}</Text>
            {stage.review.steps.map((step, i) => {
              const stuck =
                stage.review.readable && i === stage.review.stuckStep;
              return (
                <View
                  // biome-ignore lint/suspicious/noArrayIndexKey: étapes lues dans l'ordre de la copie, liste fixe
                  key={`${i}-${step.text}`}
                  style={{
                    gap: space.xs,
                    padding: space.sm,
                    borderRadius: radius.md,
                    backgroundColor: stuck ? colors.peach : "transparent",
                  }}
                >
                  <Text style={stuck ? { color: colors.peachInk } : undefined}>
                    {step.text}
                  </Text>
                  <Badge
                    tone={
                      stuck
                        ? "peach"
                        : step.status === "correct"
                          ? "sunk"
                          : "outline"
                    }
                    label={
                      stuck
                        ? m.photo.stepStuck
                        : step.status === "correct"
                          ? m.photo.stepCorrect
                          : step.status === "incorrect"
                            ? m.photo.stepIncorrect
                            : m.photo.stepUnverified
                    }
                  />
                </View>
              );
            })}
            {(stage.review.issue !== null ||
              stage.review.stuckStep === null) && (
              <>
                <Text variant="label">{m.photo.issueTitle}</Text>
                <Text>{stage.review.issue ?? m.photo.noIssue}</Text>
              </>
            )}
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Icon name="bulb-outline" />
              <Text variant="label">{m.photo.feedbackTitle}</Text>
            </View>
            <Text>{stage.review.feedback}</Text>
          </Card>
        ) : (
          <Notice text={m.photo.unreadable} />
        ))}
    </Section>
  );
}
