# Team build — stat modifiers reference

Base monster stats in this tool (`hp_max`, `rcv_max` on `monsters`) are **level 99** values (before +points, before dungeon awakening buffs).

Team build applies modifiers in this order (per member, then leader skills on top):

1. **Level scaling** (99 → 110 → 120)
2. **+ points** (flat)
3. **Super awakening** (user-selected SA / sync awk; stat mult when applicable)
4. **Latent awakenings** (% on HP / RCV)
5. **Assist equipment bonus** (% of eq base stats; same-attribute rule)
6. **Team badge** (% on whole team HP / RCV)
7. **Leader skills** (both leaders; conditional × on matching members)

Dungeon / card awakenings (Yin Yang, Aging, etc.) come from the selected dungeon (section 9) plus the "Advanced awakenings" modal and are **not** included in slot raw stats. Flat Enhanced HP / Attack / Recovery awakenings (section 8) **are** part of raw stats.

ATK totals apply the ATK badges, the team awakenings and the dungeon multipliers; leader-skill ATK is still not parsed.

---

## 1. Level scaling (110 / 120)

| Source | Notes |
|--------|--------|
| DB columns | `monsters.limit_mult`, `monsters.exp` (dadguide; **not** `limit_multi`) |
| `limit_mult = 0` | Cannot level-limit-break; max level 99 |
| `is_transform_form = 1` | Post-transform dungeon form (`transformations.to_monster_id`); max level 99 even if `limit_mult` &gt; 0 |
| `limit_mult > 0` | Can reach 110; **not** the LB % directly — derive LB % from `limit_mult` + `exp` tier |

### Lv.99 → Lv.110

Primary rule (dadguide/Miru): at Lv.110, `stat × (1 + lb%/100)` where `lb%` derives from `limit_mult`:

| EXP tier | LB % formula |
|----------|----------------|
| ≥ 1B | `limit_mult × 2` (e.g. Odin lm10 → +20%) |
| ≥ 50M | `limit_mult × 0.6` (e.g. Parvati lm25 → +15%) |
| ≥ 5M and lm ≥ 50 | `limit_mult ÷ 3.52` (e.g. Vigo lm88 → +25%) |
| cost = limit_mult | `limit_mult` directly |
| 4M exp, cost &lt; limit_mult | `limit_mult + cost − 11` (e.g. Kagura lm30 cost25 → +44%) |
| 4M exp, cost &gt; limit_mult, gap &lt; 15 | `limit_mult` (e.g. Hathor lm30 cost35 → +30%) |
| 4M exp, cost ≥ 50 | `limit_mult + 14` (e.g. Gintama lm30 cost50 → +44%) |
| 4M exp, cost &gt; limit_mult, cost &lt; 50, hp_max ≥ 7200 | `cost − 10` (e.g. Serie cost45 → +35%) |
| 4M exp, other cost &gt; limit_mult | `limit_mult + 14` (e.g. Frieren lm30 cost45 → +44%) |
| else | `limit_mult` directly |

**Skill Voice base adjustment (replaces the old "sync ×1.1" rule, 2026-11-04):** cards with awakening 63 Skill Voice multiply the Lv.99 base by **×1.1** before level scaling and +points; dadguide stores the base without it. In-game check: 7943 Lv99 +297 = round(4586 × 1.1) + 990 = 6035 HP, 3512 ATK, 936 RCV.

```
stat_110 = round(stat_99 × voice_mult × (1 + lb% / 100))
```

For ≥ 1B-exp cards the LB % is `limit_mult` itself (altema: Odin 12806 lm10 Lv110 = ×1.1; PDC Zelclea 13483 lm10), not `limit_mult × 2`.

### Lv.110 → Lv.120 (super limit break)

