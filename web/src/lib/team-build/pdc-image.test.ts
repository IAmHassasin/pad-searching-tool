import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MonsterRecord } from "../../types.ts";
import { buildPdcImage, pdcQrModules } from "./pdc-image.ts";
import { PDC_QR_SAMPLES } from "./pdc-team-string.fixtures.ts";
import { pdcTeamStringToPst } from "./pdc-team-string.ts";
import { defaultTeamBuildConfig } from "./types.ts";

/** QR versions read from the eleven PDC screenshots (jsQR), in sample order. */
const PDC_SAMPLE_QR_VERSIONS = [18, 18, 18, 18, 18, 16, 18, 18, 18, 18, 15];

// Attributes / levels as in seed/dadguide.sqlite (0 fire, 1 water, 3 light, 4 dark).
const rows: MonsterRecord[] = [
  { monster_id: 13509, attribute_1_id: 3, sync_awsid: 138, transform_root_id: 13508, is_transform_form: 1, limit_mult: 0, level: 99 },
  { monster_id: 13514, attribute_1_id: 4, sync_awsid: null, transform_root_id: null, limit_mult: 30, level: 99 },
  { monster_id: 2429, attribute_1_id: 0, sync_awsid: null, transform_root_id: null, limit_mult: 0, level: 99 },
  { monster_id: 13422, attribute_1_id: 3, sync_awsid: 142, transform_root_id: 13421, is_transform_form: 1, limit_mult: 0, level: 99 },
  { monster_id: 11734, attribute_1_id: 0, sync_awsid: 130, transform_root_id: 11733, is_transform_form: 1, limit_mult: 0, level: 99 },
  { monster_id: 13075, attribute_1_id: 3, limit_mult: 0, level: 99 },
  { monster_id: 13221, attribute_1_id: 4, limit_mult: 0, level: 99 },
  { monster_id: 13496, attribute_1_id: 1, limit_mult: 0, level: 99 },
  { monster_id: 7985, attribute_1_id: 0, limit_mult: 0, level: 1 },
] as MonsterRecord[];
const byId = new Map(rows.map((r) => [Number(r.monster_id), r]));

describe("pdcQrModules", () => {
  it("picks the same QR version PDC did for every sample (error correction M)", () => {
    PDC_QR_SAMPLES.forEach((text, i) => {
      const size = pdcQrModules(text).length;
      assert.equal(size, 17 + 4 * PDC_SAMPLE_QR_VERSIONS[i], `sample ${i + 1}`);
    });
  });
});

describe("buildPdcImage", () => {
  it("lays out screenshot 11 with title, memo, empty slot and assist-less card", () => {
    const { config } = pdcTeamStringToPst(PDC_QR_SAMPLES[10], defaultTeamBuildConfig());
    const { model, warnings } = buildPdcImage(config, byId, {
      title: "  Team Test 123 @ 456 . )(  ",
      memo: "This is memo text, 123567890(#;'+`!'¶$!",
    });
    assert.equal(model.title, "Team Test 123 @ 456 . )(");
    assert.equal(model.memo, "This is memo text, 123567890(#;'+`!'¶$!");
    assert.equal(model.badgeLabel, "HP+");
    assert.equal(model.slots[3].card, null);
    assert.equal(model.slots[2].assist, null);
    assert.deepEqual(model.slots[0].card, {
      monsterId: 13509,
      plusLabel: "+330",
      level: 99,
      awakening: { id: 138, kind: "sync" },
    });
    assert.deepEqual(model.slots[1].card?.awakening, { id: 138, kind: "super" });
    assert.equal(model.slots[1].card?.level, 120);
    // 13496 (water) on 13422 (light): no assist bonus, PDC shows neither level nor plus.
    assert.deepEqual(model.slots[4].assist, { monsterId: 13496, plusLabel: null, level: null, awakening: null });
    assert.deepEqual(model.slots[0].assist, { monsterId: 13075, plusLabel: "+297", level: 99, awakening: null });
    assert.ok(model.qrText.startsWith("1,0]1}00af9,01af8,032r,0432,0532,0632,07-1,080,0g3u,09a37,0a2r"));
    assert.ok(model.qrText.includes("}001vh,032r,042r,052r,062r,07-1,080,0f2}"));
    assert.ok(!model.qrText.includes("0f3"));
    assert.deepEqual(warnings, []);
  });

  it("shows LV1 without plus on a Lv1 equip (screenshot 5, 7985) and draws labels without DB rows", () => {
    const config = defaultTeamBuildConfig();
    config.members[0] = { ...config.members[0], monsterId: "11734", eqId: "7985", level: 99 };
    config.members[1] = { ...config.members[1], monsterId: "99998", eqId: "99999" };
    const { model } = buildPdcImage(config, byId, { title: "", memo: "" });
    assert.deepEqual(model.slots[0].assist, { monsterId: 7985, plusLabel: null, level: 1, awakening: null });
    assert.deepEqual(model.slots[1].assist, { monsterId: 99999, plusLabel: "+297", level: 99, awakening: null });
  });

  it("keeps latents and the exact QR of a team imported from PDC", () => {
    const { config, source } = pdcTeamStringToPst(PDC_QR_SAMPLES[10], defaultTeamBuildConfig());
    const { model, warnings } = buildPdcImage(config, byId, { title: "", memo: "" }, source);
    assert.equal(model.qrText, PDC_QR_SAMPLES[10]);
    assert.deepEqual(warnings, []);
  });

  it("caps title and memo length", () => {
    const { model } = buildPdcImage(defaultTeamBuildConfig(), byId, { title: "x".repeat(200), memo: "y".repeat(900) });
    assert.equal(model.title.length, 60);
    assert.equal(model.memo.length, 400);
    assert.ok(model.slots.every((s) => s.card == null));
  });
});
