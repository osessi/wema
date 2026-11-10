import { Avatar, AvatarFallback } from "@wema/ui/components/ui/avatar";
import { cn } from "@wema/ui/lib/utils";

/** Fonds doux des avatars, choisis d'après le nom (stables d'une page à l'autre). */
const TONES = [
  "bg-brand-soft text-brand-text",
  "bg-info-soft text-info-text",
  "bg-success-soft text-success-text",
  "bg-muted text-foreground",
] as const;

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

function toneOf(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + (c.codePointAt(0) ?? 0)) >>> 0;
  return TONES[h % TONES.length] ?? TONES[0];
}

/** Avatar à initiales d'un membre (décoratif : le nom est écrit à côté). */
export function MemberAvatar({
  name,
  size = "default",
  className,
}: {
  name: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  return (
    <Avatar size={size} aria-hidden className={className}>
      <AvatarFallback className={cn(toneOf(name))}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
