# Team build: +891, Part Break Bonus, Trial theo tầng — plan

Ngày: 2026-11-09 · Trạng thái: **chờ user trả lời câu hỏi mở (mục 5)** trước khi code.

Ký hiệu: ✅ đã xác minh (nguồn / code) · ⚠️ giả định · ❓ cần user quyết.

---

## 0. Hiện trạng (đã đọc code)

| Chỗ | Hiện tại |
|---|---|
| `web/src/lib/team-build/max-out.ts` | `MAX_PLUS = 99` → Max all = +99/stat = **+297**, cả card lẫn assist. |
| `team-draft-storage.ts:71-76`, `TeamBuildPage.tsx:329-352` | Input + lưu draft **đã cho 0–297/stat** (tức +891). Chỉ Max all và text là sai. |
| `assist-bonus.ts:22-38` | Assist bonus dùng `eqPlus*` **không chặn** → nếu assist nhập > +99/stat thì bonus bị tính dư (bug tiềm ẩn, xem 1.3). |
| `damage/awakening-multipliers.ts:387` | Awk 131 Part Break Bonus = `1.2^parts131`, `parts131` 0–10, mỗi bản copy nhân thêm một lần (`awakening-stat-modifier.ts` loop theo copy). |
| `AwkModifierModal.tsx:105-218` | Số part chỉ chỉnh được khi bật thủ công awk 131 trong modal "manual awakenings" — 1 giá trị cho cả team, không gắn dungeon/tầng. |
| Awk 130 Aging (熟成, icon thùng gỗ = "barrel") | `agingBattle` 5 / 10 → ×1.5 từ tầng 5, ×2 từ tầng 10; cũng chỉ chỉnh thủ công. |
| `TeamTrialPanel.tsx` + `resilience.ts` | Chỉ 1 max hit cho cả dungeon; 1 HP-buff + 1 shield active chọn chung. |
| `dungeon-details/seed/dungeons/*.json` | 86 seed có bảng tầng (`floors[].spawns[].effects[].raw`); 805 tầng, 472 tầng có số "…ダメージ". Catalog 191 entry, ~105 entry chỉ có `maxHit` (không có bảng tầng). |

## 1. +891 (Max all)

**Why.** Từ 2025 có ＋限界突破: +99/stat → +297/stat (tổng +891). ✅ AppMedia 78998687, GameWith 503140. Max all đang dừng ở +297 nên HP/ATK/RCV thấp hơn thực tế ~15% (AppMedia ước lượng).

**What.**
1. Max all đặt card = +297/stat (badge hiện **+891**).
2. Mỗi điểm + vẫn là HP+10 / ATK+5 / RCV+3 (✅ suy ra từ bảng AppMedia, khớp `stat-reference.ts`).
3. Assist bonus chỉ tính phần +≤99/stat. ✅ GameWith 503140: 「＋限界突破で増えた分のパラメータに関してはアシストボーナスが反映されない」. Sửa `assist-bonus.ts` để `min(eqPlus, 99)` → đồng thời fix bug dư bonus hiện tại.
4. Assist khi Max all: xem ❓Q1.

**How.**
- `max-out.ts`: tách `MAX_PLUS_CARD = 297`, `MAX_PLUS_ASSIST` (theo Q1), `ASSIST_BONUS_PLUS_CAP = 99` (đặt ở `stat-reference.ts` kèm link nguồn).
- `assist-bonus.ts`: clamp plus trước khi nhân; `TeamCardSheet.tsx:287` hiển thị "counted +99" khi vượt.
- `TeamBuildPage.tsx:780`: text "Max all: Lv … +891 on every card …".
- Test: `max-out.test.ts` (297), `compute-stats.test.ts` thêm case card +891 (HP +2,970 flat), assist +297/stat cho bonus = assist +99/stat. `pdc-reference.test.ts` giữ nguyên (đội +297) — phải còn pass.

## 2. Part Break Bonus (awk 131) — số part phá được

**Why.** Awk 131: mỗi part phá được → ×1.2 toàn bộ chỉ số của monster có awk (✅ AppMedia 78103214, Ver.22.0). Hiện user phải bật thủ công trong modal, không thấy được tác động trên team.

**What.**
1. Control "Parts broken" (0–10) hiện ở Team settings **chỉ khi** team có ≥1 card (hoặc assist cấp awk) mang awk 131; mặc định 0 (không phải 10 như `parts131` hiện tại — mặc định 10 làm phồng HP).
2. Áp dụng tự động cho đúng các card có awk 131 (không cần bật trong manual modal). Card summary hiện chip "Part ×1.2^n".
3. Nhiều copy awk 131 trên 1 card: xem ❓Q2.
4. Trial (phần 3) dùng số part theo tầng thay cho giá trị chung này.

**How.**
- `TeamBuildConfig`: thêm `partsBroken: number` (migrate từ `awkSettings.parts131` nếu awk 131 đang bật, else 0) trong `team-draft-storage.ts`.
- `compute-stats.ts`: nhận `partsBroken` qua `ResolvedDungeonModifiers` (hoặc tham số riêng) → luôn bật 131 cho card có awk; loại 131 khỏi danh sách manual để không nhân đôi (giống cách `RAW_PASSIVE_AWAKENING_IDS`).
- Stacking theo Q2 → sửa `resolve` của 131 + test `awakening-multipliers.test.ts`.
- Export/import team (`team-import-export.ts`) mang theo `partsBroken`.

## 3. Trial theo tầng

**Why.** Một max hit duy nhất không trả lời câu hỏi thật: "ở tầng đánh đau thì HP lúc đó (sau Aging/part) có đủ không, và cần bật active nào". HP thay đổi giữa các tầng do Aging (tầng 5, 10) và Part Break (sau tầng có part).

