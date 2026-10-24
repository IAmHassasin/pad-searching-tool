import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyEggMachines,
  eggPoolId,
  type EggMachineInput,
} from "./classify-egg-machines.ts";

const NOW = 2_000_000_000;
const SINCE = 1_900_000_000;

function machine(overrides: Partial<EggMachineInput> = {}): EggMachineInput {
  return {
    serverId: 0,
    name: "Event",
    start: SINCE + 86_400,
    end: SINCE + 86_400 * 10,
    cost: 10,
    machineType: 72,
    monsterIds: [1, 2, 3],
    ...overrides,
  };
}

describe("classifyEggMachines", () => {
  it("merges an exact JP and NA pool and prefers the NA name", () => {
    const events = classifyEggMachines(
      [
        machine({ name: "ハロウィンガチャ", monsterIds: [1, 2, 3] }),
        machine({
          serverId: 1,
          name: "Halloween Egg Machine",
          monsterIds: [1, 2, 3],
          start: SINCE + 86_400 * 2,
        }),
      ],
      new Set([1, 2, 3]),
      NOW,
      SINCE
    );
    assert.equal(events.length, 1);
    assert.equal(events[0]?.name, "Halloween Egg Machine");
    assert.deepEqual(events[0]?.badges, ["JP", "NA"]);
    assert.deepEqual(events[0]?.jpOnlyIds, []);
    assert.deepEqual(events[0]?.sharedIds, [1, 2, 3]);
    assert.equal(events[0]?.id, eggPoolId([1, 2, 3]));
  });

  it("marks a collab Might skip when the two previous JP collabs reached NA", () => {
    const events = classifyEggMachines(
      [
        machine({ name: "Older collab", monsterIds: [1, 2], start: SINCE + 86_400 }),
        machine({
          serverId: 1,
          name: "Older collab NA",
          monsterIds: [1, 2],
          start: SINCE + 86_400 * 2,
        }),
        machine({ name: "Middle collab", monsterIds: [3, 4], start: SINCE + 86_400 * 10 }),
        machine({
          serverId: 1,
          name: "Middle collab NA",
          monsterIds: [3, 4],
          start: SINCE + 86_400 * 11,
        }),
        machine({
          name: "Late collab",
          monsterIds: [5, 6],
          start: SINCE + 86_400 * 20,
          end: SINCE + 86_400 * 25,
        }),
        machine({ name: "Seasonal", monsterIds: [7], start: SINCE + 86_400 * 3 }),
      ],
      new Set([1, 2, 3, 4]),
      NOW,
      SINCE,
      new Set([1, 2, 3, 4, 5, 6])
    );
    const late = events.find((event) => event.name === "Late collab");
    assert.deepEqual(late?.badges, ["JP", "Might skip"]);
    assert.equal(late?.collab, true);
    assert.deepEqual(late?.jpOnlyIds, [5, 6]);
    const seasonal = events.find((event) => event.name === "Seasonal");
    assert.deepEqual(seasonal?.badges, ["JP"]);
    assert.equal(seasonal?.collab, false);
    const older = events.find((event) => event.name === "Older collab NA");
    assert.deepEqual(older?.badges, ["JP", "NA"]);
  });

  it("treats a pool as a collab only when at least 30 percent of cards are collab cards", () => {
    const previous = [
      machine({ name: "Older collab", monsterIds: [1], start: SINCE + 86_400 }),
      machine({ serverId: 1, name: "Older collab NA", monsterIds: [1] }),
      machine({ name: "Middle collab", monsterIds: [2], start: SINCE + 86_400 * 10 }),
      machine({ serverId: 1, name: "Middle collab NA", monsterIds: [2] }),
    ];
    const collabHeavy = classifyEggMachines(
      [
        ...previous,
        machine({
          name: "Mostly collab",
          monsterIds: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
          start: SINCE + 86_400 * 20,
        }),
      ],
      new Set([1, 2]),
      NOW,
      SINCE,
      new Set([1, 2, 11, 12, 13])
    );
    const thin = classifyEggMachines(
      [
        ...previous,
        machine({
          name: "Barely collab",
          monsterIds: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
          start: SINCE + 86_400 * 20,
        }),
      ],
      new Set([1, 2]),
      NOW,
      SINCE,
      new Set([1, 2, 11, 12])
    );
    assert.deepEqual(
      collabHeavy.find((event) => event.name === "Mostly collab")?.badges,
      ["JP", "Might skip"]
    );
    assert.deepEqual(
      thin.find((event) => event.name === "Barely collab")?.badges,
      ["JP"]
    );
  });

  it("does not mark a collab Might skip while an earlier collab is still missing on NA", () => {
    const events = classifyEggMachines(
      [
        machine({ name: "Older collab", monsterIds: [1], start: SINCE + 86_400 }),
        machine({ serverId: 1, name: "Older collab NA", monsterIds: [1], start: SINCE + 2 }),
        machine({ name: "Missing collab", monsterIds: [2], start: SINCE + 86_400 * 10 }),
        machine({ name: "Newer collab", monsterIds: [3], start: SINCE + 86_400 * 20 }),
      ],
      new Set([1]),
      NOW,
      SINCE,
      new Set([1, 2, 3])
    );
    assert.equal(
      events.some((event) => event.badges.includes("Might skip")),
      false
    );
  });

  it("leaves a cafe rerun unmarked when it is not a collab", () => {
    const events = classifyEggMachines(
      [
        machine({
          serverId: 1,
          name: "Butlers, Maids, and PAD Café Egg Machine 2",
          monsterIds: [1, 2, 3, 4],
          start: SINCE + 86_400,
          end: SINCE + 86_400 * 5,
        }),
        machine({
          name: "執事とメイドとパズドラカフェガチャ2",
          monsterIds: [1, 2, 3, 4, 5, 6, 7],
          start: SINCE + 86_400 * 40,
          end: NOW + 86_400,
          cost: 10,
        }),
      ],
      new Set([1, 2, 3, 4, 5, 6]),
      NOW,
      SINCE
    );
    assert.equal(events.length, 2);
    const rerun = events.find((event) => event.name.includes("カフェ"));
    assert.ok(rerun);
    assert.deepEqual(rerun.badges, ["JP"]);
    assert.deepEqual(rerun.jpOnlyIds, [7]);
    assert.deepEqual(rerun.sharedIds, [1, 2, 3, 4, 5, 6]);
    assert.equal(rerun.windows[0]?.cost, 10);
  });

  it("hides a bare Super Godfest whose pool already exists on NA", () => {
    const events = classifyEggMachines(
      [
        machine({ name: "スーパーゴッドフェス", machineType: 52, monsterIds: [8, 9] }),
        machine({
          serverId: 1,
          name: "Super Godfest",
          machineType: 52,
          monsterIds: [8, 9],
        }),
        machine({ name: "Seasonal Super Godfest", machineType: 52, monsterIds: [4] }),
        machine({
          serverId: 1,
          name: "Seasonal Super Godfest",
          machineType: 52,
          monsterIds: [4],
        }),
      ],
      new Set([4, 8, 9]),
      NOW,
      SINCE
    );
    assert.deepEqual(events, []);
  });

  it("hides a bare Super Godfest that is not a collab", () => {
    const events = classifyEggMachines(
      [
        machine({
          name: "スーパーゴッドフェス",
          machineType: 52,
          monsterIds: [20],
          start: SINCE + 86_400,
          end: SINCE + 86_400 * 3,
        }),
        machine({
          name: "Halloween Egg Machine",
          monsterIds: [1],
          start: SINCE + 86_400 * 10,
          end: SINCE + 86_400 * 20,
        }),
        machine({
          serverId: 1,
          name: "Halloween Egg Machine",
          monsterIds: [1],
          start: SINCE + 86_400 * 10,
          end: SINCE + 86_400 * 20,
        }),
      ],
      new Set([1]),
      NOW,
      SINCE,
      new Set([1])
    );
    assert.deepEqual(
      events.map((event) => event.name),
      ["Halloween Egg Machine"]
    );
  });

  it("keeps a named collab Super Godfest that already reached NA", () => {
    const events = classifyEggMachines(
      [
        machine({
          name: "アイドルマスター シンデレラガールズスーパーゴッドフェス",
          machineType: 52,
          monsterIds: [30, 31],
        }),
        machine({
          serverId: 1,
          name: "THE IDOLM@STER CINDERELLA GIRLS Super Godfest",
          machineType: 52,
          monsterIds: [30, 31],
        }),
      ],
      new Set([30, 31]),
      NOW,
      SINCE
    );
    assert.equal(events.length, 1);
    assert.equal(
      events[0]?.name,
      "THE IDOLM@STER CINDERELLA GIRLS Super Godfest"
    );
    assert.deepEqual(events[0]?.badges, ["JP", "NA"]);
  });

  it("ignores KR, permanent machines, and runs before the window", () => {
    const events = classifyEggMachines(
      [
        machine({ serverId: 2, name: "KR only", monsterIds: [40] }),
        machine({ machineType: 1, name: "Pal Egg Machine", monsterIds: [41] }),
        machine({ machineType: 2, name: "Rare Egg Machine", monsterIds: [42] }),
        machine({ machineType: 9, name: "Video Egg Machine", monsterIds: [43] }),
        machine({
          name: "Old collab",
          monsterIds: [44],
          start: SINCE - 86_400,
          end: SINCE - 1,
        }),
        machine({ name: "Visible", monsterIds: [45], start: SINCE + 10 }),
      ],
      new Set<number>(),
      NOW,
      SINCE
    );
    assert.deepEqual(
      events.map((event) => event.name),
      ["Visible"]
    );
  });

  it("sorts newest windows first", () => {
    const events = classifyEggMachines(
      [
        machine({ name: "Older", monsterIds: [1], start: SINCE + 86_400 }),
        machine({ name: "Newer", monsterIds: [2], start: SINCE + 86_400 * 50 }),
      ],
      new Set<number>(),
      NOW,
      SINCE
    );
    assert.deepEqual(
      events.map((event) => event.name),
      ["Newer", "Older"]
    );
  });
});
