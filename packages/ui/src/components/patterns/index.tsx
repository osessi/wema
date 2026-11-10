/**
 * Motifs d'interface de Wema, repris et adaptés de ZeroAds (code d'Olivier) et de
 * sources MIT notées en tête de chaque fichier. Aucun code AGPL.
 * Import : `@wema/ui/components/patterns/index` (ou le fichier du motif).
 * Les icônes animées sont déjà dans `@wema/ui/brand` (identiques au site public).
 */
export {
  ActivityTimeline,
  type ActivityTimelineProps,
  groupEventsByDay,
  type TimelineDay,
  type TimelineEvent,
  type TimelineTone,
} from "./activity-timeline";
export {
  FilterBar,
  type FilterBarProps,
  type FilterDef,
  type FilterOption,
} from "./filter-bar";
export {
  MetricCard,
  type MetricCardProps,
  MetricCardSkeleton,
  type MetricDelta,
} from "./metric-card";
export { Nudge, type NudgeProps, type NudgeTone } from "./nudge";
export { OtpInput, type OtpInputProps, sanitizeOtp } from "./otp-input";
export {
  Property,
  PropertyList,
  type PropertyListProps,
  type PropertyProps,
} from "./property-list";
export {
  ScrollProgress,
  type ScrollProgressPosition,
  type ScrollProgressProps,
  scrollPercent,
} from "./scroll-progress";
export {
  Segmented,
  type SegmentedOption,
  type SegmentedProps,
} from "./segmented";
export {
  SetupChecklist,
  type SetupChecklistProps,
  type SetupItem,
  type SetupStatus,
} from "./setup-checklist";
export {
  CardSkeleton,
  ChartSkeleton,
  ListSkeleton,
  SkeletonGroup,
  TableRowSkeleton,
} from "./skeletons";
export {
  StepHeading,
  type StepHeadingProps,
  StepLoading,
  type StepLoadingProps,
  StepNav,
  type StepNavProps,
  Stepper,
  StepperProgress,
  type StepperProgressProps,
  type StepperProps,
  type StepperStep,
} from "./stepper";
export {
  StreamingText,
  type StreamingTextProps,
  tokenizeStream,
} from "./streaming-text";
export {
  ThinkingIndicator,
  type ThinkingIndicatorProps,
} from "./thinking-indicator";
export {
  type ViewChoice,
  ViewSwitcher,
  type ViewSwitcherProps,
} from "./view-switcher";
export { WaveLoader, type WaveLoaderProps } from "./wave-loader";
