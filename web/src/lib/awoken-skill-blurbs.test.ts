import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  blurbFromAwokenRow,
  resolveAwokenSkillBlurb,
  usableAwokenText,
} from "./awoken-skill-blurbs.ts";

describe("awoken skill blurbs", () => {
  it("drops the Untranslated placeholder", () => {
    assert.equal(usableAwokenText("Untranslated"), "");
    assert.equal(usableAwokenText("  "), "");
    assert.equal(usableAwokenText("7x ATK"), "7x ATK");
  });

  it("reads name and description from a dadguide row", () => {
    const parsed = blurbFromAwokenRow({
      awoken_skill_id: 35,
      name_en: "Balanced Killer",
      name_ja: "Untranslated",
      desc_en: "Increase ATK against Balanced enemies by 5x",
      desc_ja: "Untranslated",
    });
    assert.deepEqual(parsed, {
      id: 35,
      blurb: {
        name: "Balanced Killer",
        description: "Increase ATK against Balanced enemies by 5x",
      },
    });
  });

  it("keeps a row with no usable description", () => {
    const parsed = blurbFromAwokenRow({
      awoken_skill_id: 149,
      name_en: "",
      desc_en: "Untranslated",
    });
    assert.equal(parsed?.id, 149);
    assert.equal(parsed?.blurb.description, "");
  });

  it("fills Assist Invalid Resist, which is also missing from the database", () => {
    assert.deepEqual(resolveAwokenSkillBlurb(148, null), {
      name: "Resistance-Assist Invalid",
      description: "Blocks Assist Invalid attacks directed at itself",
    });
    assert.equal(resolveAwokenSkillBlurb(154, null), null);
  });

  it("uses the approved column text when the database has none", () => {
    const dark = resolveAwokenSkillBlurb(153, null);
    assert.equal(dark?.name, "Dark Column Attack");
    assert.equal(
      dark?.description,
      "7x ATK and +1 combo for each column of Dark orbs matched. " +
        "Deals damage equal to 2.5% of enemies' max HP at 15+ combos. " +
        "The combo bonus does not stack with multiple copies. " +
        "Connected columns in one match count as one column."
    );
    const fire = resolveAwokenSkillBlurb(149, {
      name: "",
      description: "",
    });
    assert.equal(fire?.name, "Fire Column Attack");
    assert.match(fire?.description ?? "", /column of Fire orbs/);
  });

  it("keeps a database description ahead of the column fallback", () => {
    assert.deepEqual(
      resolveAwokenSkillBlurb(149, {
        name: "From DB",
        description: "Stored text",
      }),
      { name: "From DB", description: "Stored text" }
    );
    assert.equal(resolveAwokenSkillBlurb(35, null), null);
  });
});
