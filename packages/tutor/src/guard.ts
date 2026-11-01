import type { CanonicalAnswer } from "@wema/domain";

// Contrôle « jamais la réponse finale » (AGENTS.md, règle 1) : avant d'envoyer
// une réponse du prof IA sur un exercice dont on connaît la solution, on
// vérifie qu'elle ne la donne pas. Le contrôle préfère bloquer à tort (la
// réponse est alors reformulée) que laisser passer la solution.

/** Écriture compacte : minuscules, sans espaces ni signes de multiplication, notations unifiées. */
export function compact(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[−–]/g, "-")
    .replace(/[×·*]/g, "")
    .replace(/\s+/g, "")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/racinecarréede|racinede/g, "√")
    .replace(/sqrt\(([^()]+)\)/g, "√$1")
    .replace(/\*\*/g, "^");
}

/** Écritures possibles d'une valeur SymPy (ex. 2*sqrt(13) → 2√13 ; -3 → -3). */
function forms(value: string): string[] {
  const base = compact(value);
  const out = new Set([base]);
  out.add(base.replace(/√\(([^()]+)\)/g, "√$1"));
  if (base.startsWith("(") && base.endsWith(")")) out.add(base.slice(1, -1));
  return [...out].filter((f) => f.length > 0);
}

/**
 * `needle` présent dans `hay`, sans se prolonger en un autre nombre après lui
 * (chiffre, décimale, puissance, racine, lettre). Une unité usuelle
 * (« 7.2cm ») est permise avec `allowUnit`.
 */
function containsValue(
  hay: string,
  needle: string,
  allowUnit = false,
): boolean {
  let from = 0;
  for (;;) {
    const at = hay.indexOf(needle, from);
    if (at < 0) return false;
    const rest = hay.slice(at + needle.length);
    const unit =
      allowUnit &&
      /^(mm|cm|dm|km|m|kg|g|ml|cl|l|min|s|h|°|€)(?![a-z])/.test(rest);
    const continues =
      /^([0-9√^]|\.\d)/.test(rest) || (!unit && /^[a-z]/.test(rest));
    if (!continues) return true;
    from = at + 1;
  }
}

const ANNOUNCE =
  /(laréponse|lerésultat|lasolution|ontrouve|çadonne|cadonne|doncx?|c'est|vaut|égalà|égale|=|≈)/g;
/** Mots de liaison entre l'annonce et la valeur (« la réponse est donc environ 3 »). */
const FILLER =
  /^(est|sont|donc|alors|de|environ|àpeuprès|:|=|≈|vaut|égale?|à)+/;

/** Texte qui suit chaque annonce, sans les mots de liaison. */
function afterAnnouncements(hay: string, length: number): string[] {
  return [...hay.matchAll(ANNOUNCE)].map((m) => {
    const start = (m.index ?? 0) + m[0].length;
    return hay.slice(start, start + length).replace(FILLER, "");
  });
}

/**
 * Valeur décimale approchée d'une écriture simple (entier, décimal, fraction,
 * k·√n), pour reconnaître un arrondi. Ce n'est pas un calcul servi à l'élève :
 * seulement un filet pour le contrôle.
 */
function approximate(value: string): number | null {
  const v = value.replace(/\s+/g, "");
  const sqrt = /^(-?\d+)?\*?sqrt\((\d+)\)$/.exec(v);
  if (sqrt) return Number(sqrt[1] ?? 1) * Math.sqrt(Number(sqrt[2]));
  const fraction = /^(-?\d+)\/(\d+)$/.exec(v);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Vrai si le texte donne la réponse attendue : « x = 3 », « la réponse est 3 »,
 * « BC ≈ 7,2 », ou la forme développée attendue écrite telle quelle.
 */
export function revealsAnswer(text: string, answer: CanonicalAnswer): boolean {
  const hay = compact(text);
  const values = answer.kind === "solutions" ? answer.values : [answer.value];
  for (const value of values) {
    for (const form of forms(value)) {
      if (
        answer.kind === "solutions" &&
        containsValue(hay, `${compact(answer.variable)}=${form}`)
      )
        return true;
      if (answer.kind === "expression") {
        // Une expression développée ou factorisée recopiée est déjà la réponse.
        if (form.length >= 4 && containsValue(hay, form)) return true;
        continue;
      }
      // Valeur annoncée juste après un mot ou un signe qui conclut.
      if (
        afterAnnouncements(hay, 40).some(
          (after) => after.startsWith(form) && containsValue(after, form, true),
        )
      ) {
        return true;
      }
    }
    if (answer.kind === "number" && answer.decimals !== null) {
      const approx = approximate(value);
      if (approx !== null) {
        const rounded = approx.toFixed(answer.decimals);
        if (
          afterAnnouncements(hay, 20).some(
            (after) =>
              after.startsWith(rounded) && containsValue(after, rounded, true),
          )
        ) {
          return true;
        }
      }
    }
  }
  return false;
}
