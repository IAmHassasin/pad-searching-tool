import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cryptoRandomInt,
  formatPublishedPercent,
  rollMany,
  rollOne,
  type RandomInt,
} from "./roll.ts";

const cards = [
  { monsterId: 10, weight: 100 },
  { monsterId: 20, weight: 200 },
  { monsterId: 30, weight: 50 },
];

function sequence(values: number[]): RandomInt {
  let index = 0;
  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
}

describe("rollOne", () => {
  it("returns the only card when that card has the whole pool", () => {
    const only = [{ monsterId: 10, weight: 100 }];
    assert.deepEqual(rollOne(only, sequence([0])), only[0]);
  });

  it("walks cumulative weights so each ticket lands on the published card", () => {
    const random = sequence([0, 99, 100, 299, 300, 349]);
    assert.deepEqual(
      [0, 99, 100, 299, 300, 349].map(() => rollOne(cards, random).monsterId),
      [10, 10, 20, 20, 30, 30]
    );
  });

  it("refuses a pool whose weights sum to zero", () => {
    assert.throws(() => rollOne([{ monsterId: 1, weight: 0 }], sequence([0])), /no roll rates/);
  });
});

describe("rollMany", () => {
  it("draws each pull from the same weights with a fresh ticket", () => {
    const drawn = rollMany(cards, 10, sequence([0, 100, 0, 300, 200, 0, 100, 349, 99, 150]));
    assert.deepEqual(
      drawn.map((card) => card.monsterId),
      [10, 20, 10, 30, 20, 10, 20, 30, 10, 20]
    );
  });
});

describe("formatPublishedPercent", () => {
  it("prints the weight as the published percentage", () => {
    assert.equal(formatPublishedPercent(165), "1.65%");
    assert.equal(formatPublishedPercent(150), "1.5%");
    assert.equal(formatPublishedPercent(200), "2%");
    assert.equal(formatPublishedPercent(1), "0.01%");
  });
});

describe("cryptoRandomInt", () => {
  it("stays inside the requested range", () => {
    for (let i = 0; i < 40; i += 1) {
      const ticket = cryptoRandomInt(3);
      assert.equal(Number.isInteger(ticket), true);
      assert.equal(ticket >= 0 && ticket < 3, true);
    }
  });
});