Fixed add-ons ([039日記](https://diary-039.com/entry/2021/03/25/pad_status-lv120_01)):

| Stat | Extra % |
|------|---------|
| HP   | +10% |
| ATK  | +5%  |
| RCV  | +5%  |

**One formula (additive on the Lv.99 base, verified 2026-11-04):**

- `stat_120 = ceil(stat_99 × voice_mult × (1 + lb%/100 + extra/100))` (4M-exp cards with cost > limit_mult round instead of ceil)
- 命天龍・ゼルクレア 11210 (lm30, 5M exp): Lv110 10561 = 8124 × 1.3, Lv120 11374 = 8124 × 1.4 (kamigame).
- 試練ゼルクレア 13483 (lm10, 1B exp, Skill Voice): Lv120 = 8562 × 1.1 × 1.2 = 11,302 (+990 → PDC 12,291 ±1).
- The earlier Odin example (+20 % / sequential) was not from in-game data and is withdrawn.

### DB check

```sql
SELECT limit_mult, COUNT(*) FROM monsters GROUP BY limit_mult;
-- latent_slots also on monsters (6 or 8 typical)
```

---

## 2. + points (プラス)

Source: [GameWith +ポイント](https://xn--0ck4aw2h.gamewith.jp/article/show/108048), [プラス限界突破](https://xn--0ck4aw2h.gamewith.jp/article/show/503140)

| Stat | Per +1 | Max (normal) | Max (+ limit break) |
|------|--------|--------------|---------------------|
| HP   | +10    | +99 (+990)   | +297 (+2970)        |
| ATK  | +5     | +99 (+495)   | +297 (+1485)        |
| RCV  | +3     | +99 (+297)   | +297 (+891)         |

+ limit break: after +297 on all three stats, use +999 currency to unlock +297 cap per stat; bonus +1 to each stat on unlock.

**Team build:** user enters +HP / +RCV counts per slot. Flat add after level scaling:

```
hp += plusHp × 10
rcv += plusRcv × 3
```

Assist +297 on equipment counts toward assist bonus (see below).

---

## 3. Dungeon / card awakenings

Handled by existing `web/src/lib/awakening-stat-modifier.ts` (shared with search results).

| Mechanism | Examples | HP / RCV effect |
|-----------|----------|-----------------|
| Yin / Yang Protection (128 / 129) | Dungeon buff | ×2 HP, ×2 RCV |
| Self-Reliance / Assist Resonate (138 / 139) | Type-wide | ×3 all stats |
| Aging (130) | Floor 5 / 10 | ×1.5 or ×2 all |
| Type multiplier awks (30, 127, 142, …) | Dungeon type buff | various |
| Super awakening | Best SA only | various |

Team-level `AwkModifierSettings` apply per monster if the card has that awakening.

---

## 4. Latent awakenings

Source: [GameWith 潜在覚醒](https://xn--0ck4aw2h.gamewith.jp/article/show/38230)

Slots: `monsters.latent_slots` (6 default; 8 for reincarnation / 極醒 / some collab). Slot costs: 1 / 2 / 6 per latent.

### Stat latents (stack additively on %)

| Latent | Slots | HP | ATK | RCV |
|--------|-------|-----|-----|-----|
| HP Enhancement | 1 | +1.5% | — | — |
| RCV Enhancement | 1 | — | — | +10% |
| All-Parameter Enhancement | 2 | +3% | +2% | +20% |
| HP Enhancement+ | 2 | +4.5% | — | — |
| RCV Enhancement+ | 2 | — | — | +30% |
| HP Enhancement++ | 2 | +10% | — | — |
| RCV Enhancement++ | 2 | — | — | +35% |

Requires level-120 (super LB) for ++ latents.

```
mult_hp  = 1 + sum(hp% latent) / 100
mult_rcv = 1 + sum(rcv% latent) / 100
stat *= mult
```

---

## 5. Assist equipment bonus

Source: [GameWith アシスト](https://xn--0ck4aw2h.gamewith.jp/article/show/24527)

When base and assist share **main attribute** (or either has no main attribute), base gains:

| Stat | % of assist's stat |
|------|---------------------|
| HP   | +10% |
| ATK  | +5%  |
| RCV  | +15% |

Assist is always taken at **its own max level** (99, or 110/120 when the equipment can limit break — independent of the base card's level); if assist has **+297** on a stat, the flat + bonus is included in the assist stat used for the calculation (the app defaults assists to +297).

```
bonus_hp  = round(assist_hp_at_level × 0.10)
bonus_rcv = round(assist_rcv_at_level × 0.15)
```

Equipment latent awakenings do **not** transfer.

---

## 6. Team badge

Source: [GameWith 覚醒バッジ](https://xn--0ck4aw2h.gamewith.jp/article/show/31941)

One badge per **party** (not per monster). Applied after per-monster steps.

### Team-wide HP / RCV (implemented first)

| Badge | HP team | RCV team |
|-------|---------|----------|
| HP +10% | +10% | — |
| HP +15% | +15% | — |
| RCV +50% | — | +50% |
| RCV +70% | — | +70% |
| Skill Boost++ / Status Resist++ | +50% all | +50% all |
| 2-/3-/5-color atk enhance badges | +5% HP & RCV | +5% |

### Conditional (later)

- Collab / event badges: +15% or +30% HP & RCV for matching `collab_id`
- Type badges: +5% HP & RCV for matching type (+ ATK ×5, not in v1)

---

## 7. Leader skills

Both leaders' skills apply to **each team member** (including leaders) when conditions match. Multipliers **multiply** across both leaders.

Parsed from `leader_skill_desc_en` when possible; manual override supported.

| Pattern (EN) | Effect |
|--------------|--------|
| `Nx all stats for {Type} type` | HP×N, RCV×N |
| `Nx HP for {Type} type` | HP×N |
| `Nx HP & RCV for {Att} Att` | HP×N, RCV×N |
| `Nx HP & RCV for {Type} type` | HP×N, RCV×N |

Types: God, Dragon, Devil, Machine, Balance, Attacker, Physical, Healer.  
Attributes: Fire, Water, Wood, Light, Dark.

Example: Leader1 `2.7× all stats Devil` + Leader2 `5.5× HP Devil` on a Devil sub → HP ×2.7×5.5, RCV ×2.7.

---

## Implementation map

| File | Role |
|------|------|
| `web/src/lib/team-build/stat-reference.ts` | Constants (latent, plus, badge, level-120) |
| `web/src/lib/team-build/level-scaling.ts` | `limit_mult` + level target |
| `web/src/lib/team-build/latent-modifiers.ts` | Latent % sums |
| `web/src/lib/team-build/assist-bonus.ts` | Eq bonus |
| `web/src/lib/team-build/badge-modifiers.ts` | Team badge |
| `web/src/lib/team-build/leader-skill.ts` | LS parse + apply |
| `web/src/lib/team-build/compute-stats.ts` | Pipeline + team totals |
| `web/src/team-build/TeamBuildPage.tsx` | UI (ID entry MVP) |

---

## References

- [潜在覚醒](https://xn--0ck4aw2h.gamewith.jp/article/show/38230)
- [プラス限界突破](https://xn--0ck4aw2h.gamewith.jp/article/show/503140)
- [+ポイント](https://xn--0ck4aw2h.gamewith.jp/article/show/108048)
- [アシスト](https://xn--0ck4aw2h.gamewith.jp/article/show/24527)
- [覚醒バッジ](https://xn--0ck4aw2h.gamewith.jp/article/show/31941)
- [Lv.120 上昇率](https://diary-039.com/entry/2021/03/25/pad_status-lv120_01)
- [レベル超限界突破](https://xn--0ck4aw2h.gamewith.jp/article/show/257095)

---

## 8. Damage pipeline + awakening table

Shared module: `web/src/lib/damage/`.

| File | Role |
|------|------|
| `awakening-multipliers.ts` | `AWAKENING_MULTIPLIERS` — one typed entry per awoken id (kind, HP/ATK/RCV, per-unit increment, condition, source). `awakening-stat-modifier.ts` reads its stat values from here, so search sort and team build share the same numbers. |
| `damage-calc.ts` | `computeMatchDamage` / `computeCardDamage` — the v20.4 pipeline below, with `DAMAGE_CAP` / `DAMAGE_CAP_EXPANDED`. |

### Sources (newest wins on conflict)

1. GungHo patch notes Ver.21.6 → 23.6 (2024-08 … 2026-10) as cross-checked on GameWith (15917), AppMedia and Kamigame on 2026-11-04 (`source: "gungho patch notes 2024-2026"`).
2. `seed/dadguide.sqlite` `awoken_skills.desc_en` (DB snapshot 2026-10; `awoken_skills` row timestamp 2026-09-24).
3. padsujiko 火力覚醒まとめ, 2024-09-29 — https://x.com/padsujiko/status/1840427736885813462
4. feth damage sheet v20.4, 2023-01-21 — https://i.imgur.com/8USAru3.png

### Pipeline (per card, per attribute slot)

1. **Per match** `D = ATK × (1 + 0.25 × (orbs − 3)) × OE × shape × sub × misc`
   - `OE` = `(1 + 0.06 × enhanced orbs) × (1 + 0.07 × Enhanced Orbs on team [+0.14 per Enhanced Orbs+])`
   - `shape` = TPA ×2.2 / ×4.84 (exactly 4 orbs), VDP ×3.5 / ×12.25 (3×3), L ×2.2 / ×4.84, cross ×3 / ×9, T ×8, column ×7 — each `^count` on the card
   - `sub` = ×1/3 (sub attribute differs from main) or ×0.1 (same)
   - `misc` = active-skill multiplier × debuffs
2. **Sub-total** `T = ΣD × row × combo boost × blob × colour × attribute combo × HP side × L-heal × blessings × (1 + 0.25 × (combos − 1)) × LS`, then **cap**
   - row: `1 + 0.9 × Enhanced Att. on team × rows matched` (Ver.23.6: 30% → 90%, Triple Rows 116–120 retired and converted to one Enhanced Att.)
   - combo boost: 43 ×2 (7c) / ×3 (14c, Ver.22.8); 107 ×4 / ×9; 61 ×5 (10c); 111 ×25; 144 ×100 (15c)
   - colour: 79 ×3.5 (3+), 80 ×4.5 (4+), 81 ×5 (5); 112 ×12.25, 113 ×20.25, 114 ×25 (Ver.23.0 / 23.3.2); 44 Guard Break ×3 (5, ignores DEF); 141 ×50 (4+, ≤5 s)
   - attribute combo enhance: `1 + (0.3 × Combo Enhance + 0.6 × Combo Enhance+ on team) × (matches − 1)` when ≥2 matches
   - HP side 57 / 58 ×10 (Ver.23.4); L-heal 59 ×3; blessings 71 / 72 ×10 (Ver.23.4); blob 82 ×12; super bonus attack 50 ×8 (+10,000,000 fixed); bonus attack 45 fixed 500,000; Levitation 106 ×20 (super gravity); Acceleration 143 ×30…×150 by floor
3. **Actual** `((T × killer × attr) − DEF) × passive`, then **cap**
   - killer ×5 per matched type killer (31–38), ×3 per matched material killer (39–42), ×2 per matched killer latent
   - attr ×2 weakness / ×0.5 resisted; DEF floor = 1 damage; passive = enemy type/attribute resists (×0.5), active shields

Caps: `2^31 − 1 = 2,147,483,647` per attribute. Cap multipliers never stack — the highest applicable one wins: matched type killer ×2 (`4,294,967,294`, Ver.21.7), material killer ×1.2, latent cap release ×5 / ×10 and skill caps (pass `enemy.capMultiplier`). Truncation happens at every step before the next one.

### Stat awakenings used by the team page

| Awakening | Effect | Where applied |
|-----------|--------|---------------|
| 1 / 2 / 3 Enhanced HP / Attack / Recovery | +3000 HP / +1000 ATK / +500 RCV per copy (Ver.23.0 / 23.5) | per member, flat, after +points (`afterFlatAwk`) |
| 46 / 47 Enhanced Team HP / Recovery | team HP +5% / team RCV +20% per copy on the team | whole team, with the badge |
| 128 / 129 Yang / Yin Protection | HP ×2, RCV ×2, ATK ×5 on Sun / Moon floors (Ver.22.6: HP/RCV 1.2 → 2) | dungeon awakenings |
| 127 / 142 / 132 / 145–147 | always-on stat multipliers | raw stats (`passive-awakenings.ts`), regular + sync slots; as super awakening only when selected. 63 Skill Voice is **not** counted (PDC team screen ignores it) |
| 138 Assist Resonance | ×3 when base and assist share the main attribute and at least one type | raw stats, condition checked from the slot's assist |
| 139 Self-Reliance | ×3 when the slot has no assist | raw stats |
| 30 Multi Boost, 130 Aging | multiplayer / floor conditional | dungeon / manual awakenings (passive ids above are ignored there to avoid double counting) |

### Conflicts between sources

| Awakening | Used (patch notes 2024-2026) | DB text (2026-10) | Tweet (2024-09) |
|-----------|------------------------------|-------------------|-----------------|
| 43 Enhanced Combos at 14+ combos | ×3 | ×3 | ×2.5 |
| 107 Enhanced Combos+ at 14+ combos | ×9 | ×9 | ×6.25 |
| 128 / 129 Yang / Yin Protection HP & RCV | ×2 (ATK ×5) | ×2 | ×1.2 |
| 57 / 58 HP ≥ / ≤ 50% | ×10 (Ver.23.4) | ×2.5 | ×2.5 |
| 71 / 72 Blessings | ×10 (Ver.23.4) | ×2 | ×2 |
| 79 / 112 three colours | ×3.5 / ×12.25 (Ver.23.3.2) | ×2.5 / ×6.25 | ×2.5 / ×6.25 |
| 80 / 113 four colours | ×4.5 / ×20.25 (Ver.23.3.2) | ×4 / ×16 | ×4 / ×16 |
| 22–26 row enhance | +90% (Ver.23.6) | +30% | +30% |
| 45 Bonus Attack fixed damage | 500,000 | — | — |

Values changed in code vs the previous version: 57 / 58 ×2 → ×10, 71 ×2 → ×10, 72 added (×10), 79 / 80 / 112 / 113 raised, rows 0.3 → 0.9, material killers ×3, flat awakenings 1 / 2 / 3 and team awakenings 46 / 47 now counted.

### Pipeline order verified against PDC (2026-11-04)

Reference: PDC (パズドラダメージ計算) team 13509 / 13514 / 12905 / 13483 / 13422 in 天空の儚域／風雲の龍王 — regression test `web/src/lib/team-build/pdc-reference.test.ts`.

```
raw   = ((level-scaled base + plus + flat awakenings 1/2/3) + assist bonus) × passive awakenings × selected super awakening
slot  = raw × dungeon / manual awakenings (per copy, sync = one more copy) × leader skill
        × dungeon stat multipliers × conditional boosts × Levitation (×20 when the card has 106 and the dungeon is super gravity)   ← PDC ステ
total = Σ slot × badge × (1 + 5 % × Enhanced Team HP copies) [RCV: 20 % × Enhanced Team RCV copies]                                 ← PDC PT情報
Awakenings of an assist with Awoken Assist (49) count for the base card: flat 1/2/3, team 46/47 and unconditional passives.
```

- Assist bonus (HP 10 % / ATK 5 % / RCV 15 % of the assist incl. its +points) is added **before** every multiplier, so Assist Resonance ×3 scales it too (Shizuru: (9470 + 787) × 3 = 30,771).
- Copies multiply: Zelclea with Yang Protection as regular + sync awakening = HP ×4, ATK ×25, RCV ×4.
- The sync awakening is never counted twice (passive slot vs selected super awakening).
- Lv.110 LB% for 4M-exp cards: `cost − limit_mult < 15` → `limit_mult` (Mina & Soshiro lm30 cost40 → +30 %, with Skill Voice ×1.1 on top).
- Skill Voice ×1.1 on the base (Denken 13422: (9252 × 1.1 + 990) × 1.8 = 20,101; Shizuru 13509 has no Skill Voice → 8480 + 990). Confirmed in-game with 7943 (6035 / 3512 / 936 at Lv99 +297).
- Super gravity and Levitation are applied in one rounding step (×1/500 then ×20 must not truncate).
- PDC's PT情報 HP 391,390 = Σ ステ 194,479 × 1.75 × 1.15: the five assists carry 15 Enhanced Team HP (46) awakenings granted through Awoken Assist (+75 %), and the HP +15 % badge was set. RCV total 1,271 = Σ ステ (no team RCV awakenings). Shizuru's leader skill has no HP clause.

## 9. Dungeon list (replaces the "Dungeon awk" button)

- Catalog: `web/src/lib/team-build/dungeon-catalog.json` (191 entries, built 2026-11-04 from GameWith / AppMedia / Kamigame / Altema / official GungHo pages; each entry keeps its `sourceUrl` and a `notes` field with the confirmation status). Types / helpers: `dungeon-catalog-types.ts`, `dungeon-catalog.ts`.
- Entry fields: `sun` / `moon` (activate 128 / 129), `multiplayer` (30), `maxFloor` (Aging 130 B5 / B10), `stat` (team-wide HP / ATK / RCV multipliers — super gravity `攻撃力N分の1` → `atk = 1/N`, super altitude `回復力N分の1` → `rcv = 1/N`, `回復なし` → `rcv = 0`), `conditional` (type / attribute limited boosts such as 回復タイプ強化 = healer HP ×1.5, 深緑 = wood ATK & RCV ×2).
- `resolveDungeonModifiers(config, entries)` (`dungeon-modifiers.ts`) merges the dungeon awakenings into the user's manual awk selection; `computeTeamStats(config, monstersById, dungeon)` applies the stat multipliers after badge and leader skills (`afterDungeon`) and the conditional boosts per member.
- "Custom" entry: user-entered HP / ATK / RCV multipliers plus Sun / Moon toggles. "Advanced awakenings" in the picker opens the old manual awk modal.
- Unverified entries (single source, GameWith / Altema sun-moon lists) are kept with `notes: "unverified: …"`; the in-game banner stays authoritative.

## 10. Badges (updated 2026-11-04)

Team-wide: HP +10 / +15 %, RCV +50 / +70 %, ATK +10 / +15 %, Skill Boost++ / Status Resist (all stats +50 %), shape / colour attack badges (HP & RCV +5 %), type badges (type ATK ×5 + team HP & RCV +5 %, Ver.22.0), collab / event badge (ATK +50 %, HP & RCV +15 %), collab / event+ (ATK ×2.5, HP & RCV +30 %), idol (ATK ×3, HP & RCV +30 %). Collab / idol badges apply to matching monsters in-game; the calculator applies them to every slot.
