import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitMobileNavTools } from "./mobile-nav.ts";

const TOOLS = [
  { href: "/", label: "Search" },
  { href: "/team-build", label: "Team" },
  { href: "/tier-maker", label: "Tier Maker" },
  { href: "/one-touch", label: "One-touch" },
  { href: "/custom-card", label: "Custom" },
  { href: "/translate", label: "Translate" },
  { href: "/dungeon-details", label: "Dungeons" },
  { href: "/event", label: "Events" },
  { href: "/egg-machines", label: "Egg Machines" },
];

describe("splitMobileNavTools", () => {
  it("pins Monsters, Teams and Dungeons as the primary bottom-nav items", () => {
    const { primary } = splitMobileNavTools(TOOLS);
    assert.deepEqual(
      primary.map((t) => [t.href, t.navLabel]),
      [
        ["/", "Monsters"],
        ["/team-build", "Teams"],
        ["/dungeon-details", "Dungeons"],
      ]
    );
  });

  it("moves every remaining tool into Others, keeping APP_TOOLS order", () => {
    const { others } = splitMobileNavTools(TOOLS);
    assert.deepEqual(
      others.map((t) => t.href),
      ["/tier-maker", "/one-touch", "/custom-card", "/translate", "/event", "/egg-machines"]
    );
  });

  it("skips a primary slot whose tool is missing instead of throwing", () => {
    const { primary, others } = splitMobileNavTools(
      TOOLS.filter((t) => t.href !== "/dungeon-details")
    );
    assert.deepEqual(primary.map((t) => t.href), ["/", "/team-build"]);
    assert.equal(others.some((t) => t.href === "/dungeon-details"), false);
  });
});
