import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import {
  Archive,
  Baby,
  Bath,
  BedDouble,
  BookOpen,
  Circle,
  CircleDollarSign,
  Coins,
  Cpu,
  DoorClosed,
  DoorOpen,
  Flame,
  Footprints,
  Gem,
  Key,
  Map,
  Package,
  Shield,
  Shirt,
  Skull,
  Sparkles,
  Square,
  SquareDashed,
  Sword,
  Table,
  Wand2,
  Zap,
} from 'lucide-react';

type IconComponent = ComponentType<LucideProps>;

const ICONS: Record<string, IconComponent> = {
  Archive,
  Baby,
  Bath,
  BedDouble,
  BookOpen,
  Circle,
  CircleDollarSign,
  Coins,
  Cpu,
  DoorClosed,
  DoorOpen,
  Flame,
  Footprints,
  Gem,
  Key,
  Map,
  Package,
  Shield,
  Shirt,
  Skull,
  Sparkles,
  Square,
  SquareDashed,
  Sword,
  Table,
  Wand2,
  Zap,
};

const ICON_ALIASES: Record<string, string> = {
  Shoe: 'Footprints',
};

export function resolveIconComponent(name?: string): IconComponent {
  if (!name) return Package;
  const normalized = ICON_ALIASES[name] ?? name;
  return ICONS[normalized] ?? Package;
}
