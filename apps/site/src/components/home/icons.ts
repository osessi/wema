"use client";

/**
 * Icônes animées propres à l'accueil, construites comme celles de `wa/ui/icons`
 * (une icône Phosphor et un petit geste au survol), pour les pastilles GlowIcon.
 */

import {
  Atom,
  BookOpenText,
  Brain,
  Camera,
  ChalkboardTeacher,
  ChartBar,
  Exam,
  Globe,
  GraduationCap,
  Leaf,
  MathOperations,
  Repeat,
  ShieldCheck,
  Student,
  Translate,
  UserFocus,
  UsersThree,
  VideoCamera,
} from "@phosphor-icons/react";
import { gestureIcon } from "../../wa/ui/icons";

const NOD = {
  keyframes: { rotate: [0, -10, 6, 0], y: [0, -2, 0, 0] },
  duration: 0.5,
};
const HOP = { keyframes: { y: [0, -3, 1, 0] }, duration: 0.45 };
const SPIN = { keyframes: { rotate: [0, 180] }, duration: 0.6 };

export const MathIcon = gestureIcon(MathOperations, NOD, "MathIcon");
export const AtomIcon = gestureIcon(Atom, SPIN, "AtomIcon");
export const LeafIcon = gestureIcon(Leaf, NOD, "LeafIcon");
export const BookIcon = gestureIcon(BookOpenText, HOP, "BookIcon");
export const TranslateIcon = gestureIcon(Translate, NOD, "TranslateIcon");
export const GlobeSubjectIcon = gestureIcon(Globe, SPIN, "GlobeSubjectIcon");

export const ProfileIcon = gestureIcon(UserFocus, HOP, "ProfileIcon");
export const ExamIcon = gestureIcon(Exam, NOD, "ExamIcon");
export const CameraIcon = gestureIcon(Camera, HOP, "CameraIcon");
export const RepeatIcon = gestureIcon(Repeat, SPIN, "RepeatIcon");

export const ShieldIcon = gestureIcon(ShieldCheck, HOP, "ShieldIcon");
export const BrainIcon = gestureIcon(Brain, NOD, "BrainIcon");
export const ChartIcon = gestureIcon(ChartBar, HOP, "ChartIcon");

export const TeacherIcon = gestureIcon(ChalkboardTeacher, NOD, "TeacherIcon");
export const StudentIcon = gestureIcon(Student, HOP, "StudentIcon");
export const SchoolIcon = gestureIcon(GraduationCap, NOD, "SchoolIcon");
export const ClassIcon = gestureIcon(UsersThree, HOP, "ClassIcon");
export const VideoIcon = gestureIcon(VideoCamera, NOD, "VideoIcon");
