import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseSearchMinMonsterId,
  resolveSearchIdQuery,
} from "./search-id-query.ts";

describe("parseSearchMinMonsterId", () => {
  it("defaults to 5000 when unset", () => {
    assert.equal(parseSearchMinMonsterId(undefined), 5000);
  });

  it("disables the floor for empty string", () => {
    assert.equal(parseSearchMinMonsterId(""), 0);
  });

  it("disables the floor for whitespace-only string", () => {
    assert.equal(parseSearchMinMonsterId("   "), 0);
  });

  it("disables the floor for 0", () => {
    assert.equal(parseSearchMinMonsterId("0"), 0);
  });

  it("parses a non-negative integer", () => {
    assert.equal(parseSearchMinMonsterId("5000"), 5000);
    assert.equal(parseSearchMinMonsterId(" 7500 "), 7500);
  });

  it("falls back to 5000 for invalid values", () => {
    assert.equal(parseSearchMinMonsterId("abc"), 5000);
    assert.equal(parseSearchMinMonsterId("-1"), 5000);
  });
});

describe("resolveSearchIdQuery", () => {
  it("applies the floor when idQuery is empty", () => {
    assert.deepEqual(resolveSearchIdQuery(undefined, 5000), {
      applyMinId: true,
      minMonsterId: 5000,
      exactId: null,
      likeQuery: null,
      modernOnly: true,
    });
    assert.deepEqual(resolveSearchIdQuery("   ", 5000), {
      applyMinId: true,
      minMonsterId: 5000,
      exactId: null,
      likeQuery: null,
      modernOnly: true,
    });
  });

  it("bypasses the floor for digits-only idQuery", () => {
    assert.deepEqual(resolveSearchIdQuery("4500", 5000), {
      applyMinId: false,
      minMonsterId: 5000,
      exactId: 4500,
      likeQuery: null,
      modernOnly: false,
    });
  });

  it("trims then parses leading zeros as Number", () => {
    assert.deepEqual(resolveSearchIdQuery("  04500  ", 5000), {
      applyMinId: false,
      minMonsterId: 5000,
      exactId: 4500,
      likeQuery: null,
      modernOnly: false,
    });
  });

  it("keeps LIKE and the floor for mixed / name text", () => {
    assert.deepEqual(resolveSearchIdQuery("5000abc", 5000), {
      applyMinId: true,
      minMonsterId: 5000,
      exactId: null,
      likeQuery: "5000abc",
      modernOnly: true,
    });
    assert.deepEqual(resolveSearchIdQuery(" Anubis ", 5000), {
      applyMinId: true,
      minMonsterId: 5000,
      exactId: null,
      likeQuery: "Anubis",
      modernOnly: true,
    });
  });

  it("does not apply the floor when minMonsterId is 0", () => {
    assert.deepEqual(resolveSearchIdQuery(undefined, 0), {
      applyMinId: false,
      minMonsterId: 0,
      exactId: null,
      likeQuery: null,
      modernOnly: false,
    });
    assert.deepEqual(resolveSearchIdQuery("Anubis", 0), {
      applyMinId: false,
      minMonsterId: 0,
      exactId: null,
      likeQuery: "Anubis",
      modernOnly: false,
    });
    assert.deepEqual(resolveSearchIdQuery("4500", 0), {
      applyMinId: false,
      minMonsterId: 0,
      exactId: 4500,
      likeQuery: null,
      modernOnly: false,
    });
  });
});
