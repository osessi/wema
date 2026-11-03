import type { CanonicalAnswer } from "@wema/domain";
import type { MathVerifier } from "@wema/exercises";

// Contrôle « jamais la réponse finale » (AGENTS.md, règle 1) : avant d'envoyer
// une réponse du prof IA sur un exercice dont on connaît la solution, on
// vérifie qu'elle ne la donne pas. Le contrôle préfère bloquer à tort (la
// réponse est alors reformulée) que laisser passer la solution.
//
// Deux étages :
// - `revealsAnswer`, synchrone : écritures usuelles de la solution (chiffres,
//   lettres, fractions, racines, LaTeX, ordre des termes) repérées sur un
//   texte normalisé ;
// - `leaksAnswer` : le même contrôle, plus les valeurs candidates du texte
//   soumises à services/math, seul juge de l'équivalence (règle 2). Une
//   valeur que l'élève a lui-même écrite n'est pas une fuite.

const LETTER = "a-zà-ÿœæ";

/** Nombres écrits en lettres, jusqu'à vingt (les composés d'abord). */
const NUMBER_WORDS: [string, string][] = [
  ["dix-sept", "17"],
  ["dix-huit", "18"],
  ["dix-neuf", "19"],
  ["zéro", "0"],
  ["deux", "2"],
  ["trois", "3"],
  ["quatre", "4"],
  ["cinq", "5"],
  ["six", "6"],
  ["sept", "7"],
  ["huit", "8"],
  ["neuf", "9"],
  ["dix", "10"],
  ["onze", "11"],
  ["douze", "12"],
  ["treize", "13"],
  ["quatorze", "14"],
  ["quinze", "15"],
  ["seize", "16"],
  ["vingt", "20"],
];

const word = (w: string) =>
  new RegExp(`(?<![${LETTER}])${w}(?![${LETTER}])`, "g");

/**
 * Écriture normalisée d'un texte ou d'une valeur SymPy : minuscules, notations
 * unifiées (apostrophes, signes, fractions, racines, LaTeX, mots « plus »,
 * « moins », « fois », nombres en lettres), espaces retirés autour des
 * opérateurs. Les autres espaces restent : ils séparent les mots.
 */
