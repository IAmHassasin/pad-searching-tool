export type AppTool = {
  href: string;
  label: string;
  description: string;
  /** Emoji or short glyph for the launcher tile */
  icon: string;
};

export const APP_TOOLS: AppTool[] = [
  {
    href: "/",
    label: "Search",
    description: "Monster & skill filters",
    icon: "🔍",
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
];

export function currentAppPath(): string {
  return window.location.pathname.replace(/\/+$/, "") || "/";
}

export function isAppToolActive(toolHref: string, current = currentAppPath()): boolean {
  if (toolHref === "/") return current === "/";
  return current === toolHref || current.startsWith(`${toolHref}/`);
}
