import {
  LayoutDashboard,
  SquarePlus,
  FolderOpen,
  LayoutTemplate,
  Cpu,
  Palette,
  PlayCircle,
  ShieldCheck,
  ClipboardList,
  Calculator,
  BarChart3,
  GraduationCap,
  Settings,
  type LucideIcon,
} from 'lucide-react-native';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const mainNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Create', href: '/create', icon: SquarePlus },
  { label: 'My Designs', href: '/designs', icon: FolderOpen },
  { label: 'Templates', href: '/templates', icon: LayoutTemplate },
  { label: 'Machine Center', href: '/machines', icon: Cpu },
  { label: 'Thread Library', href: '/threads', icon: Palette },
  { label: 'Simulator', href: '/simulator', icon: PlayCircle },
  { label: 'Quality Check', href: '/quality-check', icon: ShieldCheck },
  { label: 'Jobs', href: '/jobs', icon: ClipboardList },
  { label: 'Cost Calculator', href: '/cost-calculator', icon: Calculator },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
];

export const learnNavItems: NavItem[] = [{ label: 'Learn', href: '/learn', icon: GraduationCap }];

export const systemNavItems: NavItem[] = [
  { label: 'Settings', href: '/settings', icon: Settings },
];

export const moreScreenItems: NavItem[] = [
  { label: 'Templates', href: '/templates', icon: LayoutTemplate },
  { label: 'Machine Center', href: '/machines', icon: Cpu },
  { label: 'Thread Library', href: '/threads', icon: Palette },
  { label: 'Simulator', href: '/simulator', icon: PlayCircle },
  { label: 'Quality Check', href: '/quality-check', icon: ShieldCheck },
  { label: 'Cost Calculator', href: '/cost-calculator', icon: Calculator },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Learn', href: '/learn', icon: GraduationCap },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export interface CreateOption {
  key: string;
  title: string;
  description: string;
  href: string;
  tint: string;
}

export const createOptions: CreateOption[] = [
  {
    key: 'auto-digitize',
    title: 'Auto Digitize',
    description: 'Upload an image and convert it into an embroidery design.',
    href: '/create/auto-digitize',
    tint: '#5B4FE8',
  },
  {
    key: 'text',
    title: 'Text',
    description: 'Create beautiful embroidered text.',
    href: '/create/text',
    tint: '#3E7BFA',
  },
  {
    key: 'monogram',
    title: 'Monogram',
    description: 'Create professional monograms.',
    href: '/create/monogram',
    tint: '#D9A441',
  },
  {
    key: 'badge',
    title: 'Badge / Logo',
    description: 'Create a badge or logo design.',
    href: '/create/badge',
    tint: '#1FAE6A',
  },
  {
    key: 'blank',
    title: 'Blank Canvas',
    description: 'Start from scratch.',
    href: '/create/blank',
    tint: '#8A8F9C',
  },
];
