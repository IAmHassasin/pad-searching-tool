import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MonsterRecord } from "../../types.ts";
import { PDC_QR_SAMPLES } from "./pdc-team-string.fixtures.ts";
import {
  PdcTeamStringError,
  parsePdcTeamString,
  pdcMonsterInfoFromRecord,
  pdcTeamStringToPst,
  pstTeamToPdc,
  serializePdcTeamString,
} from "./pdc-team-string.ts";
import { defaultTeamBuildConfig, type TeamBuildConfig } from "./types.ts";

const ids = (config: TeamBuildConfig, field: "monsterId" | "eqId") =>
  config.members.map((m) => m[field]).join(" ");

describe("parsePdcTeamString / serializePdcTeamString", () => {
  it("round-trips all real QR samples byte for byte", () => {
    assert.equal(PDC_QR_SAMPLES.length, 11);
    for (const [i, text] of PDC_QR_SAMPLES.entries()) {
      assert.equal(serializePdcTeamString(parsePdcTeamString(text)), text, `sample ${i + 1}`);
    }
  });

  it("decodes the fields shown on screenshot 1", () => {
    const team = parsePdcTeamString(PDC_QR_SAMPLES[0]);
    assert.equal(team.header, "1,0");
    assert.equal(team.badge, "2");
    assert.deepEqual(team.members.map((m) => m.monsterId), [12439, 12439, 12450, 11137, 10634, 12439]);
    assert.deepEqual(team.members.map((m) => m.assist?.id), [9994, 11147, 12145, 10305, 11416, 12441]);
    assert.deepEqual(team.members.map((m) => m.level), [99, 99, 120, 120, 120, 99]);
    const leader = team.members[0];
    assert.equal(leader.transformBaseId, 12437);
    assert.deepEqual(leader.latents, [12, 12, 3, 3, 12, 12]);
    assert.deepEqual([leader.plusHp, leader.plusAtk, leader.plusRcv], [99, 99, 99]);
    assert.equal(leader.superAwakening, 0);
    assert.equal(leader.syncAwakening, 130);
    assert.deepEqual(leader.assist, { id: 9994, level: 99, plusHp: 99, plusAtk: 99, plusRcv: 99, unknown0e: -1 });
    // Phyllis (Lv 120) picked the Aging super awakening (130); Destiny Gundam picked SB+ (56).
    assert.equal(team.members[2].superAwakening, 130);
    assert.equal(team.members[3].superAwakening, 56);
  });

  it("decodes +891 (297 per stat) and +330 (110 per stat)", () => {
    const shot3 = parsePdcTeamString(PDC_QR_SAMPLES[2]);
    assert.deepEqual([shot3.members[4].plusHp, shot3.members[4].plusAtk, shot3.members[4].plusRcv], [297, 297, 297]);
    const shot8 = parsePdcTeamString(PDC_QR_SAMPLES[7]);
    assert.deepEqual(shot8.members.map((m) => m.plusHp), [110, 110, 297, 100, 100, 110]);
  });

  it("keeps assist level 1 (screenshot 5, 7985 at Lv1)", () => {
    const team = parsePdcTeamString(PDC_QR_SAMPLES[4]);
    assert.equal(team.members[3].assist?.id, 7985);
    assert.equal(team.members[3].assist?.level, 1);
  });

  it("reads an empty slot and a card without assist (screenshot 11)", () => {
    const team = parsePdcTeamString(PDC_QR_SAMPLES[10]);
    assert.equal(team.badge, "1");
    assert.deepEqual(team.members.map((m) => m.slot), [0, 1, 2, 4, 5]);
    const noAssist = team.members[2];
    assert.equal(noAssist.monsterId, 2429);
    assert.equal(noAssist.assist, null);
    assert.deepEqual(noAssist.extraEntries, {});
  });

  it("rejects text that is not a PDC team", () => {
    for (const bad of [
      "hello",
      "https://example.com/a]b",
      "]",
      "1,0]2",
      "1,0]2}00ZZ,032r,0f0",
      "1,0]2}009lj,032r",
      "1,0]2}009lj,032r,0f0}009lj,032r,0f0",
      "1,0]2}009lj,032r,0f6",
      "1,0]2}00zzzzzzzzzzzzzzz,032r,0f0",
    ]) {
      assert.throws(() => parsePdcTeamString(bad), PdcTeamStringError, bad);
    }
  });

  it("keeps assist details without an assist id as uninterpreted entries", () => {
    const text = "1,0]1}001vh,032r,042r,052r,062r,07-1,080,0a1,0f2";
    const team = parsePdcTeamString(text);
    assert.equal(team.members[0].assist, null);
    assert.deepEqual(team.members[0].extraEntries, { "0a": "1" });
    assert.equal(serializePdcTeamString(team), text);
  });
});

