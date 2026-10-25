import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BadgeCheck,
  Boxes,
  Building2,
  CircleDollarSign,
  ClipboardList,
  FileSearch,
  FileText,
  FileUp,
  Handshake,
  Home,
  IdCard,
  LayoutGrid,
  MapPinned,
  Navigation,
  Package,
  Send,
  ShieldCheck,
  Store,
  TrendingUp,
  Truck,
  UserCircle,
  UserCog,
} from 'lucide-react';

/**
 * Content-matched icons for sidebar, cab navbar, and home shortcuts.
 * Keyed by route path (normalize trailing slash / query before lookup).
 */
const NAV_ICONS: Record<string, LucideIcon> = {
  '/': Home,
  '/sender/onboarding': BadgeCheck,
  '/jobs': Package,
  '/surcharges': CircleDollarSign,
  '/carrier/onboarding': ClipboardList,
  '/carrier/fleet': Truck,
  '/carrier/drivers': UserCog,
  '/market': Store,
  '/assignments': MapPinned,
  '/carrier/exceptions': AlertTriangle,
  '/driver/onboarding': IdCard,
  '/trips': Navigation,
  '/leads': ClipboardList,
  '/ops/partners': Handshake,
  '/companies': Building2,
  '/admin-jobs': Boxes,
  '/audit': FileSearch,
  '/partner/onboarding': BadgeCheck,
  '/ops/growth': TrendingUp,
  '/ops/growth/invite': Send,
  '/ops/my-senders': Send,
  '/ops/my-carriers': Truck,
  '/compliance': ShieldCheck,
  '/ops/exceptions': AlertTriangle,
  '/documents/upload': FileUp,
  '/account': UserCircle,
};

/** Driver docs reuse upload route but can show a docs-specific glyph when needed. */
export const DRIVER_DOCS_ICON: LucideIcon = FileText;

/** Fallback when a path is not mapped. */
export const DEFAULT_NAV_ICON: LucideIcon = LayoutGrid;

export function navIconForPath(path: string): LucideIcon {
  const normalized = path.split('?')[0]?.replace(/\/+$/, '') || '/';
  return NAV_ICONS[normalized] ?? DEFAULT_NAV_ICON;
}
