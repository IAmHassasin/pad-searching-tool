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

Dungeon / card awakenings (Yin Yang, Aging, etc.) are separate via the dungeon awk modal and are **not** included in slot raw stats.

ATK is **not** implemented in the first version.

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

**Sync-awakening base adjustment:** when `limit_mult = 0` and the card uses `sync_awsid` (no `super_awakenings` list), multiply Lv.99 base stats by **×1.1** before level scaling (dadguide `hp_max` is pre-adjustment for these cards).

```
stat_110 = round(stat_99 × base_mult × (1 + lb% / 100))
```

### Lv.110 → Lv.120 (super limit break)

Fixed add-ons ([039日記](https://diary-039.com/entry/2021/03/25/pad_status-lv120_01)):

| Stat | Extra % |
|------|---------|
| HP   | +10% |
| ATK  | +5%  |
| RCV  | +5%  |

**Two formulas by EXP tier:**

- **≥ 1B EXP** (sequential): `stat_120 = round(stat_110 × (1 + extra/100))`
- **Other tiers** (additive on Lv.99 base): `stat_120 = round(stat_99 × (1 + lb%/100 + extra/100))`

Example Odin (12806): base HP 10521, lm10, 1B exp → 110: 12625 (+20%), 120: 13888 (+10% on 110), +99 HP → **14878**.

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

Assist must be max level; if assist has **+297** on a stat, the flat + bonus is included in the assist stat used for the calculation.

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
