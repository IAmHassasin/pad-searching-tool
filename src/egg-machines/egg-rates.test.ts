import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decimalToWeight, ratesFromContents } from "./egg-rates.ts";

describe("decimalToWeight", () => {
  it("converts a published rate string into a weight of hundredths of a percent", () => {
    assert.equal(decimalToWeight("0.0165"), 165);
    assert.equal(decimalToWeight("0.035"), 350);
    assert.equal(decimalToWeight("0.02"), 200);
    assert.equal(decimalToWeight("0.1225"), 1225);
    assert.equal(decimalToWeight("0"), 0);
  });

  it("rejects rates with more than four decimal places", () => {
    assert.equal(decimalToWeight("0.00001"), null);
  });
});

describe("ratesFromContents", () => {
  it("reads parenthesized monster ids and keeps a positive weight per card", () => {
    assert.deepEqual(
      ratesFromContents('{"(5485)": 0.02, "(10287)": 0.0165, "(1)": 0}'),
      [
        { monsterId: 5485, weight: 200 },
        { monsterId: 10287, weight: 165 },
      ]
    );
  });

  it("keeps the last weight when the same monster is listed twice", () => {
    assert.deepEqual(ratesFromContents('{"(7)": 0.01, "(7)": 0.035}'), [
      { monsterId: 7, weight: 350 },
    ]);
  });

  it("returns no rates for an empty machine", () => {
    assert.deepEqual(ratesFromContents(null), []);
    assert.deepEqual(ratesFromContents(""), []);
  });
});