export function normalizeMath(text: string): string {
  // Avant NFKC, qui changerait « ² » en « 2 » et « ½ » en « 1⁄2 ».
  let s = text
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/½/g, "1/2")
    .replace(/¼/g, "1/4")
    .replace(/¾/g, "3/4")
    .replace(/⅓/g, "1/3")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘ʼ`]/g, "'")
    .replace(/[−–]/g, "-")
    .replace(/⁄/g, "/")
    .replace(/\\left|\\right|\$|\\\(|\\\)|\\\[|\\\]/g, "");
  // LaTeX : fractions et racines, éventuellement imbriquées.
  for (let i = 0; i < 3; i++) {
    s = s
      .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)")
      .replace(/\\sqrt\{([^{}]*)\}/g, "√($1)");
  }
  s = s
    .replace(/\\sqrt/g, "√")
    .replace(/\\(cdot|times)/g, "*")
    .replace(/\\pm/g, "±")
    .replace(/\\approx/g, "≈")
    .replace(/sqrt\(/g, "√(")
    .replace(/\*\*/g, "^")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/racine carrée de|racine de/g, "√")
    .replace(word("au carré"), "^2")
    .replace(word("plus ou moins"), "±")
    .replace(word("(un|une) demie?|la moitié"), "1/2")
    .replace(word("(un|une) tiers"), "1/3")
    .replace(word("(un|une) quart"), "1/4")
    .replace(word("divisé par"), "/")
    .replace(word("fois"), "*")
    .replace(word("moins"), "-")
    .replace(word("plus"), "+");
  for (const [w, n] of NUMBER_WORDS) s = s.replace(word(w), n);
  // « un » n'est un nombre qu'en fin de phrase (« x vaut un. »), pas dans « un nombre ».
  s = s.replace(
    new RegExp(`(?<![${LETTER}])une?(?=\\s*([.!?;,]|$))`, "g"),
    "1",
  );
  // « 3 x + 6 », « trois x plus six » : un chiffre suivi d'une lettre seule est
  // un produit (3x). Sauf « a », trop souvent le verbe avoir (« 3 a été trouvé »).
  s = s.replace(/(\d) ([b-z])(?![a-zà-ÿ'])/g, "$1$2");
  s = s
    .replace(/\s*([=+\-*/^√±≈()])\s*/g, "$1")
    .replace(/(\d)\*(?=[a-z√(])/g, "$1")
    .replace(/\)\*\(/g, ")(")
    .replace(/√\((\d+(?:\.\d+)?)\)/g, "√$1")
    .replace(/\((-?\d+(?:\.\d+)?)\)(?=\/)/g, "$1")
    .replace(/\/\((\d+(?:\.\d+)?)\)/g, "/$1")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

/** Ancien nom, gardé pour les appelants existants : écriture normalisée sans aucun espace. */
export function compact(text: string): string {
  return normalizeMath(text).replace(/\s+/g, "");
}

// --- Nombres ---------------------------------------------------------------

/** Nombre écrit au début d'un texte normalisé : décimal, fraction, k√n, signe ±. */
const NUMBER_AT_START =
  /^(±)?(-)?(?:(\d+(?:\.\d+)?)?√(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?)/;

interface ParsedNumber {
  text: string;
  value: number;
  /** Écrit avec ± : vaut aussi pour l'opposé. */
  plusMinus: boolean;
  decimals: number;
}

function parseNumberAtStart(s: string): ParsedNumber | null {
  const m = NUMBER_AT_START.exec(s);
  if (!m || m[0] === "" || m[0] === "-" || m[0] === "±") return null;
  const sign = m[2] ? -1 : 1;
  let value: number;
  let digits: string;
  if (m[4] !== undefined) {
    value = Number(m[3] ?? 1) * Math.sqrt(Number(m[4]));
    digits = m[3] ?? "";
  } else {
    const den = m[6] === undefined ? 1 : Number(m[6]);
    if (den === 0) return null;
    value = Number(m[5]) / den;
    digits = m[6] === undefined ? (m[5] ?? "") : "";
  }
  if (!Number.isFinite(value)) return null;
  const decimals = digits.includes(".")
    ? (digits.split(".")[1]?.length ?? 0)
    : 0;
  return { text: m[0], value: sign * value, plusMinus: m[1] === "±", decimals };
}

/** Valeur numérique d'une écriture complète (ex. 2√13, -1/2), ou null. */
function numberOf(s: string): number | null {
  const parsed = parseNumberAtStart(s);
  return parsed && parsed.text === s ? parsed.value : null;
}

const UNIT = /^(mm|cm|dm|km|m|kg|g|ml|cl|l|min|s|h|°|€)(?![a-zà-ÿ])/;

/**
 * Le nombre se prolonge-t-il en autre chose (chiffre, puissance, variable,
 * opération) ? `strict` exige en plus une fin de phrase ou de proposition.
 */
function endsValue(rest: string, strict: boolean): boolean {
  let r = rest;
  // Une unité peut suivre la valeur, collée ou après une espace (« 7.21 cm »).
  const unit = UNIT.exec(r.trimStart());
  if (unit) r = r.trimStart().slice(unit[0].length).replace(/^\^\d/, "");
  if (/^([0-9√^/*(+]|\.\d|-\d|[a-zà-ÿ])/.test(r)) return false;
  if (strict) return /^\s*($|[.!?,;:)}\]…])/.test(r);
  return true;
}

// Annonces fortes : ce qui suit est un résultat. Faibles : seulement si la
// valeur termine la proposition (« le carré de 7 est 49. »).
const STRONG = [
  "=",
  "≈",
  "vaut",
  "valent",
  "égale? à",
  "égal à",
  "égale",
  "c'est",
  "réponse",
  "résultat(?: final)?",
  "solutions?",
  "tu trouves",
  "trouves",
  "on trouve",
  "obtiens",
  "obtient",
  "ça donne",
  "la valeur de [a-z] est",
  "le nombre cherché est",
  "mesure",
  "mesurent",
];
const WEAK = ["est", "sont", "fait", "font", "donne", "donnent", "reste"];
const announce = (words: string[]) =>
  new RegExp(`(?<![${LETTER}])(?:${words.join("|")})(?![${LETTER}])|=|≈`, "g");
const STRONG_RE = announce(STRONG);
const WEAK_RE = new RegExp(
  `(?<![${LETTER}])(?:${WEAK.join("|")})(?![${LETTER}])`,
  "g",
);
/** Mots de liaison entre l'annonce et la valeur (« la réponse est donc environ 3 »). */
const FILLER = new RegExp(
  `^(?:\\s|,|:|\\{|=|≈|(?:est|sont|donc|alors|d'environ|environ|d'à peu près|à peu près|bien|ça|exactement|égale?|à|de|d'|finale?|c'est|tout simplement|juste|bien ça)(?![${LETTER}]))+`,
);
/** Phrase qui désigne une valeur comme la solution (« 3 est la solution »). */
const CONFIRMS = new RegExp(
  `^\\s*(?:est|sont) (?:bien )?(?:la (?:bonne )?(?:réponse|solution)|le (?:bon )?résultat|juste|correcte?|exacte?)|^\\s*(?:convient|marche|fonctionne)(?![${LETTER}])`,
);

/**
 * Verdict sur une valeur : confirmation (« oui », « bravo », « c'est ça »,
 * « ça marche »…) ou infirmation (« non », « faux »). Avec un verdict, citer
 * une valeur protégée revient à la donner, même si l'élève l'a proposée.
 */
const VERDICT = new RegExp(
  `(?<![${LETTER}])(?:oui|bravo|parfait|exactement|bien joué|tout à fait|correcte?|bonne réponse|c'est (?:bien )?(?:ça|bon|juste|exact|correct)|(?:est|réponse) (?:juste|exacte?|correcte?)|ça (?:marche|fonctionne|tombe juste)|le bon|la bonne)(?![${LETTER}])`,
);
/** « Remplace x par » : la valeur qui suit est mise à l'épreuve. */
const REPLACE_BY = new RegExp(`rempla[${LETTER}]* (?:[a-z] )?par `, "g");
/** Issue positive d'une vérification par remplacement. */
const CHECK_CONFIRMS = new RegExp(
  `(?<![${LETTER}])(?:c'est bien|ça (?:marche|fonctionne|colle|tombe juste)|vérifiée?|on retrouve|tu retrouves|l'égalité est vraie)(?![${LETTER}])`,
);
const NEGATION = new RegExp(
  `(?<![${LETTER}])(?:non|pas|faux|fausse|incorrecte?|raté)(?![${LETTER}])`,
);

/**
 * Nombres désignés par un verdict ou une vérification (« remplace x par 3 :
 * … ça marche », « avec 3 ça marche ») : tous les nombres isolés du texte qui
 * ne sont pas pris dans un calcul, quand le texte porte un verdict.
 */
function verdictNumbers(s: string): Candidate[] {
  // « Remplace x par 3 : … c'est bien le second membre » : la vérification confirme 3.
  const checked: Candidate[] = [];
  if (CHECK_CONFIRMS.test(s)) {
    for (const m of s.matchAll(REPLACE_BY)) {
      const parsed = parseNumberAtStart(s.slice((m.index ?? 0) + m[0].length));
      if (parsed) checked.push({ text: parsed.text, number: parsed });
    }
  }
  if (!VERDICT.test(s)) return checked;
  return [
    ...checked,
    ...allNumbers(s)
      .filter(
        (n) => !/[*+\-/^(=≈]$/.test(s.slice(0, n.end - n.number.text.length)),
      )
      .map((n) => ({ text: n.number.text, number: n.number })),
  ];
}

interface Candidate {
  text: string;
  number: ParsedNumber;
}

/** Nombres annoncés comme résultat dans un texte normalisé. */
function announcedNumbers(s: string): Candidate[] {
  const out: Candidate[] = [];
  for (const [re, strict] of [
    [STRONG_RE, false],
    [WEAK_RE, true],
  ] as const) {
    for (const m of s.matchAll(re)) {
      const after = s.slice((m.index ?? 0) + m[0].length).replace(FILLER, "");
      const parsed = parseNumberAtStart(after);
      if (parsed && endsValue(after.slice(parsed.text.length), strict))
        out.push({ text: parsed.text, number: parsed });
    }
  }
  // « 3 est la solution » : la valeur est désignée après coup.
  for (const n of allNumbers(s)) {
    if (CONFIRMS.test(s.slice(n.end)))
      out.push({ text: n.number.text, number: n.number });
  }
  return out;
}

/** Écritures annoncées comme résultat, telles quelles (pour services/math). */
function announcedTokens(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(STRONG_RE)) {
    const after = s.slice((m.index ?? 0) + m[0].length).replace(FILLER, "");
    const token = /^[^\s,;!?:{}]+/.exec(after)?.[0].replace(/\.+$/, "");
    if (token && /\d/.test(token)) out.push(token);
  }
  return out;
}

/** Tous les nombres isolés d'un texte normalisé (pour la reprise de ce que l'élève a écrit). */
function allNumbers(s: string): { number: ParsedNumber; end: number }[] {
  const out: { number: ParsedNumber; end: number }[] = [];
  for (let i = 0; i < s.length; i++) {
    const prev = s[i - 1] ?? " ";
    if (/[0-9.a-zà-ÿ√^/]/.test(prev)) continue;
    const parsed = parseNumberAtStart(s.slice(i));
    if (!parsed) continue;
    const end = i + parsed.text.length;
    if (endsValue(s.slice(end), false)) out.push({ number: parsed, end });
    i = end - 1;
  }
  return out;
}

/** La valeur candidate égale-t-elle l'une des valeurs attendues ? */
function sameNumber(candidate: ParsedNumber, answer: CanonicalAnswer): boolean {
  if (answer.kind === "expression") return false;
  const values = answer.kind === "solutions" ? answer.values : [answer.value];
  for (const v of values) {
    const exact = numberOf(normalizeMath(v));
    if (exact === null) continue;
    const candidates = candidate.plusMinus
      ? [candidate.value, -candidate.value]
      : [candidate.value];
    for (const c of candidates) {
      if (Math.abs(c - exact) < 1e-9) return true;
      // Valeur arrondie au nombre de décimales attendu, ou plus précise (7,21 pour 7,2).
      if (
        answer.kind === "number" &&
        answer.decimals !== null &&
        candidate.decimals >= answer.decimals &&
        Math.abs(c - exact) <= 0.5 * 10 ** -answer.decimals + 1e-9
      ) {
        return true;
      }
    }
  }
  return false;
}

// --- Expressions -----------------------------------------------------------

/** Découpe au premier niveau (hors parenthèses) sur les signes + et -. */
function splitTerms(expr: string): string[] | null {
  const terms: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of expr) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth < 0) return null;
    if (
      depth === 0 &&
      (ch === "+" || ch === "-") &&
      current !== "" &&
      !/[*/^]$/.test(current)
    ) {
      terms.push(current);
      current = ch === "-" ? "-" : "";
      continue;
    }
    current += ch;
  }
  if (depth !== 0) return null;
  terms.push(current);
  return terms.filter((t) => t !== "" && t !== "+");
}

