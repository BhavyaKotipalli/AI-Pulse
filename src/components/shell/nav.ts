import type { Route } from "next";
import {
  BookOpen,
  Briefcase,
  FlaskConical,
  GitFork,
  LayoutDashboard,
  Library,
  MessageSquareText,
  Rocket,
  Settings2,
  Sparkles,
  Sunrise,
  TrendingUp,
  Waypoints,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: Route;
  label: string;
  Icon: LucideIcon;
  /** Second key of a `g <key>` shortcut. */
  shortcut?: string;
  description: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Intelligence",
    items: [
      { href: "/", label: "Overview", Icon: LayoutDashboard, shortcut: "o", description: "Dashboard of today's most important signals" },
      { href: "/today", label: "Today", Icon: Sunrise, shortcut: "t", description: "The 5-minute daily briefing" },
      { href: "/for-you", label: "For You", Icon: Sparkles, shortcut: "f", description: "Personalized intelligence feed" },
      { href: "/trends", label: "Trends", Icon: TrendingUp, shortcut: "n", description: "Macro trends detected across stories" },
      { href: "/graph", label: "Knowledge Graph", Icon: Waypoints, shortcut: "k", description: "How companies, models, skills and trends connect" },
    ],
  },
  {
    label: "Radar",
    items: [
      { href: "/research", label: "Research", Icon: BookOpen, shortcut: "r", description: "Papers that matter, explained" },
      { href: "/experiments", label: "Experiments", Icon: FlaskConical, shortcut: "e", description: "Projects you can build from today's news" },
      { href: "/tools", label: "Tools", Icon: Wrench, description: "New AI tools and launches worth trying" },
      { href: "/open-source", label: "Open Source", Icon: GitFork, shortcut: "g", description: "Trending repositories and star growth" },
      { href: "/startups", label: "Startups", Icon: Rocket, shortcut: "s", description: "AI startups to watch" },
      { href: "/career", label: "Career Impact", Icon: Briefcase, shortcut: "c", description: "How AI is changing jobs and skills" },
    ],
  },
  {
    label: "You",
    items: [
      { href: "/library", label: "Knowledge Library", Icon: Library, shortcut: "l", description: "Your saved intelligence" },
      { href: "/ask", label: "Ask AI", Icon: MessageSquareText, shortcut: "a", description: "Grounded answers with citations" },
      { href: "/settings", label: "Settings", Icon: Settings2, description: "Interests and AI usage" },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
