# Audit : composants et système de design de l'application (novembre 2026)

Analyse faite en lecture seule le 10 novembre 2026. Aucun code n'a été modifié.

Périmètre :
- l'application `apps/web` (Next.js 16, React 19.3, Tailwind 4.3) ;
- les composants partagés `packages/ui` (shadcn/ui, style `new-york`, Radix) ;
- le système de design du site `apps/site/src/wa` ;
- les tests e2e `e2e/tests`.

Les comptes viennent de `grep` sur `apps/web/src`. Les registres tiers ont été vérifiés le 10/11/2026 de deux façons :
- par la liste officielle des registres shadcn ([registries.json](https://ui.shadcn.com/r/registries.json)) ;
- en téléchargeant le JSON de chaque composant cité : il existe, et ses dépendances sont celles indiquées.

---

## 1. Inventaire de l'existant

### 1.1 Composants shadcn de `packages/ui/src/components/ui/`

Usages = nombre de fichiers de `apps/web/src` qui importent le composant.

| Composant | Fichiers | Remarque |
|---|---:|---|
| button | 87 | Socle de tout. `rounded-md`, `shadow-xs`. |
| card | 42 | `rounded-xl` (16 px dans la charte actuelle), `shadow-sm`. |
| badge | 39 | Pastille `rounded-full`. Souvent recolorée à la main pour les statuts. |
| label | 32 | |
| alert | 25 | Sert aussi d'avis ou de bandeau (voir le `Notice` de l'admin). |
| table | 20 | Table nue, sans tri ni pagination (pas de TanStack). |
| input | 14 | |
| checkbox | 10 | |
| select | 9 | |
| dialog | 8 | |
| native-select | 8 | Utilisé par les e2e (`locator("option")` dans `messages.spec.ts`). |
| switch | 7 | |
| textarea | 7 | |
| toggle-group | 7 | Sert de contrôle segmenté (vues de l'agenda, filtres). |
| breadcrumb | 5 | Seulement dans quelques pages, absent de la coquille. |
| progress | 5 | Barre seulement, pas d'anneau. |
| tabs | 5 | |
| radio-group | 3 | |
| avatar | 2 | |
| dropdown-menu | 2 | Coquille (espace, compte) et une page. |
| separator | 2 | |
| skeleton | 2 | Presque aucun état de chargement. |
| chart | 1 | `school/mastery-chart.tsx` seulement. |
| recharts | 1 | Réexport de Recharts 3.8. |
| sidebar | 1 | `shell/app-shell.tsx`. |
| sonner | 1 | `<Toaster />` est monté dans `layout.tsx`, mais **`toast()` n'est appelé nulle part**. |
| toggle | 1 | |
| tooltip | 1 | `TooltipProvider` seulement. |
| command | **0** | Installé, jamais utilisé. |
| popover | **0** | Installé, jamais utilisé. |
| scroll-area | **0** | Installé, jamais utilisé. |
| sheet | **0** | Utilisé seulement en interne par `sidebar` (tiroir mobile). |

Constats :
- **Deux familles d'icônes cohabitent.** Onze primitives de `packages/ui` importent `lucide-react` : sheet, sonner, radio-group, native-select, breadcrumb, command, sidebar, dropdown-menu, dialog, checkbox, select. L'application et le site, eux, utilisent Phosphor. Les chevrons, croix et coches des primitives n'ont donc pas le même trait que le reste.
- **Composants absents.** Il manque :
  - calendar, date picker, drawer, pagination, empty, spinner, field, input-group, item, kbd ;
  - accordion, collapsible, hover-card, context-menu, input-otp.

### 1.2 Composants maison (`apps/web/src/components/**` et pages)

| Domaine | Fichiers | Ce qu'ils font, et ce qu'ils contournent |
|---|---|---|
| Coquille | `shell/app-shell.tsx`, `shell/space-layout.tsx`, `shell/icons.tsx` | Sidebar shadcn `inset` repliable. Changement d'espace dans un `DropdownMenu`. Pastille « W » faite main. En-tête de 56 px sans fil d'Ariane ni titre. Icônes Phosphor monochromes (`NAV_ICONS`). |
| En-tête de page | `components/page-header.tsx` | Utilisé par 49 fichiers : titre `h1` en Urbanist 3xl gras, description, actions. Seuls 6 fichiers posent leur propre `<h1>`. |
| Agenda | `agenda/calendar.tsx`, `views.tsx` (439 lignes), `teacher-dialogs.tsx` (603 lignes), `family-agenda.tsx`, `session-*.tsx` | Calendrier entièrement fait main : vues semaine, mois et année, voies d'événements, `EventChip`. Navigation par `ToggleGroup`. Aucun glisser-déposer. Les dates et heures sont saisies dans des champs natifs, sans `Calendar` shadcn. |
| Carte des notions | `teacher/class-map.tsx` (462 lignes), `school/class-map.tsx` (153 lignes) | **Deux `ClassMapView` différents** : une constellation SVG et une grille côté prof, des barres empilées côté école. C'est ce qui tient lieu de carte de chaleur. |
| Discussion IA | `learner/tutor-chat.tsx` (`Bubble`, `BubbleTools`, `Thinking`), `learner/tutor-stream.ts` | Bulles, indicateur « réfléchit » et outils de bulle, faits main. |
| Messagerie | `messages/*` (`Inbox`, `ThreadList`, `ThreadView`, `Composer`, `NewMessageDialog`, `When`) | Une deuxième implémentation des bulles et de la saisie, distincte de celle du tuteur IA. `initials()` est redéfini (aussi dans `app-shell.tsx`). |
| Voix | `learner/voice/dictate-button.tsx`, `listen-button.tsx` | Dictée et lecture à voix haute. |
| Maths | `learner/math.tsx` (`MathInput`, `MathText`) | MathLive 0.111.4, chargé à la demande. Habillé dans `apps/web/src/app/globals.css` (`math-field`). |
| Photo | `learner/photo-review.tsx` | `<input type="file">` brut, sans zone de dépôt ni aperçu stylé. |
| Exercices | `formats/*` (bandes dessinées, figures, balance et Pythagore manipulables) | Visuels métier : à garder, seulement à rhabiller. |
| Statuts | `learner/status-badge.tsx`, `guardian/status-chip.tsx`, `teacher/status.tsx`, `school/class-map.tsx` (`TONE`) | **Quatre copies** de la même table de couleurs (`not_seen` / `needs_work` / `in_progress` / `mastered`). |
| Chiffres | `school/stat.tsx` (`Stat`) | KPI réservé à l'école. Les autres espaces font des cartes à la main. |
| Sections | `guardian/section.tsx` (`Section`) | Bloc titré, réservé au parent. |
| Admin | `app/admin/_ui/fields.tsx` (`TextField`, `TextAreaField`, `SelectField`, `CheckboxField`, `Notice`, `EmptyState`) | Champs avec libellé, aide et erreur. C'est l'équivalent du `Field` shadcn, mais limité à l'admin. |
| Compte | `app/compte/_components/confirm-action.tsx` | Dialogue de confirmation maison. |

### 1.3 Doublons et incohérences

1. **Cartes : trois façons de faire.**
   - `Card` shadcn : 42 fichiers.
   - `div` « `rounded-xl border bg-card` » ou « `rounded-lg border …` » écrite à la main : environ 40 fichiers, dont `eleve/page.tsx`, `parent/page.tsx`, `ecole/*`, `admin/couts`, `messages/inbox.tsx` et `agenda/views.tsx`.
   - Blocs spécialisés : `Section` (parent) et `Stat` (école).
   - Les arrondis de l'app se répartissent ainsi : 58 `rounded-lg`, 49 `rounded-xl`, 13 `rounded-md`, 3 `rounded-2xl`. Il n'y a pas d'échelle tenue.
2. **Badges et statuts.**
   - Le `Badge` shadcn est recoloré par classes.
   - Deux pastilles `span` font la même chose (`StatusBadge` élève, `StatusChip` parent).
   - Les clés de traduction diffèrent : `learner.status`, `guardian.status`, `teacher.status`, `school.status`.
3. **États vides : quatre formes.**
   - `<p className="text-muted-foreground">` : une vingtaine de fichiers.
   - `<p className="text-sm text-muted-foreground">` : 5 fichiers.
   - `EmptyState` en pointillés, réservé à l'admin.
   - Bloc illustré de `teacher/bank-board.tsx` (titre et aide).
4. **En-têtes de page.**
   - `PageHeader` est bien répandu (49 fichiers).
   - En revanche, la coquille n'affiche ni titre ni fil d'Ariane. Le `Breadcrumb` n'apparaît que dans 5 pages, chacune à sa manière.
5. **Toasts.** Sonner est monté mais jamais appelé. Les retours d'action passent par des `Alert` en ligne (25 fichiers) ou par du texte.
6. **Chargement.** `Skeleton` n'apparaît que dans 2 fichiers. Les autres pages n'ont pas de squelette (`loading.tsx`).
7. **Contrôle segmenté.** `ToggleGroup` (7 fichiers) et `Tabs` (5 fichiers) servent tour à tour au même usage, par exemple changer de vue ou de filtre.
8. **Couleur « primaire » ambiguë.**
   - Dans la charte de l'app, `--primary` vaut `--action` : l'encre noire en clair, le jaune en sombre.
   - Le statut « Validé » (`bg-primary`) est donc **noir en thème clair et jaune en sombre**.
   - Sur le site, `--color-primary` vaut toujours le jaune `--brand`.
9. **Polices.**
   - L'app charge Inter (texte), Urbanist (titres), Lexend (lecture facile) et STIX (formules).
   - Les pages d'authentification chargent en plus Geist et Geist Mono (`auth-card.tsx`).
   - Le site n'utilise que Geist et Geist Mono.
10. **Thème sombre : deux conventions.**
    - L'app : classe `.dark` (`next-themes`, `@custom-variant dark (&:is(.dark *))`), vérifiée par `e2e/tests/pages.spec.ts` (`toHaveClass(/dark/)`).
    - Le site : `data-theme="dark"` et `prefers-color-scheme`.

---

## 2. Le langage visuel du site à transposer

Sources : `apps/site/src/wa/ui/styles/tokens.css`, `theme.css`, `glow.css`, `apps/site/src/app/globals.css` (bloc `tk-*`), `wa/ui/motion/tokens.ts`.

### 2.1 Jetons

**Surfaces et texte.** Les deux chartes ont des valeurs presque identiques ; le site a des noms plus clairs.

| Rôle | Site (clair / sombre) | App actuelle (clair / sombre) |
|---|---|---|
| Fond | `--background` `#f8f8f5` / `#0d0e0b` | `--ground` `#f7f4ec` / `#0e0e0c` |
| Surface (carte) | `--surface` `#ffffff` / `#151610` | `--surface` `#ffffff` / `#1a1a17` |
| Surface creusée | `--surface-subtle` `#f2f2ee` / `#1d1f18` | `--surface-sunk` `#efeadb` / `#24241f` |
| Texte | `--foreground` `#171714` / `#f5f6f0` | `--ink` `#161512` / `#f4f4ee` |
| Texte secondaire | `--muted-foreground` `#74746d` / `#9da095` | `--ink-muted` `#6a675e` / `#a3a398` |
| Bordure | `--border` `#e4e2db` / `#2b2e25` ; `--border-strong` `#cfcdc4` | `--line` `#e6e1d3` ; `--line-strong` `#cfc8b4` |
| Marque | `--brand` `#ffc529` (+ `hover`, `active`, `soft`, `subtle`, `foreground`, `on-brand`) | `--brand` `#ffc529`, `--brand-soft` |
| Panneau latéral | `--sidebar` `#f3f3ef` / `#111210` | `= --ground` |

Le papier de l'app est plus chaud (`#f7f4ec`) que celui du site, plus neutre (`#f8f8f5`). L'adopter rapprocherait les deux produits.

**États sémantiques du site** (absents de l'app). Chacun existe en version pleine, `-soft` et `-text` :
- `--success` `#218b5a` ;
- `--warning` `#e59b2f` ;
- `--destructive` `#dd4c4c` ;
- `--info` `#4f78e8` ;
- `--ai-reasoning` `#7667e8`, à ne pas reprendre (voir plus bas).

**Lignes du « cahier technique »** (`--tk-*`), toutes dérivées de `--foreground` :
- `--tk-line` 11 % ;
- `--tk-edge` 16 % ;
- `--tk-rule` 40 %.

**Ombres.** Le site les rend plus profondes en sombre :

| Jeton | Valeur claire |
|---|---|
| `--shadow-xs` | `0 1px 2px` à 4 % |
| `--shadow-sm` | 6 % + 4 % |
| `--shadow-md` | `0 4px 12px` à 8 % |
| `--shadow-lg` | `0 16px 40px -8px` à 16 % |

**Rayons du site** : `--radius-sm` 6, `--radius` 8, `--radius-md` 10, `--radius-lg` 12 px. Le site les tient courts, et les éléments « signature » sont biseautés.

**Courbes et durées** (`motion/tokens.ts`, `--ease-*`) :
- `arrive` `cubic-bezier(.16,1,.3,1)` ;
- `return` `(.4,0,.2,1)` ;
- `sweep` `(.65,0,.35,1)` ;
- durées : 120, 160, 200, 220, 240, 320 et 500 ms ;
- ressorts `springPop` et `springSettle`.

**À reprendre dans l'app** :
- les rôles du site (`background`, `surface`, `surface-subtle`, `border-strong`, les échelles d'état `-soft` et `-text`, les ombres, les courbes) ;
- **en gardant** les tons pastel de l'app (`mint`, `butter`, `peach`, `rose`, `lime`, `sand`) pour les statuts pédagogiques, qui n'ont pas d'équivalent sur le site.

**Mise en garde sur les couleurs** (préférences d'Olivier, novembre 2026). Il a écarté le bleu, le violet, l'indigo, le terracotta et le vert lagune. Il faut donc :
- **ne pas reprendre** `--ai-reasoning` (violet), ni `--info` en accent dominant ;
- **ne pas reprendre** les tons `indigo` et `orchid` du `GlowTile` dans la navigation.

### 2.2 Typographie

| Usage | Site | Proposition pour l'app |
|---|---|---|
| Texte courant | Geist Sans, 14 px (`theme.css`, `body`), interligne 1,5 | Geist Sans 14 px. Remplace Inter ; le paquet `geist` est déjà une dépendance de `apps/web`. |
| Titres d'affichage | `.tk-title` : graisse **300**, approche −0,04 em, lignes révélées une à une | `h1` de page : Geist 300, 28 à 34 px, approche −0,03 em. Remplace Urbanist 3xl gras. |
| Titres de section | 17 à 22 px, graisse 600, approche −0,015 em | `h2` 18 px 600, `h3` 15 px 600. |
| Étiquettes, sur-titres | Geist Mono 11 à 13 px, graisse 500, approche 0,01 à 0,08 em (`.tk-eyebrow`, `.tk-index-num`) | Sur-titre de page, en-têtes de colonnes, horodatages, compteurs. |
| Chiffres | `tabular-nums`, odomètre | KPI en Geist 300 à 400, 28 à 36 px, `tabular-nums`. |
| Boutons principaux | 13,5 px, 600, approche 0,04 em, majuscules (`.tk-cta`, `auth.css`) | Seulement pour l'appel à l'action principal d'un écran, pas pour tous les boutons. |
| Lecture facile | absent du site | **Garder Lexend** (`EasyReadingScope`) : c'est une fonction d'accessibilité pour les élèves. |
| Formules | absent du site | **Garder STIX** pour MathLive et `MathText`. |

### 2.3 Icônes

- **`GlowTile`** (`wa/ui/components/ui/glow-tile.tsx` et `glow.css`) :
  - pastille arrondie (`border-radius: 27 %`) au cœur sombre (`--gi-core`) ;
  - halo en dégradés radiaux et coniques ;
  - liseré « verre » (`.gi-rim`) et glyphe blanc ;
  - tons `ember`, `crimson`, `orchid`, `indigo`, `emerald`, `gold` ;
  - ralentis `breathe`, `orbit`, `shimmer` ;
  - `prefers-reduced-motion` respecté.

  Dans le menu du site, la pastille fait 24 px avec un glyphe à 64 % (`site-nav.tsx`). Attention : le ton `emerald` vaut en réalité **jaune** (`--glow-emerald-a: #ffc529`), car il a été recoloré pour Wema.
- **Icônes animées** (`wa/ui/icons/*`) : 25 glyphes au trait Phosphor (largeur 16 sur 256), animés au survol et au focus par `motion` via `useIconMotion()` (`start`, `stop`, `bind`), coupés si l'utilisateur réduit les animations.
- **`GlowIcon`** (`wa/components/v2/glow-icon.tsx`) : un `GlowTile` dont l'icône s'anime quand le pointeur entre.
- **Phosphor** (`@phosphor-icons/react` 2.1) : déjà la famille de l'app (`NAV_ICONS`).

**Proposition** :
- `GlowTile` de 24 px dans la barre latérale et les menus, de 40 à 48 px dans les cartes KPI, de 56 à 72 px dans les états vides et les écrans de réussite ;
- un ton fixe par **domaine**, pas par écran, et uniquement parmi les tons non écartés. Une palette de pastilles chaudes est à valider :

| Domaine | Ton |
|---|---|
| Accueil | gold |
| Agenda | ember |
| Exercices et devoirs | emerald (jaune Wema) |
| Prof IA | crimson |
| Messages | ember |

- un ton rose ou vert vrai à ajouter si besoin, à faire valider sur une planche de couleurs avant toute application.

### 2.4 Cadres, étiquettes, mouvement

- **Cadre biseauté** (`TsfFrame`, `.tk-frame`) :
  - coins haut-gauche et bas-droit coupés à 16 px (12 px sur mobile) par `clip-path` ;
  - liseré intérieur `--tk-edge` et diagonales dessinées ;
  - repères en croix avec losange (`tk-frame-mark`) aux coins opposés ;
  - variante `graphite`, sombre.
- **Losange** (`.tk-diamond`, 7 px, jaune) et **sur-titre** `TsfEyebrow` : texte mono tapé lettre à lettre avec caret jaune, sur un filet `--tk-rule`.
- **Index** (`.tk-index`) : liste numérotée en mono avec une barre jaune qui glisse (`--tk-swing`). C'est un très bon modèle pour une navigation secondaire ou un sommaire.
- **Titres animés** :
  - `TsfTitle` : lignes qui montent de 110 % au premier affichage ;
  - `TsfDecode` : texte brouillé puis décodé ;
  - `TsfOdometer` : chiffres en rouleau, avec le vrai nombre en `sr-only`.
- **Boutons** Tween UI : `focus-frame-button` (libellé qui roule), `slant-morph-button`.
- **Éléments React Bits** : CardNav, LineSidebar, FlowingMenu, ScrollStack, TicketStubFooter. Ce sont des effets de site vitrine ; **seuls LineSidebar et l'esprit de CardNav** conviennent à une application.
- **Grain et papier** (`.grain`, `.paper`, `auth-grain`) : texture de fond discrète.

### 2.5 Échelle d'arrondis « doux » proposée

Le site reste anguleux ; l'application garde l'esprit en tenant les rayons courts et réguliers, et en réservant le biseau aux temps forts.

| Jeton proposé | Valeur | Emplois |
|---|---:|---|
| `--radius-xs` | 6 px | Cases à cocher, `kbd`, puces du calendrier, petites pastilles carrées. |
| `--radius-sm` | 8 px | Boutons, champs, sélecteurs, onglets, éléments de menu. |
| `--radius-md` | 10 px | Popovers, menus, info-bulles, toasts, bulles de discussion. |
| `--radius-lg` | 12 px | **Cartes**, tableaux, KPI, zones de dépôt. |
| `--radius-xl` | 14 px | Dialogues, tiroirs, panneau de discussion, carte héro. |
| `--radius-full` | 999 px | Badges et statuts (pilules), avatars, interrupteurs, anneaux. |
| GlowTile | 27 % | Inchangé. |
| **Biseau** | 12 à 16 px, `clip-path` | **Réservé aux éléments forts** : carte héro de l'accueil de chaque espace, bouton d'action principal d'un écran (comme sur l'authentification), carte de réussite, en-tête de l'onboarding, carte « prochaine séance ». **Jamais** sur les champs, les menus, les tableaux ni les éléments répétés. |

Pour l'implémenter, il suffit de remplacer dans `packages/ui/src/globals.css` :
- `--radius: 0.75rem` par 8 px ;
- les dérivés `--radius-*` par les valeurs ci-dessus.

Le `rounded-xl` du composant `card` passe alors de 16 à 12 px sans toucher au composant.

Point de vigilance : le biseau par `clip-path` **coupe le contour de focus**. `auth.css` le dessine déjà à l'intérieur (`box-shadow: inset`) ; il faut généraliser ce procédé.

---

## 3. Composants nécessaires pour la refonte

Légende :
- **Restyler** : le composant existe, seul l'habillage change.
- **shadcn** : composant officiel. Commande à lancer depuis `packages/ui`, où se trouve `components.json`.
- **Registre** : registre tiers compatible shadcn (`npx shadcn@latest add @registre/nom`), vérifié dans [la liste officielle](https://ui.shadcn.com/r/registries.json).
- **Site** : composant à copier depuis `apps/site/src/wa` vers `packages/ui`.

### 3.0 Compatibilité et licences vérifiées

| Source | Licence | Tailwind 4 / React 19 | Remarque |
|---|---|---|---|
| [shadcn/ui](https://ui.shadcn.com/docs/tailwind-v4) | MIT ([dépôt](https://github.com/shadcn-ui/ui)) | Oui, officiellement. Composants mis à jour pour Tailwind v4 et React 19, `data-slot`, `tw-animate-css` ; `toast` est abandonné au profit de `sonner`. | Style `new-york-v4`. |
| [Magic UI](https://magicui.design) (`@magicui`) | MIT ([LICENSE](https://github.com/magicuidesign/magicui/blob/main/LICENSE.md)) | Sa page d'installation mentionne `tailwindcss v4`. | Dépend de `motion`. |
| [Animate UI](https://animate-ui.com) (`@animate-ui`) | **MIT + Commons Clause** ([LICENSE](https://raw.githubusercontent.com/imskyleen/animate-ui/main/LICENSE.md)) : usage commercial permis dans un produit, revente des composants interdite. | Non précisé dans la documentation. Dépend de `motion`. | Anime les primitives Radix, Base UI ou React Aria sous les composants shadcn ([docs](https://animate-ui.com/docs)). |
| [React Bits](https://reactbits.dev) (`@react-bits`) | **MIT + Commons Clause** ([LICENSE](https://raw.githubusercontent.com/DavidHDev/react-bits/main/LICENSE.md)) | Variantes `-TS-TW` (Tailwind). Version de Tailwind non précisée. | Effets de vitrine ; déjà utilisé par le site. |
| [Kibo UI](https://www.kibo-ui.com) (`@kibo-ui`) | MIT ([dépôt shadcnblocks/kibo](https://github.com/shadcnblocks/kibo)) | Non précisé. Dépendances : `lucide-react`, `date-fns`, `jotai`, `@dnd-kit/*`. | |
| [Dice UI](https://www.diceui.com) (`@diceui`) | MIT ([dépôt](https://github.com/sadmann7/diceui)) | Non précisé. Dépend de `radix-ui`. | Registre marqué « degraded » le jour du contrôle, mais les JSON répondent. |
| [CalendarCN](https://calendarcn.xyz) (`@calendarcn`) | MIT ([dépôt](https://github.com/vmnog/calendarcn)) | Fonctionne avec les versions Radix et Base UI des composants shadcn (README). | Vues jour, semaine, mois et agenda ; glisser pour déplacer, tirer les bords pour redimensionner, tactile. |
| [prompt-kit](https://www.prompt-kit.com) (`@prompt-kit`) | MIT ([dépôt](https://github.com/ibelick/prompt-kit)) | Non précisé. | Briques de discussion IA. |
| [AI Elements](https://ai-sdk.dev/elements) (`@ai-elements`) | Apache-2.0 ([LICENSE](https://raw.githubusercontent.com/vercel/ai-elements/main/LICENSE)) | Non précisé. | **Dépend du paquet `ai`** (Vercel AI SDK) et de `streamdown`. Lourd pour Wema, qui a son propre flux (`tutor-stream.ts`). |
| [Stepper (francozeta)](https://francozeta-stepper.vercel.app) (`@stepper`) | Non vérifiée | Non précisé. | Alternative au stepper de Dice UI. |
| [Tween UI](https://tween-ui.vercel.app) (`@tween-ui`) | MIT ([dépôt](https://github.com/StaticMania/tween-ui)) | « GSAP & CSS ». | Déjà utilisé par le site. |
| coss ui ([coss.com/ui](https://coss.com/ui), anciennement Origin UI : `originui.com` redirige vers `coss.com/ui`) | Le dépôt [cosscom/coss](https://github.com/cosscom/coss) est sous **AGPL-3.0** ; aucune licence propre aux composants n'a été trouvée. | Bâti sur **Base UI**, pas sur Radix. | **À écarter** : autre primitive que celle de `packages/ui`, et licence incertaine. |
| [Aceternity UI](https://ui.aceternity.com) (`@aceternity`) | Licence non vérifiée | Non précisé. | Registre « degraded ». Effets de vitrine, sans usage prévu dans l'app. |

**Primitives Radix.** Kibo UI, CalendarCN et prompt-kit importent `lucide-react` : leurs icônes sont à remplacer par Phosphor après installation. Comme le code est copié dans le dépôt, c'est faisable, comme pour les onze primitives shadcn actuelles.

### 3.1 Liste des composants

| # | Besoin | Statut | Source et commande |
|---|---|---|---|
| **Coquille** ||||
| 1 | Barre latérale | Restyler | `sidebar` existant. Fond `--sidebar`. Entrées de 36 px à `--radius-sm`. **`GlowTile` de 24 px** à la place des icônes nues. Barre active jaune glissante inspirée de `.tk-index-bar`. Repère : bloc `npx shadcn@latest add sidebar-07` (sidebar, breadcrumb, collapsible, dropdown-menu, avatar). |
| 2 | Groupes repliables du menu | Manque | `npx shadcn@latest add collapsible` |
| 3 | En-tête de l'application (titre, fil d'Ariane, recherche, notifications, compte) | Restyler | `app-shell.tsx` : y ajouter `Breadcrumb`, un bouton de palette (`kbd` ⌘K) et la cloche. |
| 4 | Changement d'espace | Restyler | `DropdownMenu` existant. Une ligne par espace avec son `GlowTile`, sur le modèle des rangées du menu du site (`site-nav.tsx`). |
| 5 | Fil d'Ariane | Restyler | `breadcrumb` existant. Séparateur mono `/`. Passe dans la coquille. |
| 6 | Raccourcis clavier affichés | Manque | `npx shadcn@latest add kbd` |
| **En-tête de page et titres** ||||
| 7 | En-tête de page | Restyler | `page-header.tsx` : sur-titre mono avec losange (`TsfEyebrow`), titre `TsfTitle` en Geist 300, description, actions. **Garder un `<h1>` dont le nom accessible est le texte final** (voir le §5 sur les e2e). |
| 8 | Titre animé, décodage, odomètre | Site | `TsfTitle`, `TsfDecode`, `TsfOdometer`, `TsfEyebrow`, `tsf-motion.ts`. **`TsfDecode` est à réserver aux textes décoratifs**, jamais aux titres testés ni lus par les lecteurs d'écran. |
| 9 | Texte animé (variante registre) | Registre, en option | `npx shadcn@latest add @magicui/text-animate` (MIT). Les composants du site suffisent. |
| **Cartes, stats, KPI** ||||
| 10 | Carte | Restyler | `card` : 12 px, `--shadow-xs`, bordure `--border`. **Remplace les quelque 40 `div` faites main.** |
| 11 | Carte héro biseautée | Site | `TsfFrame` (`.tk-frame`) à déplacer vers `packages/ui`. |
| 12 | KPI | Manque (généraliser `Stat`) | Composer `Card`, un `GlowTile` de 40 px, la valeur en `TsfOdometer`, une tendance et une étiquette mono. Modèle de compteur : `npx shadcn@latest add @magicui/number-ticker` (MIT, dépend de `motion`), mais `TsfOdometer` couvre le besoin. |
| 13 | Ligne de liste riche (titre, sous-titre, actions) | Manque | `npx shadcn@latest add item` |
| **Données** ||||
| 14 | Tableau de données (tri, filtre, pagination) | Restyler `table`, plus le guide officiel | `npx shadcn@latest add table`, puis `pnpm add @tanstack/react-table`. Le [guide shadcn](https://ui.shadcn.com/docs/components/radix/data-table) est une recette, pas un composant ; il mentionne TanStack Table v9. En-têtes de colonnes en mono 11 px. |
| 15 | Pagination | Manque | `npx shadcn@latest add pagination` |
| **Calendrier** ||||
| 16 | Agenda semaine, mois, jour, liste ; glisser-déposer ; redimensionnement | Manque (remplace `agenda/views.tsx`) | `npx shadcn@latest add @calendarcn/calendar`, qui installe `calendar-header`, `time-grid`, `month-view`, `agenda-view` et `calendar-core` (MIT, `date-fns`). **Pas de vue année** : garder `YearView` maison ou y renoncer. |
| 17 | Gros calendrier mensuel (simple) | Alternative | `npx shadcn@latest add @kibo-ui/calendar` : grille mensuelle qui place chaque élément au jour de sa fin (`date-fns`, `jotai`). Moins adapté que CalendarCN. |
| 18 | Carte d'événement et détail | Restyler | `EventChip` maison, ou `event-details` de CalendarCN. Couleur par type de séance, puce à `--radius-xs`. |
| 19 | Mini-calendrier ou bandeau de jours | Registre | `npx shadcn@latest add @kibo-ui/mini-calendar` |
| 20 | Kanban (banque d'exercices, devoirs) | Registre, en option | `npx shadcn@latest add @kibo-ui/kanban` (`@dnd-kit/*`) ou `@diceui/kanban` (`@dnd-kit/*`, `radix-ui`). |
| **Dates** ||||
| 21 | Calendrier de saisie | Manque | `npx shadcn@latest add calendar` (`react-day-picker`, `date-fns`). Locale `fr` à passer. |
| 22 | Sélecteur de date | Manque | Composition `popover` et `calendar` ([doc](https://ui.shadcn.com/docs/components/radix/date-picker)) : `npx shadcn@latest add popover calendar`. Remplace les champs natifs de `teacher-dialogs.tsx`. |
| 23 | Date relative (« il y a 3 min ») | Registre, en option | `npx shadcn@latest add @kibo-ui/relative-time`. L'app a déjà `messages/when.tsx`. |
| **Graphiques** ||||
| 24 | Graphiques | Restyler | `chart` existant. Le composant officiel utilise maintenant **Recharts v3** ([doc](https://ui.shadcn.com/docs/components/radix/chart)), ce qui correspond à `recharts 3.8.0` dans `packages/ui`. Palette `--chart-1…5` à revoir : jaune, encre, tons pastel. |
| 25 | Carte de chaleur (activité, maîtrise par notion) | Registre | `npx shadcn@latest add @kibo-ui/contribution-graph` (`date-fns`) pour l'assiduité. Pour la grille élèves × notions, garder le `Grid` maison de `teacher/class-map.tsx`, restylé. Le registre `@heatmap` existe dans la liste officielle mais son JSON n'a pas répondu : non retenu. |
| **Discussion** ||||
| 26 | Fil de discussion collé en bas | Registre | `npx shadcn@latest add @prompt-kit/chat-container` (`use-stick-to-bottom`). |
| 27 | Bulles | Restyler (fusionner) | Fusionner `Bubble` (tuteur) et `ThreadView` (messages) en un seul `ChatBubble` à `--radius-md`. Modèle : `@prompt-kit/message` (`react-markdown`, `shiki` : lourd ; ne reprendre que la structure). **Les messages doivent rester des `<p>`** (`messages.spec.ts`). |
| 28 | Saisie | Restyler, plus `input-group` | `npx shadcn@latest add input-group`. Modèle : `@prompt-kit/prompt-input` (textarea et tooltip). Y loger les boutons pièce jointe, dictée et envoi. |
| 29 | Frappe en cours | Registre | `npx shadcn@latest add @prompt-kit/loader`, ou le `Thinking` maison restylé avec trois points. |
| 30 | Retour en bas | Registre | `npx shadcn@latest add @prompt-kit/scroll-button` |
| 31 | Pièce jointe | Registre | `npx shadcn@latest add @prompt-kit/file-upload` (sans dépendance). |
| 32 | Dictée | Existe | `voice/dictate-button.tsx`, `listen-button.tsx` : à habiller (bouton rond et anneau pulsé pendant l'écoute). |
| **Maths et photo** ||||
| 33 | Champ mathématique | Existe | `learner/math.tsx` (MathLive). Restyler par les variables CSS de `math-field` (déjà amorcé dans `globals.css`) : bordure, rayon de 8 px, focus jaune, clavier virtuel aux couleurs de la charte. Aucun registre ne le remplace. |
| 34 | Téléversement de photo | Registre | `npx shadcn@latest add @kibo-ui/dropzone` (`react-dropzone`) ou `@diceui/file-upload` (`radix-ui`, sans dépendance externe). Aperçu et recadrage : `@kibo-ui/image-crop` (`react-image-crop`). |
| **Parcours** ||||
| 35 | Stepper et onboarding | Registre | `npx shadcn@latest add @diceui/stepper` (MIT, `radix-ui`) ou `@stepper/stepper` (licence non vérifiée). Le cadre de l'onboarding reprend `TsfFrame` et des numéros mono `01 02 03`, comme dans `auth-card.tsx`. |
| 36 | Frise (historique d'une notion, d'une séance) | Registre, en option | `npx shadcn@latest add @diceui/timeline` |
| **États** ||||
| 37 | État vide | Manque | `npx shadcn@latest add empty`, avec un `GlowTile` de 56 px dans l'emplacement média. Remplace les quatre variantes du §1.3. |
| 38 | Squelette | Restyler | `skeleton` existant, plus un `loading.tsx` par espace. |
| 39 | Indicateur de chargement | Manque | `npx shadcn@latest add spinner` |
| **Retours** ||||
| 40 | Toasts | Restyler et **brancher** | `sonner` est monté mais inutilisé. Le restyler à `--radius-md` avec une icône Phosphor colorée, et l'utiliser pour les confirmations d'action. Les animations `toast-settle` et `toast-refuse` existent dans `theme.css` du site. |
| 41 | Bandeau d'alerte | Restyler | `alert` : variantes `success`, `warning`, `destructive`, `info` sur les jetons `-soft` et `-text` du site. |
| 42 | Dialogue | Restyler | `dialog` à 14 px, en-tête avec `GlowTile`. Un `ConfirmDialog` commun remplace `confirm-action.tsx`. |
| 43 | Tiroir | Manque | `npx shadcn@latest add drawer` (`vaul`) pour les fiches sur mobile. `sheet` existe déjà pour le côté. |
| 44 | Carte au survol (aperçu d'élève, de notion) | Manque | `npx shadcn@latest add hover-card` |
| **Badges** ||||
| 45 | Badge et étiquette | Restyler | `badge` en pilule, avec des variantes `brand`, `success`, `warning`, `danger`, `muted` et `outline`. |
| 46 | Statut de notion | **Fusionner** | Un seul `NotionStatus` dans `packages/ui` (ou `apps/web/src/components/ui`) et une seule table de tons. Il remplace les 4 copies. Modèle : `@kibo-ui/status` (badge avec point). |
| 47 | Pilule (personne, matière) | Registre, en option | `npx shadcn@latest add @kibo-ui/pill` |
| **Avatar** ||||
| 48 | Avatar | Restyler | `avatar` : initiales en mono, couleur de fond dérivée du nom parmi les tons pastel, rayon plein. Une seule fonction `initials()`. |
| 49 | Pile d'avatars (classe, groupe) | Registre | `npx shadcn@latest add @kibo-ui/avatar-stack` |
| **Progression** ||||
| 50 | Barre de progression | Restyler | `progress` : piste `--surface-subtle`, remplissage jaune, hauteur de 6 px, arrondi plein. |
| 51 | Anneau | Manque | `npx shadcn@latest add @magicui/animated-circular-progress-bar` (sans dépendance). |
| 52 | Barre segmentée par statut | Restyler | Les barres empilées de `class-map.tsx`, à extraire en composant. |
| **Réussite** ||||
| 53 | Coche animée | Site | Courbe `za-draw` du site (`stroke-dashoffset`) sur une icône Phosphor `CheckCircle`, dans un `GlowTile` vert ou jaune. |
| 54 | Confettis sobres | Registre | `npx shadcn@latest add @magicui/confetti` (`canvas-confetti`). Réglage sobre (peu de particules, couleurs de la charte), coupé si l'utilisateur réduit les animations. |
| **Navigation interne** ||||
| 55 | Onglets | Restyler | `tabs` : soulignement jaune glissant, comme l'index du site. Version animée : `npx shadcn@latest add @animate-ui/components-radix-tabs` (Commons Clause). |
| 56 | Contrôle segmenté | Restyler | `toggle-group` : fond `--surface-subtle`, segment actif blanc avec `--shadow-xs`. **Règle** : `Tabs` pour changer de panneau, `ToggleGroup` pour changer de vue ou de filtre. |
| 57 | Accordéon (FAQ, détails) | Manque | `npx shadcn@latest add accordion` |
| **Commandes et notifications** ||||
| 58 | Palette de commandes | Restyler et brancher | `command` est installé mais inutilisé. `CommandDialog` sur ⌘K : recherche de pages, d'élèves, d'exercices, d'actions. |
| 59 | Centre de notifications | Manque (composition) | `popover`, `scroll-area` et `item` déjà disponibles. Cloche avec badge (déjà alimentée par `useUnreadMessages`). Liste animée en option : `npx shadcn@latest add @magicui/animated-list` (`motion`). |
| **Menus** ||||
| 60 | Menu déroulant | Restyler | `dropdown-menu` à `--radius-md`, éléments à 8 px, icônes Phosphor. |
| 61 | Menu contextuel (clic droit sur événement ou carte) | Manque | `npx shadcn@latest add context-menu` |
| **Formulaires** ||||
| 62 | Champ avec libellé, aide et erreur | Manque | `npx shadcn@latest add field`. Remplace `admin/_ui/fields.tsx` et les assemblages `Label` + `Input` des 32 fichiers. |
| 63 | Champs, zone de texte, sélecteurs, cases, radios, interrupteurs | Restyler | `input`, `textarea`, `select`, `native-select`, `checkbox`, `radio-group`, `switch` à `--radius-sm`, focus jaune. Interrupteur jaune une fois activé. |
| 64 | Code à usage unique (code de connexion élève) | Manque | `npx shadcn@latest add input-otp` (`input-otp`). |
| 65 | Groupe de boutons | Manque | `npx shadcn@latest add button-group` |
| 66 | Bouton principal animé | Site | `focus-frame-button` (Tween UI) ou le bouton biseauté de `auth.css`. Seulement pour l'action principale d'un écran. |
| **Icônes** ||||
| 67 | `GlowTile` et `GlowIcon` | Site | À déplacer, avec `glow.css` et les jetons `--glow-*`, vers `packages/ui`. |
| 68 | Icônes animées | Site | Les 25 de `wa/ui/icons` (trait Phosphor), complétées au besoin. Animate UI propose aussi des icônes animées (par exemple `@animate-ui/icons-bell`, dépendance `motion`), dont le trait n'est pas Phosphor. Le registre `@icons-animated`, qui annonce du Phosphor animé, était « unavailable » le jour du contrôle. |

**Nouvelles dépendances que ce plan ajoute à `packages/ui`** : `motion` (déjà sur le site), `react-day-picker`, `date-fns`, `vaul`, `@tanstack/react-table`, `input-otp`, `use-stick-to-bottom`, `canvas-confetti` et, selon les choix, `@dnd-kit/*`, `react-dropzone`, `react-image-crop`, `jotai`.

---

## 4. Remotion et remocn

**Ce que c'est.**
- [Remotion](https://www.remotion.dev) écrit des vidéos en React :
  - chaque image est un rendu React ;
  - le lecteur [`@remotion/player`](https://www.remotion.dev/docs/player/player) lit une composition dans une page web, sans fichier vidéo, avec des `inputProps` typés ;
  - l'export en MP4 passe par un rendu côté serveur, par exemple [Remotion Lambda](https://www.remotion.dev/docs/lambda) sur AWS.
- [remocn](https://remocn.dev) (et non « remotioncn ») est un registre shadcn de **932 composants pour Remotion** :
  - titres cinétiques, transitions, sous-titres, compteurs, scènes produit ;
  - même des copies de boutons, champs et dialogues « rejouables sur une ligne de temps » ;
  - installation par `npx shadcn@latest add @remocn/<nom>`, dans un projet Remotion existant ([README](https://github.com/Remocn/remocn)) ;
  - licence MIT, présent dans [la liste officielle](https://ui.shadcn.com/r/registries.json) ;
  - chaque composant dépend de `remotion` (vérifié sur `@remocn/button`).

**Pourquoi ils ne remplacent pas les composants d'interface.**
- Un composant remocn est piloté par `useCurrentFrame()`, `interpolate()` et `spring()` : il **joue une animation à une image donnée**. Il ne gère ni la saisie, ni le focus, ni le clavier, ni les rôles ARIA, ni l'état du serveur.
- Son `button` est l'*image* d'un bouton dans une vidéo, pas un bouton Radix accessible.
- Il exige le moteur Remotion à l'exécution.

L'interface de Wema reste donc shadcn et Radix, enrichie des registres du §3.

**À quoi ils peuvent servir chez Wema.**
1. **Vidéos de présentation et publicités.** La méthode actuelle d'Olivier repose sur **HyperFrames** (`~/dev/videos/PROMPT-VIDEO-MOTION-DESIGN.md`, `wema-presentation`). Remotion serait une **deuxième chaîne** ; à n'adopter que si HyperFrames bloque. remocn apporte surtout des titres, des transitions et des scènes produit prêtes à l'emploi.
2. **Vidéos d'explication générées pour les élèves.** C'est le vrai cas d'usage applicatif :
   - une composition « exercice expliqué » (énoncé, étapes, formule, voix) paramétrée par `inputProps` à partir des données de l'exercice ;
   - lue **dans l'app** avec `@remotion/player`, sans export (pas de coût de rendu) ;
   - ou exportée en MP4 par un rendu serveur pour l'hors-ligne ou le partage.

   Les catégories remocn « Typography », « Captions » (sous-titres calés sur une transcription) et « Numbers & Stats » s'y prêtent.
3. **Récapitulatifs pour les parents** : une courte vidéo de progrès du mois, générée à partir des statistiques.

**Licence Remotion** ([LICENSE.md](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)) :
- gratuite pour les particuliers, les organismes à but non lucratif et les **entreprises à but lucratif de 3 salariés au plus** ;
- au-delà, licence entreprise ([remotion.pro](https://www.remotion.pro/license)) ;
- à revérifier au moment d'industrialiser les vidéos pour les élèves.

---

## 5. Plan de refonte en lots ordonnés

Règles communes :
- garder `.dark` (classe `next-themes`) comme seule convention de thème : `pages.spec.ts` la vérifie ;
- ne changer **aucun texte** des fichiers de traduction pendant la refonte ;
- ne changer **aucun rôle** des éléments.

Les e2e s'appuient surtout sur les rôles et les libellés :
- `getByRole` : 69 appels, dont 56 boutons, 21 titres (souvent `level: 1`), 13 liens, 9 cases à cocher, 8 dialogues, 6 listes déroulantes, 5 onglets, 5 radios ;
- `getByLabel` : 26 ;
- `getByText` : 14 ;
- `locator` : 3 (`math-field`, `p` des messages, `option` d'un `native-select`, `strong` du code de connexion).

Par défaut, Playwright compare les noms sans tenir compte de la casse et par sous-chaîne, sauf `exact: true` (7 occurrences). Un `text-transform: uppercase` ne gêne donc pas, mais un texte animé caractère par caractère, si.

### Lot 0. Jetons (packages/ui/src/globals.css)

**Contenu** :
- aligner les rôles sur ceux du site : `background` `#f8f8f5`, `surface-subtle`, `border-strong`, échelles `success`, `warning`, `danger`, `info` en `-soft` et `-text`, ombres et courbes ;
- garder les tons pastel des statuts ;
- échelle de rayons du §2.5 ;
- Geist et Geist Mono pour toute l'app ; Lexend et STIX conservées ;
- copier `glow.css` et les `--glow-*` ;
- trancher `--primary` : action noire ou jaune.

**Risques** :
- *Thème sombre* :
  - réécrire le bloc `.dark` à partir des valeurs sombres du site ;
  - vérifier le contraste des textes `-text` sur `-soft`, et du jaune `#ffc529` sur blanc, insuffisant pour du texte (jaune réservé aux fonds et aux traits) ;
  - le statut « Validé » change de couleur entre les thèmes aujourd'hui.
- *Accessibilité* : contrastes AA du texte secondaire (`#74746d` sur `#f8f8f5`) à mesurer.
- *e2e* : aucun.

### Lot 1. Coquille

**Contenu** :
- `app-shell.tsx` : barre latérale avec `GlowTile` et barre active glissante, groupes repliables ;
- en-tête avec fil d'Ariane, ⌘K (`command`, `kbd`) et cloche de notifications ;
- changement d'espace avec pastilles ;
- `PageHeader` avec sur-titre et `TsfTitle` ;
- `loading.tsx` par espace.

**Risques** :
- *e2e* :
  - les `h1` testés (« Mon espace », « Mes classes », « Mon compte », « Créer ma famille »…) doivent garder le même texte et rester les seuls `h1` ;
  - `TsfTitle` découpe le titre en `span`, ce qui conserve le nom accessible. **Ne pas utiliser `TsfDecode` sur un titre** : le texte brouillé serait lu pendant l'animation ;
  - le bouton de compte (`aria-label` « account ») et celui de changement d'espace gardent leurs libellés ;
  - le tiroir mobile (`@mobile`, 390 × 844) doit garder son bouton.
- *Accessibilité* :
  - les `GlowTile` sont `aria-hidden` (c'est le cas) ;
  - le libellé reste dans le lien, et l'info-bulle sert en mode replié ;
  - repli si l'utilisateur réduit les animations.
- *Thème sombre* : le halo des `GlowTile` est pensé pour fond sombre ; le vérifier sur le panneau clair `#f3f3ef`.

### Lot 2. Composants de base (packages/ui)

**Contenu** :
1. Restyler button, input, select, checkbox, radio, switch, tabs, toggle-group, badge, card, alert, dialog, dropdown, progress, avatar, skeleton, sonner.
2. Ajouter calendar, popover, field, input-group, item, empty, spinner, drawer, pagination, collapsible, hover-card, context-menu, accordion, kbd, input-otp, button-group.
3. Ajouter `NotionStatus`, `Kpi`, `ConfirmDialog`, `ChatBubble`, `TsfFrame`, `GlowTile` et `GlowIcon`.
4. Remplacer Lucide par Phosphor dans les primitives.
5. Brancher `toast()`.

**Risques** :
- *e2e* :
  - les rôles `checkbox`, `radio`, `combobox`, `tab`, `dialog` et `option` doivent rester ceux de Radix ;
  - **ne pas remplacer `native-select` par `select`** là où `messages.spec.ts` lit les `option` ;
  - `field` ne doit pas changer l'association `label` / `id` (26 `getByLabel`).
- *Accessibilité* :
  - le biseau coupe le contour de focus : focus dessiné en `inset`, comme dans `auth.css` ;
  - `Empty` porte un vrai titre ;
  - les toasts restent annoncés (Sonner les annonce en zone vivante).
- *Thème sombre* : chaque composant est à revoir dans les deux thèmes (captures Playwright clair et sombre).

### Lot 3. Espace élève (11 pages)

**Contenu** :
- accueil avec carte héro biseautée « prochaine séance / exercice du jour » et KPI ;
- exercices et devoirs (`Card`, `Empty`) ;
- `ExercisePlayer` et `MathInput` restylés ;
- coche et confettis à la réussite ;
- prof IA : chat-container, bulles unifiées, saisie avec pièce jointe et dictée, indicateur de frappe ;
- photo avec dropzone ;
- progression : anneaux et graphique.

**Risques** :
- *e2e* (`learner.spec.ts`, `family.spec.ts`) :
  - `locator("math-field")` : le champ MathLive ne doit pas être enveloppé dans un shadow DOM supplémentaire ;
  - liens « Commencer l'exercice » et « Faire l'exercice » ;
  - l'état « IA indisponible » doit rester visible (les tests tournent sans clé IA).
- *Accessibilité* :
  - Lexend en lecture facile à préserver ;
  - les confettis sont décoratifs (`aria-hidden`), et la réussite est aussi annoncée en texte ;
  - le flux du tuteur a besoin d'un `aria-live` poli.
- *Thème sombre* : couleurs de MathLive (déjà en partie dans `globals.css`).

### Lot 4. Espace prof (10 pages)

**Contenu** :
- agenda avec CalendarCN : semaine, mois, glisser-déposer, création au clic ;
- dialogues de séance avec sélecteur de date ;
- carte des notions et grille élèves × notions restylées ;
- tableau d'élèves avec TanStack et pagination ;
- banque d'exercices (kanban en option) ;
- statuts unifiés.

**Risques** :
- *e2e* (`teacher.spec.ts`, `agenda.spec.ts`) :
  - le titre « Constellation des notions » ;
  - les boutons et champs des dialogues d'agenda : les libellés `getByLabel` des champs date et heure changent de nature quand on passe des champs natifs au `Calendar` ;
  - les tests d'agenda sont **le plus gros risque de régression** : prévoir de les réécrire au même lot.
- *Accessibilité* :
  - le glisser-déposer doit avoir une alternative au clavier (le dialogue « Replanifier » existe déjà, à garder) ;
  - les couleurs d'événements ne sont jamais le seul codage.
- *Thème sombre* : les couleurs des événements de CalendarCN sont à mapper sur les jetons.

### Lot 5. Espace parent (8 pages)

**Contenu** :
- fiche enfant avec `Section` remplacée par `Card` et en-tête `GlowTile` ;
- programmes et besoins ;
- abonnements : cartes d'offre et historique en tableau ;
- agenda familial (vues de CalendarCN en lecture et réservation) ;
- messages.

**Risques** :
- *e2e* (`parent.spec.ts`) :
  - les `h1` au nom de l'enfant et le titre « Matières suivies » ;
  - le lien « Retour aux abonnements » ;
  - le paiement avec le faux fournisseur, dont l'écran de retour doit rester identique.
- *Accessibilité* : état des abonnements exprimé en texte, pas seulement par la couleur.
- *Thème sombre* : cartes d'offre.

### Lot 6. Espace école (6 pages)

**Contenu** :
- vue d'ensemble avec KPI (`Stat` remplacé par `Kpi`) et graphique de maîtrise ;
- classes ;
- membres (tableau de données, rôles) ;
- journal ;
- code de connexion (`input-otp` éventuel à l'affichage) ;
- carte de chaleur d'assiduité.

**Risques** :
- *e2e* (`school.spec.ts`) :
  - `h1` « Collège démo » et nom de classe ;
  - le code est lu par `locator("strong").nth(1)` : **garder les deux `<strong>` dans le même ordre**.
- *Accessibilité* : la carte de chaleur a besoin d'une alternative en tableau ou d'étiquettes.
- *Thème sombre* : niveaux de la carte de chaleur.

### Lot 7. Espace admin (14 pages, 37 fichiers) et compte

**Contenu** :
- `admin/_ui/fields.tsx` remplacé par `field` ;
- `EmptyState` admin remplacé par `Empty` ;
- tableaux TanStack (organisations, contacts, journal, coûts) ;
- onglets d'organisation ;
- éditeur de référentiel ;
- compte : `ConfirmDialog`, notifications.

**Risques** :
- *e2e* (`admin.spec.ts`, `rgpd.spec.ts`) :
  - liens « Ouvrir » et « France » ;
  - `h1` « France (FR) » et « Mathématiques · 5e » ;
  - « Télécharger (JSON) » et `h1` « Mon compte ».
- *Accessibilité* : tableaux denses (en-têtes `scope`, tri annoncé par `aria-sort`).
- *Thème sombre* : graphiques de coûts.

### Contrôles à chaque lot

- `pnpm e2e` en bureau et en mobile.
- Captures Playwright clair et sombre des pages du lot.
- Passage axe : la suite e2e n'en a pas aujourd'hui, il serait utile d'ajouter `@axe-core/playwright`.
- `prefers-reduced-motion` forcé une fois (`page.emulateMedia({ reducedMotion: "reduce" })`) pour vérifier que les titres et compteurs s'affichent tout de suite.

---

## Sources

- [shadcn/ui : liste des composants](https://ui.shadcn.com/docs/components)
- [shadcn/ui : Tailwind v4 et React 19](https://ui.shadcn.com/docs/tailwind-v4)
- [shadcn/ui : Chart (Recharts v3)](https://ui.shadcn.com/docs/components/radix/chart)
- [shadcn/ui : Data Table](https://ui.shadcn.com/docs/components/radix/data-table)
- [shadcn/ui : Date Picker](https://ui.shadcn.com/docs/components/radix/date-picker)
- [shadcn/ui : liste officielle des registres (registries.json)](https://ui.shadcn.com/r/registries.json)
- [Magic UI](https://magicui.design) : [licence MIT](https://github.com/magicuidesign/magicui/blob/main/LICENSE.md)
- [Animate UI](https://animate-ui.com/docs) : [licence MIT + Commons Clause](https://raw.githubusercontent.com/imskyleen/animate-ui/main/LICENSE.md)
- [React Bits](https://reactbits.dev) : [licence MIT + Commons Clause](https://raw.githubusercontent.com/DavidHDev/react-bits/main/LICENSE.md)
- [Kibo UI](https://www.kibo-ui.com) : [dépôt (MIT)](https://github.com/shadcnblocks/kibo)
- [Dice UI](https://www.diceui.com) : [dépôt (MIT)](https://github.com/sadmann7/diceui)
- [CalendarCN](https://calendarcn.xyz) : [dépôt (MIT)](https://github.com/vmnog/calendarcn)
- [prompt-kit](https://www.prompt-kit.com) : [dépôt (MIT)](https://github.com/ibelick/prompt-kit)
- [AI Elements](https://ai-sdk.dev/elements) : [licence Apache-2.0](https://raw.githubusercontent.com/vercel/ai-elements/main/LICENSE)
- [Tween UI](https://tween-ui.vercel.app) : [dépôt (MIT)](https://github.com/StaticMania/tween-ui)
- [coss ui](https://coss.com/ui) : [dépôt cosscom/coss (AGPL-3.0)](https://github.com/cosscom/coss)
- [remocn](https://remocn.dev) : [dépôt (MIT)](https://github.com/Remocn/remocn)
- [Remotion Player](https://www.remotion.dev/docs/player/player)
- [Remotion Lambda](https://www.remotion.dev/docs/lambda)
- [Licence Remotion](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)
