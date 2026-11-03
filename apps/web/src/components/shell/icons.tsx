"use client";

import {
  BookOpenText,
  Books,
  CalendarCheck,
  ChalkboardTeacher,
  ChartLineUp,
  ChatsCircle,
  ChatsTeardrop,
  Exam,
  Gauge,
  GearSix,
  Graph,
  House,
  type Icon,
  ListChecks,
  Path,
  Student,
  UserCircle,
  Users,
  UsersThree,
} from "@phosphor-icons/react";

/**
 * Icônes de navigation (Phosphor). Les menus sont décrits côté serveur, qui
 * ne peut pas transmettre de composants : on y désigne l'icône par son nom.
 */
export const NAV_ICONS = {
  home: House,
  assignments: CalendarCheck,
  exercises: Exam,
  tutor: ChatsCircle,
  map: Graph,
  path: Path,
  profile: UserCircle,
  classes: ChalkboardTeacher,
  bank: Books,
  learners: Student,
  children: UsersThree,
  progress: ChartLineUp,
  members: Users,
  overview: Gauge,
  settings: GearSix,
  curriculum: BookOpenText,
  checklist: ListChecks,
  messages: ChatsTeardrop,
} satisfies Record<string, Icon>;

export type NavIcon = keyof typeof NAV_ICONS;
