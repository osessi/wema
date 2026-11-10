"use client";

import {
  BookOpenText,
  CalendarDots,
  ChalkboardTeacher,
  ChatsTeardrop,
  Exam,
  Gauge,
  Graph,
  ListChecks,
  Path,
  Student,
  UserCircle,
  Users,
} from "@phosphor-icons/react";
import {
  type AnimatedIcon,
  BooksIcon,
  CalendarCheckIcon,
  ChartLineUpIcon,
  ChatsCircleIcon,
  CreditCardIcon,
  GearIcon,
  type Gesture,
  type GlowTone,
  gestureIcon,
  HouseIcon,
  UsersThreeIcon,
} from "@wema/ui/brand";

/** Petit mouvement générique pour les glyphes Phosphor sans geste dédié. */
const NUDGE: Gesture = {
  keyframes: { y: [0, -2.5, 0.5, 0], rotate: [0, -8, 3, 0] },
  duration: 0.5,
  origin: [0.5, 0.8],
};
const SWING: Gesture = {
  keyframes: { rotate: [0, -12, 8, 0] },
  duration: 0.55,
  origin: [0.5, 0.1],
};

/**
 * Icônes de navigation, animées au survol (Phosphor, trait du site). Les menus
 * sont décrits côté serveur, qui ne peut pas transmettre de composants : on y
 * désigne l'icône par son nom.
 */
export const NAV_ICONS = {
  home: HouseIcon,
  assignments: CalendarCheckIcon,
  exercises: gestureIcon(Exam, NUDGE, "ExamIcon"),
  tutor: ChatsCircleIcon,
  map: gestureIcon(Graph, NUDGE, "GraphIcon"),
  path: gestureIcon(Path, NUDGE, "PathIcon"),
  profile: gestureIcon(UserCircle, NUDGE, "UserCircleIcon"),
  classes: gestureIcon(ChalkboardTeacher, NUDGE, "ChalkboardTeacherIcon"),
  bank: BooksIcon,
  learners: gestureIcon(Student, NUDGE, "StudentIcon"),
  children: UsersThreeIcon,
  progress: ChartLineUpIcon,
  members: gestureIcon(Users, NUDGE, "UsersIcon"),
  overview: gestureIcon(Gauge, NUDGE, "GaugeIcon"),
  settings: GearIcon,
  curriculum: gestureIcon(BookOpenText, NUDGE, "BookOpenTextIcon"),
  checklist: gestureIcon(ListChecks, NUDGE, "ListChecksIcon"),
  messages: gestureIcon(ChatsTeardrop, NUDGE, "ChatsTeardropIcon"),
  billing: CreditCardIcon,
  agenda: gestureIcon(CalendarDots, SWING, "CalendarDotsIcon"),
} satisfies Record<string, AnimatedIcon>;

export type NavIcon = keyof typeof NAV_ICONS;

/**
 * Un ton de pastille par domaine (pas par écran), dans la palette Wema :
 * jaune (accueil), ambre (échéances), menthe (contenus, progrès), rose (prof
 * IA), ciel (échanges, parcours), ardoise (compte, réglages).
 */
export const NAV_TONES: Record<NavIcon, GlowTone> = {
  home: "yellow",
  overview: "yellow",
  children: "yellow",
  assignments: "amber",
  agenda: "amber",
  checklist: "amber",
  exercises: "mint",
  bank: "mint",
  curriculum: "mint",
  progress: "mint",
  tutor: "rose",
  learners: "rose",
  path: "sky",
  map: "sky",
  messages: "sky",
  classes: "sky",
  profile: "slate",
  members: "slate",
  settings: "slate",
  billing: "slate",
};

/** Groupes de la barre latérale : le travail, les échanges, le compte. */
export const NAV_GROUP: Record<NavIcon, 0 | 1 | 2> = {
  home: 0,
  overview: 0,
  children: 0,
  assignments: 0,
  exercises: 0,
  bank: 0,
  curriculum: 0,
  progress: 0,
  tutor: 0,
  learners: 0,
  path: 0,
  map: 0,
  classes: 0,
  checklist: 0,
  agenda: 1,
  messages: 1,
  profile: 2,
  members: 2,
  settings: 2,
  billing: 2,
};

/** Pastille de chaque espace dans le sélecteur. */
export const SPACE_STYLE: Record<
  string,
  { readonly tone: GlowTone; readonly icon: AnimatedIcon }
> = {
  learner: { tone: "yellow", icon: gestureIcon(Student, NUDGE, "LearnerIcon") },
  teacher: {
    tone: "mint",
    icon: gestureIcon(ChalkboardTeacher, NUDGE, "TeacherIcon"),
  },
  guardian: { tone: "rose", icon: UsersThreeIcon },
  school: { tone: "sky", icon: gestureIcon(Gauge, NUDGE, "SchoolIcon") },
  admin: { tone: "slate", icon: GearIcon },
};
