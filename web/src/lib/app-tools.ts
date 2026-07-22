import { pstLogoUrl } from "./pst-brand";

export type AppTool = {
  href: string;
  label: string;
  description: string;
  /** Emoji or short glyph for the launcher tile */
  icon?: string;
  /** Brand image (overrides icon when set) */
  imageUrl?: string;
};

export const APP_TOOLS: AppTool[] = [
  {
    href: "/",
    label: "Search",
    description: "Monster & skill filters",
    imageUrl: pstLogoUrl,
  },
  {
    href: "/team-build",
    label: "Team",
    description: "Team build & raw stats",
    icon: "🛡",
  },
  {
    href: "/one-touch",
    label: "One-touch",
    description: "Floor guides & awakenings",
    icon: "👆",
  },
  {
    href: "/dungeon-details",
    label: "Dungeons",
    description: "AppMedia floor tables",
    icon: "🏰",
  },
  {
    href: "/event",
    label: "Events",
    description: "New monster & evolution announcements",
    icon: "📰",
  },
];

export function currentAppPath(): string {
  return window.location.pathname.replace(/\/+$/, "") || "/";
}

export function isAppToolActive(toolHref: string, current = currentAppPath()): boolean {
  if (toolHref === "/") return current === "/";
  return current === toolHref || current.startsWith(`${toolHref}/`);
}
