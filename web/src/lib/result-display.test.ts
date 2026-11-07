import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_RESULT_DISPLAY_SECTIONS,
  displayTabFromSections,
  sectionsForDisplayTab,
} from "./result-display.ts";

describe("mobile display tabs", () => {
  it("maps each tab to exactly the sections it shows", () => {
    assert.deepEqual(sectionsForDisplayTab("awakening", DEFAULT_RESULT_DISPLAY_SECTIONS), {
      awk: true,
      activeSkill: false,
      leaderSkill: false,
      fullArt: false,
    });
    assert.deepEqual(sectionsForDisplayTab("leader", DEFAULT_RESULT_DISPLAY_SECTIONS), {
      awk: false,
      activeSkill: false,
      leaderSkill: true,
      fullArt: false,
    });
    assert.deepEqual(sectionsForDisplayTab("active", DEFAULT_RESULT_DISPLAY_SECTIONS), {
      awk: false,
      activeSkill: true,
      leaderSkill: false,
      fullArt: false,
    });
    // Stats (HP/ATK/RCV) only render on the full card, i.e. all sections on.
    assert.deepEqual(sectionsForDisplayTab("stats", DEFAULT_RESULT_DISPLAY_SECTIONS), {
      awk: true,
      activeSkill: true,
      leaderSkill: true,
      fullArt: false,
    });
  });

  it("keeps the fullArt flag untouched when switching tabs", () => {
    const next = sectionsForDisplayTab("leader", {
      ...DEFAULT_RESULT_DISPLAY_SECTIONS,
      fullArt: true,
    });
    assert.equal(next.fullArt, true);
  });

  it("reads the active tab back from the sections", () => {
    assert.equal(displayTabFromSections(DEFAULT_RESULT_DISPLAY_SECTIONS), "awakening");
    assert.equal(
      displayTabFromSections({ awk: false, activeSkill: false, leaderSkill: true, fullArt: false }),
      "leader"
    );
    assert.equal(
      displayTabFromSections({ awk: false, activeSkill: true, leaderSkill: false, fullArt: false }),
      "active"
    );
    assert.equal(
      displayTabFromSections({ awk: true, activeSkill: true, leaderSkill: true, fullArt: true }),
      "stats"
    );
  });

  it("returns null for mixed selections made from the display menu", () => {
    assert.equal(
      displayTabFromSections({ awk: true, activeSkill: true, leaderSkill: false, fullArt: false }),
      null
    );
    assert.equal(
      displayTabFromSections({ awk: false, activeSkill: false, leaderSkill: false, fullArt: false }),
      null
    );
  });
});
