import { test } from "node:test";
import assert from "node:assert/strict";
import { exportTeamBuildImgString, formatBuildImgPlus } from "./buildimg-export.ts";
import { defaultTeamBuildConfig } from "./types.ts";

test("plus: +891 clamps to +297, partial plus is per stat", () => {
  assert.equal(formatBuildImgPlus(297, 297, 297), "+297");
  assert.equal(formatBuildImgPlus(99, 99, 99), "+297");
  assert.equal(formatBuildImgPlus(0, 0, 0), "+0");
  assert.equal(formatBuildImgPlus(297, 0, 50), "+H99 +A0 +R50");
});

test("empty team exports six sdr slots", () => {
  assert.equal(
    exportTeamBuildImgString(defaultTeamBuildConfig()),
    "^buildimg sdr / sdr / sdr / sdr / sdr / sdr"
  );
});

test("card with assist id, level and plus; super awakening is not exported", () => {
  const config = defaultTeamBuildConfig();
  config.members[0] = {
    ...config.members[0],
    monsterId: "13692",
    eqId: "13022",
    plusHp: 297,
    plusAtk: 297,
    plusRcv: 297,
    level: 120,
    selectedSuperAwakening: 137,
  };
  config.members[1] = { ...config.members[1], monsterId: "4454", level: 99, plusHp: 0, plusAtk: 0, plusRcv: 0 };
  config.members[5] = { ...config.members[5], monsterId: "13692", eqId: "1" };

  assert.equal(
    exportTeamBuildImgString(config),
    "^buildimg 13692(13022)|LV120 +297 / 4454|LV99 +0 / sdr / sdr / sdr / 13692|LV120 +297"
  );
});
