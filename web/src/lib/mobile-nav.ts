/**
 * Mobile bottom navigation: three pinned tools plus an "Others" sheet that
 * lists every remaining entry of APP_TOOLS. Kept free of DOM / asset imports
 * so it is unit-testable under node.
 */

export type MobileNavTool<T extends { href: string; label: string }> = T & {
  /** Short bottom-nav label (APP_TOOLS labels are tuned for the ribbon). */
  navLabel: string;
};

const PRIMARY_NAV: { href: string; navLabel: string }[] = [
  { href: "/", navLabel: "Monsters" },
  { href: "/team-build", navLabel: "Teams" },
  { href: "/dungeon-details", navLabel: "Dungeons" },
];

export function splitMobileNavTools<T extends { href: string; label: string }>(
  tools: readonly T[]
): { primary: MobileNavTool<T>[]; others: MobileNavTool<T>[] } {
  const primary: MobileNavTool<T>[] = [];
  for (const slot of PRIMARY_NAV) {
    const tool = tools.find((t) => t.href === slot.href);
    if (tool) primary.push({ ...tool, navLabel: slot.navLabel });
  }
  const primaryHrefs = new Set(primary.map((t) => t.href));
  const others = tools
    .filter((t) => !primaryHrefs.has(t.href))
    .map((t) => ({ ...t, navLabel: t.label }));
  return { primary, others };
}