describe("pdcTeamStringToPst", () => {
  it("maps screenshot 8 to the PST team", () => {
    const { config, warnings } = pdcTeamStringToPst(PDC_QR_SAMPLES[7], defaultTeamBuildConfig());
    assert.equal(ids(config, "monsterId"), "13509 13514 12905 13483 13422 13509");
    assert.equal(ids(config, "eqId"), "13075 13221 8755 10725 13496 13075");
    assert.deepEqual(config.members.map((m) => m.level), [99, 120, 120, 120, 99, 99]);
    assert.deepEqual(config.members.map((m) => m.plusAtk), [110, 110, 297, 100, 100, 110]);
    assert.deepEqual(config.members.map((m) => m.selectedSuperAwakening), [null, 138, 138, null, null, null]);
    assert.deepEqual(config.members.map((m) => m.role), ["leader", "sub", "sub", "sub", "sub", "leader"]);
    assert.equal(config.badge, "hp_15");
    assert.ok(warnings.some((w) => w.includes("Latent")));
  });

  it("maps badges and leaves empty / assist-less slots empty (screenshot 11)", () => {
    const { config } = pdcTeamStringToPst(PDC_QR_SAMPLES[10], defaultTeamBuildConfig());
    assert.equal(config.badge, "hp_10");
    assert.equal(ids(config, "monsterId"), "13509 13514 2429  13422 13509");
    assert.equal(ids(config, "eqId"), "13075 13221   13496 13075");
    assert.equal(pdcTeamStringToPst(PDC_QR_SAMPLES[2], defaultTeamBuildConfig()).config.badge, "type_devil");
  });

  it("warns about unknown badges and odd levels", () => {
    const { config, warnings } = pdcTeamStringToPst(
      "1,0]77}009lj,0335,042r,052r,062r,07-1,080,0f0",
      defaultTeamBuildConfig(),
    );
    assert.equal(config.badge, "none");
    assert.equal(config.members[0].level, 110);
    assert.ok(warnings.some((w) => w.includes('badge "77"')));
    assert.ok(warnings.some((w) => w.includes("level 113")));
  });

  it("keeps settings PDC does not carry", () => {
    const base = { ...defaultTeamBuildConfig(), dungeonId: "wind-cloud" };
    assert.equal(pdcTeamStringToPst(PDC_QR_SAMPLES[0], base).config.dungeonId, "wind-cloud");
  });
});