**What.**
1. **Dữ liệu theo tầng** (import time): mỗi tầng có `index` (thứ tự 1..n), `label`, `maxHit` (+raw, monster), `partCount` (số part ở tầng đó, null nếu không có).
2. **Timeline HP (summary)**: chỉ hiện dòng ở tầng mà HP thay đổi — tầng 1, tầng bắt đầu Aging ×1.5 / ×2, tầng ngay sau tầng có part (VD: tầng 5 có 3 part phá 2 → từ tầng 6 HP = …; tầng 10 có 5 phá 5 → từ tầng 11 HP = …).
3. **Bộ chọn part theo tầng**: tầng có part hiện stepper "phá x / N" (mặc định = N hay 0: ❓Q4). Số part cộng dồn qua các tầng sau.
4. **Danh sách tầng đánh đau** (tiêu chí ❓Q3): mỗi dòng = tầng · hit lớn nhất · HP của team ở tầng đó · chọn HP-buff active + shield active **riêng cho tầng đó** · survive / margin.
5. Dungeon không có bảng tầng (chỉ `maxHit` từ catalog) → giữ giao diện hiện tại (1 hit, part chung từ phần 2), ghi rõ "No floor table".

**How.**
- `dungeon-details/lib/floor-summary.mjs` (mới): từ `floors` → `[{ index, label, maxHit, partCount }]`, dùng lại `parseDamageValues` của `max-damage.mjs`.
  - `partCount` heuristic (✅ mẫu thật trong seed): đếm dòng `【…部位…：HP…】` / `【X部位】HP:`; `【部位N箇所】`; số lớn nhất trong `【部位N(個|箇所|つ)破壊時】`; `両方` = 2; `【部位：HP…】` = 1. Không khớp → `null` + log để review tay.
  - Lưu vào seed JSON + SQLite giống `maxDamage`; script backfill (`make dungeon-floor-summary`), không cần cào lại.
- **Nhãn tầng bẩn**: 24/86 seed có label lỗi (VD `158344`: `B12 B23 B31 …` = "B1"+"2体出現" bị dính) hoặc thưa (`158352`: `B2 B4 B5 …` — AppMedia chỉ liệt kê tầng đáng chú ý). Xử lý:
  - Sửa parser `parse-dungeon-table.mjs` tách số tầng khỏi số con; backfill lại từ cache HTML nếu còn (⚠️ chưa kiểm tra cache còn đủ hay không), nếu không thì re-import 24 seed đó.
  - Tầng thưa: dùng số tầng trong label (không dùng thứ tự) để tính Aging; nếu label không đọc được → ẩn ngưỡng Aging cho dungeon đó và báo.
- Web: `web/src/lib/team-build/floor-trial.ts` (thuần, có test): input = team, floor summaries, parts broken theo tầng, lựa chọn active theo tầng → output timeline HP + kết quả từng tầng nặng. Tính HP mỗi tầng bằng cách gọi `computeTeamStats` với `agingBattle` / `partsBroken` tương ứng tầng (Aging chỉ áp dụng nếu team có awk 130).
- `TeamTrialPanel.tsx`: tách thành `TrialHpTimeline` + `TrialHeavyFloors`; state chọn active lưu theo `floorIndex` (không lưu draft — ⚠️ giả định, nói nếu muốn lưu).
- `resilience.ts` giữ nguyên công thức, gọi một lần cho mỗi tầng nặng.

## 4. Thứ tự làm & kiểm tra

1. Phần 1 (+891 + clamp assist) — nhỏ, độc lập.
2. Phần 2 (partsBroken + stacking).
3. Phần 3a: `floor-summary.mjs` + sửa parser nhãn tầng + backfill (đổi dữ liệu → **cần user review diff seed** trước khi commit).
4. Phần 3b: `floor-trial.ts` + UI.

Mỗi bước: `npm test`, `npx tsc --noEmit -p web` (6 lỗi có sẵn, không tăng), `npm run build:web`, smoke test UI theo setup trong memory (port 3101). Chưa commit — git identity hiện là gmail, DSS control sẽ fail.

## 5. Quyết định của user (2026-11-09)

- Q1 → Max all: assist giữ +297 (+99/stat); card +891.
- Q2 → copies cộng: mỗi part ×(1 + 0.2·copies), parts nhân: (1 + 0.2·copies)^parts (user xác nhận in-game, đổi từ ×1.2^copies).
- Q3 → tầng nặng = hit ≥ 50% max hit của dungeon.
- Q4 → part buff tính từ tầng sau; stepper mặc định = phá hết.
- Q5 → user xác nhận "barrel" = Aging 熟成 (130).

## 5b. Câu hỏi gốc

- **Q1** Max all cho assist: giữ +297 (+99/stat, phần vượt không cộng bonus) hay đặt +891 cho đồng bộ hiển thị? Weapon (assist-only) theo tweet chưa xác minh là không +限界突破 được.
- **Q2** Card có 2+ awk 131 (VD sync/super awk): mỗi part ×1.2^copies (code hiện tại) hay ×(1 + 0.2×copies) (đọc chữ 「所持数分加算」 của AppMedia)? Nguồn không ghi công thức.
- **Q3** "Tầng đánh đau nhất": top N tầng (N=?), hay mọi tầng có hit ≥ X% team HP, hay ≥ X% max hit của dungeon?
- **Q4** Part buff: tính từ tầng **sau** tầng phá (như ví dụ tầng 5 → 6) — còn chính tầng boss có part (hit sau khi phá) thì có cần dòng "sau khi phá" riêng không? Mặc định stepper = phá hết hay 0?
- **Q5** "barrel" = awk Aging 熟成 (130, ×1.5 từ tầng 5, ×2 từ tầng 10) — đúng ý không?
