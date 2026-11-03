import { m } from "../i18n/fr";
import { useSpeaker } from "../lib/speech";
import { Button } from "./ui";

/** « Écouter » : lit le texte avec la voix du téléphone ; un second appui arrête. */
export function ListenButton({
  text,
  label = m.tutor.chat.listen,
}: {
  text: string;
  label?: string;
}) {
  const speaker = useSpeaker();
  return (
    <Button
      variant="ghost"
      size="sm"
      icon={speaker.speaking ? "stop-circle-outline" : "volume-high-outline"}
      label={speaker.speaking ? m.tutor.chat.stop : label}
      onPress={() => (speaker.speaking ? speaker.stop() : speaker.speak(text))}
    />
  );
}