describe("pstTeamToPdc", () => {
  it("reproduces every sample exactly when given the imported PDC team", () => {
    for (const [i, text] of PDC_QR_SAMPLES.entries()) {
      const { config, source } = pdcTeamStringToPst(text, defaultTeamBuildConfig());
      const out = pstTeamToPdc(config, { previous: source });
      assert.equal(out.text, text, `sample ${i + 1}`);
      assert.deepEqual(out.warnings, [], `sample ${i + 1}`);
    }
  });

  it("does not share arrays with the previous team", () => {
    const { config, source } = pdcTeamStringToPst(PDC_QR_SAMPLES[0], defaultTeamBuildConfig());
    const { team } = pstTeamToPdc(config, { previous: source });
    assert.notEqual(team.members[0].latents, source.members[0].latents);
    assert.notEqual(team.members[0].keyOrder, source.members[0].keyOrder);
    assert.notEqual(team.members[0].extraEntries, source.members[0].extraEntries);
  });

  it("writes PST edits over the imported team and keeps the assist of a replaced card", () => {
    const { config, source } = pdcTeamStringToPst(PDC_QR_SAMPLES[4], defaultTeamBuildConfig());
    // Slot 4 holds 11734 with assist 7985 at Lv1; swap the card, keep the assist.
    config.members[3] = { ...config.members[3], monsterId: "13509", plusAtk: 50 };
    const team = parsePdcTeamString(pstTeamToPdc(config, { previous: source }).text);
    const slot = team.members[3];
    assert.equal(slot.monsterId, 13509);
    assert.deepEqual(slot.latents, []);
    assert.equal(slot.transformBaseId, null);
    assert.equal(slot.plusAtk, 50);
    assert.deepEqual([slot.assist?.id, slot.assist?.level], [7985, 1]);
    assert.notDeepEqual(team.members[0].latents, []);
  });

  it("builds a fresh team in canonical key order from lookup data", () => {
    const config = defaultTeamBuildConfig();
    config.badge = "hp_10";
    config.members[0] = { ...config.members[0], monsterId: "13509", eqId: "13075", level: 120 };
    config.members[1] = { ...config.members[1], monsterId: "13514", eqId: "7985", selectedSuperAwakening: 138 };
    config.members[2] = { ...config.members[2], monsterId: "2429", eqId: "", level: 99 };
    // 7985 is an equip with dadguide level 1; PDC wrote `0a1` for it in sample 5.
    const lookup = (id: number) =>
      id === 13509
        ? { transformBaseId: 13508, syncAwakeningId: 138, maxLevel: 99, assistLevel: 99 }
        : id === 7985
          ? { transformBaseId: null, syncAwakeningId: null, maxLevel: 99, assistLevel: 1 }
          : { transformBaseId: null, syncAwakeningId: null, maxLevel: 120, assistLevel: 99 };
    const { text, warnings } = pstTeamToPdc(config, { lookup });
    // Matches what PDC wrote for 13509 / 2429 in sample 11 (minus latents).
    assert.equal(
      text,
      "1,0]1}00af9,01af8,032r,042r,052r,062r,07-1,080,0g3u,09a37,0a2r,0b2r,0c2r,0d2r,0e-1,0f0" +
        "}00afe,033c,042r,052r,062r,07-1,083u,0965t,0a1,0b2r,0c2r,0d2r,0e-1,0f1" +
        "}001vh,032r,042r,052r,062r,07-1,080,0f2",
    );
    assert.deepEqual(warnings, []);
  });

  it("normalises plus values PST inputs can hold while typing", () => {
    const config = defaultTeamBuildConfig();
    config.members[0] = {
      ...config.members[0],
      monsterId: "13509",
      eqId: "13075",
      plusHp: 99.5,
      plusAtk: Number.POSITIVE_INFINITY,
      plusRcv: 1000,
      eqPlusHp: -5,
      eqPlusAtk: undefined,
      eqPlusRcv: Number.NaN,
    };
    const team = parsePdcTeamString(pstTeamToPdc(config, { lookup: () => ({}) }).text);
    const m = team.members[0];
    assert.deepEqual([m.plusHp, m.plusAtk, m.plusRcv], [100, 0, 297]);
    assert.deepEqual([m.assist?.plusHp, m.assist?.plusAtk, m.assist?.plusRcv], [0, 0, 0]);
  });

  it("warns for cards without data and badges without a PDC token", () => {
    const config = defaultTeamBuildConfig();
    config.badge = "rcv_70";
    config.members[0] = { ...config.members[0], monsterId: "13509" };
    const { text, warnings } = pstTeamToPdc(config);
    assert.ok(text.startsWith("1,0]0}"));
    assert.ok(warnings.some((w) => w.includes("rcv_70")));
    assert.ok(warnings.some((w) => w.includes("#13509")));
  });

  it("round-trips a fresh PST team through PDC text", () => {
    const config = defaultTeamBuildConfig();
    config.badge = "type_devil";
    config.members[0] = { ...config.members[0], monsterId: "12437", eqId: "11323", plusHp: 297 };
    config.members[5] = { ...config.members[5], monsterId: "13076", selectedSuperAwakening: 130 };
    const { text } = pstTeamToPdc(config, { lookup: () => ({}) });
    const back = pdcTeamStringToPst(text, defaultTeamBuildConfig()).config;
    assert.deepEqual(back.members, config.members);
    assert.equal(back.badge, "type_devil");
  });
});

describe("pdcMonsterInfoFromRecord", () => {
  it("reads the transform root, sync awakening and level caps", () => {
    const rosetta = {
      monster_id: 12439, sync_awsid: 130, transform_root_id: 12437, transform_to_ids: [],
      transform_from_ids: [12438], is_transform_form: 1, limit_mult: 0, level: 99,
    } as MonsterRecord;
    assert.deepEqual(pdcMonsterInfoFromRecord(rosetta), {
      transformBaseId: 12437, syncAwakeningId: 130, maxLevel: 99, assistLevel: 99,
    });
    const equip = { monster_id: 7985, sync_awsid: null, transform_root_id: null, limit_mult: 0, level: 1 } as MonsterRecord;
    assert.deepEqual(pdcMonsterInfoFromRecord(equip), {
      transformBaseId: null, syncAwakeningId: null, maxLevel: 99, assistLevel: 1,
    });
    // Older API without transform_root_id: leave key 01 to `previous`.
    const old = { monster_id: 13514, limit_mult: 30, level: 99 } as MonsterRecord;
    assert.equal(pdcMonsterInfoFromRecord(old).transformBaseId, undefined);
    assert.equal(pdcMonsterInfoFromRecord(old).maxLevel, 120);
  });
});
