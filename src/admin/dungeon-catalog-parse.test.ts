import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectSidebarDungeonPostIds,
  filterNewDungeonPostIds,
} from "./dungeon-catalog-parse.ts";

const FIXTURE = `
<nav class="nav_left_menu">
  <div class="ac2">ダンジョン攻略</div>
  <ul class="after_h2">
    <li>
      <div class="ac3"><span class="leftmenu_title">降臨ダンジョン</span></div>
      <ul class="after_h3">
        <li><a href="https://appmedia.jp/pazudora/467565">降臨ダンジョン一覧</a></li>
        <li><a href="https://appmedia.jp/pazudora/80340910">ブランパ降臨</a></li>
      </ul>
      <div class="ac3"><span class="leftmenu_title">ゲリラダンジョン</span></div>
      <ul class="after_h3">
        <li><a href="https://appmedia.jp/pazudora/78998525">＋限界突破コロシアム</a></li>
<!--        <li><a href="https://appmedia.jp/pazudora/99999999">十億ダンジョン</a></li>-->
        <li><a href="https://appmedia.jp/pazudora/79335344">十二億ダンジョン</a></li>
        <li><a href="https://appmedia.jp/pazudora/83349">ゲリラ一覧</a></li>
      </ul>
      <div class="ac3"><span class="leftmenu_title">ステージダンジョン</span></div>
      <ul class="after_h3">
        <table>
          <tr>
            <td><a href="https://appmedia.jp/pazudora/80048764">霧雨の魔王</a></td>
            <td><a href="https://appmedia.jp/pazudora/80128597">大樹の霊王</a></td>
          </tr>
          <tr>
            <td><a href="https://appmedia.jp/pazudora/80347105">天穹の神王</a></td>
            <td><a href="https://appmedia.jp/pazudora/79773035">その他ステージ一覧</a></td>
          </tr>
        </table>
      </ul>
      <div class="ac3"><span class="leftmenu_title">ランキングダンジョン</span></div>
      <ul class="after_h3">
        <li><a href="https://appmedia.jp/pazudora/88888888">夏休み2026杯</a></li>
      </ul>
    </li>
  </ul>
</nav>
`;

describe("collectSidebarDungeonPostIds", () => {
  it("collects guerrilla and stage ids, skips 降臨/ランキング, 一覧, and HTML comments", () => {
    assert.deepEqual(collectSidebarDungeonPostIds(FIXTURE), [
      78998525, 79335344, 80048764, 80128597, 80347105,
    ]);
  });
});

describe("filterNewDungeonPostIds", () => {
  it("keeps ids above cutoff that are not already imported", () => {
    assert.deepEqual(
      filterNewDungeonPostIds(
        [78998525, 79335344, 80048764, 80128597, 80347105],
        { cutoff: 80128597, existingIds: [80128597] }
      ),
      [80347105]
    );
  });

  it("keeps previously imported ids that were deleted from disk", () => {
    assert.deepEqual(
      filterNewDungeonPostIds(
        [78998525, 79335344, 80048764, 80128597, 80347105],
        {
          cutoff: 80128597,
          existingIds: [80128597],
          previouslyImportedIds: [80048764],
        }
      ),
      [80048764, 80347105]
    );
  });
});
