import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { syncNewDungeons } from "./dungeon-catalog-sync.ts";

const HOME = `
<nav class="nav_left_menu">
  <div class="ac2">ダンジョン攻略</div>
  <div class="ac3"><span class="leftmenu_title">ゲリラダンジョン</span></div>
  <ul class="after_h3">
    <li><a href="https://appmedia.jp/pazudora/78998525">＋限界突破コロシアム</a></li>
  </ul>
  <div class="ac3"><span class="leftmenu_title">ステージダンジョン</span></div>
  <ul class="after_h3">
    <a href="https://appmedia.jp/pazudora/80128597">大樹の霊王</a>
    <a href="https://appmedia.jp/pazudora/80347105">天穹の神王</a>
  </ul>
</nav>
`;

describe("syncNewDungeons", () => {
  it("imports only post ids newer than the seed cutoff", async () => {
    const imported: number[] = [];
    const result = await syncNewDungeons({
      fetchHomeHtml: async () => HOME,
      existingIds: [80128597],
      importDungeon: async (id) => {
        imported.push(id);
      },
    });
    assert.deepEqual(imported, [80347105]);
    assert.deepEqual(result.added, [80347105]);
    assert.deepEqual(result.failed, []);
  });

  it("records per-dungeon import failures without dropping successes", async () => {
    const result = await syncNewDungeons({
      fetchHomeHtml: async () => HOME,
      existingIds: [80128597],
      importDungeon: async (id) => {
        if (id === 80347105) throw new Error("boom");
      },
    });
    assert.deepEqual(result.added, []);
    assert.equal(result.failed.length, 1);
    assert.equal(result.failed[0]?.id, 80347105);
  });
});
