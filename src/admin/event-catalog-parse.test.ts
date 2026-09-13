import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractEventNameFromArticle,
  extractUpgradeMonsterNames,
  listEvolutionArticleUrls,
  matchExistingEvent,
  matchGroupByEventName,
  slugifyEventId,
  findRelatedEventUrl,
} from "./event-catalog-parse.ts";

describe("listEvolutionArticleUrls", () => {
  it("keeps unique New Evolutions article hrefs from the news listing", () => {
    const html = `
      <a href="https://www.puzzleanddragons.us/single-post/pad-x-event-2609">PAD X Event</a>
      <a href="https://www.puzzleanddragons.us/single-post/new-evolutions-upgrades-2609-2">New Evolutions &amp; Upgrades!</a>
      <a href="https://www.puzzleanddragons.us/single-post/new-evolutions-upgrades-2609-2">dup</a>
    `;
    assert.deepEqual(listEvolutionArticleUrls(html), [
      "https://www.puzzleanddragons.us/single-post/new-evolutions-upgrades-2609-2",
    ]);
  });
});

describe("extractEventNameFromArticle", () => {
  it("reads PAD X from the Select-monsters upgrades sentence", () => {
    const text =
      "Select PAD X monsters have received upgrades as well! See here for information";
    assert.equal(extractEventNameFromArticle(text), "PAD X");
  });

  it("reads GungHo Collab from the Select-characters sentence", () => {
    const text =
      "Select GungHo Collab characters have received upgrades as well!";
    assert.equal(extractEventNameFromArticle(text), "GungHo Collab");
  });

  it("returns null when the sentence is missing", () => {
    assert.equal(extractEventNameFromArticle("PAD X Super Godfest arrives"), null);
  });
});

describe("extractUpgradeMonsterNames", () => {
  it("splits Assist Evolution names on and", () => {
    const text =
      "Primordial God of the Underworld, Izanagi X and Abyssal Dragon of Purple Light, Apocalypse X have received Assist Evolutions! Select PAD X monsters have received upgrades as well!";
    assert.deepEqual(extractUpgradeMonsterNames(text), [
      "Primordial God of the Underworld, Izanagi X",
      "Abyssal Dragon of Purple Light, Apocalypse X",
    ]);
  });

  it("ignores the Select-upgrades sentence when it appears first", () => {
    const text =
      "Select GungHo Collab characters have received upgrades as well! Primordial God of the Underworld, Izanagi X have received Assist Evolutions!";
    assert.deepEqual(extractUpgradeMonsterNames(text), [
      "Primordial God of the Underworld, Izanagi X",
    ]);
  });
});

describe("matchExistingEvent / slugifyEventId", () => {
  const events = [
    {
      eventId: "gungho-collab-returns-2609",
      title: "GUNGHO COLLAB RETURNS",
    },
    {
      eventId: "detective-conan-collab-2607",
      title: "Detective Conan Collab",
    },
  ];

  it("matches GungHo Collab to the existing GungHo seed", () => {
    assert.equal(
      matchExistingEvent("GungHo Collab", events)?.eventId,
      "gungho-collab-returns-2609"
    );
  });

  it("does not match PAD X to an unrelated collab", () => {
    assert.equal(matchExistingEvent("PAD X", events), null);
  });

  it("slugifies PAD X", () => {
    assert.equal(slugifyEventId("PAD X"), "pad-x");
  });
});

describe("matchGroupByEventName", () => {
  const groups = [
    { groupId: 185, groupName: "Gintama" },
    { groupId: 99, groupName: "PAD X" },
    { groupId: 12, groupName: "Detective Conan" },
  ];

  it("matches Gintama Collab Returns to the Gintama series group", () => {
    assert.equal(
      matchGroupByEventName("GINTAMA COLLAB RETURNS", groups)?.groupId,
      185
    );
  });

  it("prefers the longer series name when two could match", () => {
    const mixed = [
      { groupId: 1, groupName: "Conan" },
      { groupId: 12, groupName: "Detective Conan" },
    ];
    assert.equal(
      matchGroupByEventName("Detective Conan Collab", mixed)?.groupId,
      12
    );
  });

  it("does not match PAD X to Gintama", () => {
    assert.equal(matchGroupByEventName("PAD X", groups)?.groupId, 99);
    assert.equal(
      matchGroupByEventName("PAD X", groups.filter((g) => g.groupId !== 99)),
      null
    );
  });

  it("does not match PAD X to a one-token PAD series", () => {
    assert.equal(
      matchGroupByEventName("PAD X", [{ groupId: 1, groupName: "PAD" }]),
      null
    );
  });
});

describe("findRelatedEventUrl", () => {
  const html = `
    <a href="https://www.puzzleanddragons.us/single-post/pad-x-event-2609">PAD X Event</a>
    <a href="https://www.puzzleanddragons.us/single-post/pad-x-super-godfest-2609">Godfest</a>
    <a href="https://www.puzzleanddragons.us/single-post/new-evolutions-upgrades-2609-2">Upgrades</a>
  `;

  it("picks the event article, not Godfest or upgrades", () => {
    assert.equal(
      findRelatedEventUrl(html, "PAD X"),
      "https://www.puzzleanddragons.us/single-post/pad-x-event-2609"
    );
  });

  it("returns null when no sibling event post exists", () => {
    assert.equal(findRelatedEventUrl(html, "GungHo Collab"), null);
  });
});