const term = (t: string) => {
  const signed = t.startsWith("-") ? t : `+${t}`;
  return signed
    .replace(/\*/g, "")
    .replace(/^([+-])1(?=[a-z(])/, "$1")
    .replace(/\^1(?!\d)/g, "");
};

/** Clé d'une expression, indépendante de l'ordre des termes et des facteurs (ex. 6 + 3x ≡ 3x + 6). */
function expressionKey(expr: string): string | null {
  const e = expr.replace(/\s+/g, "").replace(/\.$/, "");
  // Une seule lettre par variable ; un mot n'est pas une expression.
  if (!/[a-z]/.test(e) || new RegExp(`[${LETTER}]{2,}`).test(e)) return null;
  if (/[^0-9a-z+\-*/^().√]/.test(e)) return null;
  const terms = splitTerms(e);
  if (!terms) return null;
  if (terms.length > 1) return terms.map(term).sort().join("");
  // Produit de facteurs : 3(x+2), (x-3)(x+3).
  const factors = e.match(/\([^()]*\)|[^()]+/g) ?? [];
  if (factors.length > 1 && factors.join("") === e) {
    return factors
      .map((f) =>
        f.startsWith("(")
          ? `(${expressionKey(f.slice(1, -1)) ?? f})`
          : f.replace(/\*/g, ""),
      )
      .sort()
      .join("*");
  }
  return term(e);
}

/** Expressions écrites dans un texte normalisé (morceaux entre espaces, signes égal et ponctuation). */
function expressionsIn(s: string): string[] {
  return (
    s
      .split(/[\s,;!?:=≈{}]+/)
      // Un mot collé par la normalisation (« donc-4+6x ») n'appartient pas à l'expression.
      .map((t) =>
        t
          .replace(/\.+$/, "")
          .replace(new RegExp(`^[${LETTER}']{2,}(?=[-+])`), ""),
      )
      .filter((t) => /[+\-*/^(]/.test(t) || /\d[a-z]/.test(t))
  );
}

// --- Contrôles ---------------------------------------------------------------

type Leak =
  | { kind: "number"; value: number }
  | { kind: "expression"; key: string };

function findLeaks(normalized: string, answer: CanonicalAnswer): Leak[] {
  if (answer.kind === "expression") {
    const key = expressionKey(normalizeMath(answer.value));
    if (!key || key.length < 4) return [];
    return expressionsIn(normalized)
      .map(expressionKey)
      .filter((k): k is string => k === key)
      .map((k) => ({ kind: "expression" as const, key: k }));
  }
  return [...announcedNumbers(normalized), ...verdictNumbers(normalized)]
    .filter((c) => sameNumber(c.number, answer))
    .map((c) => ({ kind: "number" as const, value: c.number.value }));
}

/**
 * Vrai si le texte donne la réponse attendue : « x = 3 », « la réponse est
 * trois », « S = {3} », « 3 est la solution », « BC ≈ 7,21 cm », « 2√13 »,
 * ou l'expression attendue, dans n'importe quel ordre de termes.
 */
export function revealsAnswer(text: string, answer: CanonicalAnswer): boolean {
  return findLeaks(normalizeMath(text), answer).length > 0;
}

/**
 * Reprise autorisée d'une valeur écrite par l'élève : seulement la valeur
 * unique de son **dernier** message, et seulement si le texte du prof IA ne
 * porte aucun verdict (sinon reprendre la valeur revient à la confirmer ou à
 * l'infirmer).
 */
function learnerEcho(learnerTexts: readonly string[], normalizedReply: string) {
  const last = learnerTexts.at(-1);
  const none = {
    has: (_leak: Leak) => false,
    hasText: (_candidate: string) => false,
  };
  if (last === undefined || VERDICT.test(normalizedReply)) return none;
  const s = normalizeMath(last);
  const numbers = new Set<number>();
  for (const n of allNumbers(s)) numbers.add(n.number.value);
  const keys = new Set<string>();
  for (const e of expressionsIn(s)) {
    const key = expressionKey(e);
    if (key) keys.add(key);
  }
  // Plusieurs valeurs proposées (« 1 ? 2 ? 3 ? ») : aucune reprise permise.
  if (numbers.size + keys.size !== 1) return none;
  const [value] = [...numbers];
  const [key] = [...keys];
  return {
    has: (leak: Leak) =>
      leak.kind === "number"
        ? value !== undefined && Math.abs(value - leak.value) < 1e-9
        : leak.key === key,
    hasText: (candidate: string) => {
      const n = numberOf(candidate);
      if (n !== null) return value !== undefined && Math.abs(value - n) < 1e-9;
      const k = expressionKey(candidate);
      return k !== null && k === key;
    },
  };
}

/**
 * Élimination : l'élève propose plusieurs valeurs, le prof IA en écarte
 * toutes sauf une (« non pour 1, 2, 4, 5 et 6 ») : la restante est donnée.
 */
function eliminates(
  normalizedReply: string,
  learnerTexts: readonly string[],
  answer: CanonicalAnswer,
): boolean {
  const last = learnerTexts.at(-1);
  if (last === undefined || !NEGATION.test(normalizedReply)) return false;
  const proposed = allNumbers(normalizeMath(last)).map((n) => n.number);
  const distinct = proposed.filter(
    (p, i) =>
      proposed.findIndex((q) => Math.abs(q.value - p.value) < 1e-9) === i,
  );
  if (distinct.length < 2 || !distinct.some((p) => sameNumber(p, answer)))
    return false;
  const cited = allNumbers(normalizedReply).map((n) => n.number.value);
  const ruledOut = distinct.filter(
    (p) =>
      !sameNumber(p, answer) && cited.some((c) => Math.abs(c - p.value) < 1e-9),
  );
  return ruledOut.length >= distinct.length - 1;
}

/** Nombre maximal de valeurs soumises à services/math pour un texte. */
export const MAX_VERIFIED_CANDIDATES = 8;

/**
 * Le texte donne-t-il l'une des réponses attendues ? D'abord le contrôle
 * rapide, puis, avec `verifier`, chaque valeur annoncée dans le texte est
 * soumise à services/math : une valeur équivalente est une fuite (ex. 9/3
 * pour 3). L'élève peut voir reprise, sans verdict, la valeur unique de son
 * dernier message (`learnerTexts`) ; une confirmation, une infirmation ou une
 * élimination de candidats reste une fuite. Les erreurs du vérificateur sont ignorées.
 */
export async function leaksAnswer(
  text: string,
  answers: readonly CanonicalAnswer[],
  options: { verifier?: MathVerifier; learnerTexts?: readonly string[] } = {},
): Promise<boolean> {
  const normalized = normalizeMath(text);
  const learnerTexts = options.learnerTexts ?? [];
  const echo = learnerEcho(learnerTexts, normalized);
  for (const answer of answers) {
    if (findLeaks(normalized, answer).some((leak) => !echo.has(leak)))
      return true;
    if (eliminates(normalized, learnerTexts, answer)) return true;
  }
  if (!options.verifier) return false;

  const candidates = [
    ...announcedNumbers(normalized).map((c) => c.text),
    ...verdictNumbers(normalized).map((c) => c.text),
    ...announcedTokens(normalized),
    ...expressionsIn(normalized).filter((e) => expressionKey(e) !== null),
  ];
  const unique = [...new Set(candidates)]
    // Même règle qu'au premier étage : seule une reprise neutre de la dernière valeur de l'élève est permise.
    .filter((c) => !echo.hasText(c))
    .slice(0, MAX_VERIFIED_CANDIDATES);
  for (const answer of answers) {
    for (const candidate of unique) {
      const checked = await options.verifier.checkAnswer(answer, candidate);
      if (checked.ok && checked.value.correct) return true;
    }
  }
  return false;
}
