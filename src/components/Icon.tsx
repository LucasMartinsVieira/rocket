import {
  BookImage,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Eye,
  EyeOff,
  Film,
  Gamepad2,
  Grid2X2,
  Library,
  List,
  LockKeyhole,
  type LucideProps,
  Minus,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserRound,
  X,
  Telescope,
} from "lucide-react-native";
import type { ComponentType } from "react";

const icons = {
  book: BookOpen,
  bookImage: BookImage,
  check: Check,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  clapperboard: Clapperboard,
  eye: Eye,
  eyeOff: EyeOff,
  film: Film,
  gamepad: Gamepad2,
  grid: Grid2X2,
  library: Library,
  list: List,
  lock: LockKeyhole,
  minus: Minus,
  pencil: Pencil,
  plus: Plus,
  search: Search,
  settings: Settings,
  settingsAlt: SlidersHorizontal,
  sparkles: Sparkles,
  shield: ShieldCheck,
  trash: Trash2,
  user: UserRound,
  x: X,
  telescope: Telescope,
} satisfies Record<string, ComponentType<LucideProps>>;

export type IconName = keyof typeof icons;

export function Icon({ name, ...props }: LucideProps & { name: IconName }) {
  const Component = icons[name];
  return <Component {...props} />;
}
