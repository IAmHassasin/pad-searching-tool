/**
 * Name search also matches the group title shown on the collab panel.
 * That title is one series per `group_id` (collab first, then priority), not
 * every series tag on a member — a shared exchange group must not swallow a
 * collab search. Membership in the result is the same roster as the panel:
 * base card of each line, no redeemable mats, no post-transform forms.
 */

export const GROUP_NAME_MATCH_TABLES = [
  "monsters",
  "series",
  "monster_series",
  "transformations",
] as const;

/** dadguide `d_types.type_id` — Redeemable Mats. Same exclusion as the collab panel. */
const REDEEMABLE_MAT_TYPE_ID = 15;

const LIKE_ESCAPE = `ESCAPE '\\'`;

/** Case-insensitive substring pattern; `%`, `_`, and `\` in the query stay literal. */
export function escapeLikeContains(raw: string): string {
  return `%${raw.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

export type NameSearchMatchSql = {
  /** Empty when group tables are not used. */
  joinSql: string;
  whereSql: string;
  /** Select list without a leading comma. Empty when unused. */
  selectSql: string;
  /** True when `joinSql` binds the LIKE pattern before the WHERE placeholders. */
  joinConsumesPattern: boolean;
  /** True when `whereSql` binds a min-id placeholder on the name/ID branch only. */
  textMatchConsumesMinId: boolean;
};

/**
 * `quote` must return a SQL identifier. Callers pass a validator, never raw input.
 * The SQL aliases the source row as `_src`.
 */
export function buildNameSearchMatchSql(
  quote: (column: string) => string,
  groupNameMatch: boolean,
  /** Keep the #5000 floor on name/ID hits, but not on a matched group's roster. */
  floorTextMatches = false
): NameSearchMatchSql {
  const id = `_src.${quote("monster_id")}`;
  const pk = `_src.__source_pk`;
  const na = `_src.${quote("monster_no_na")}`;
  const name = `_src.${quote("name_en")}`;
  const groupId = `_src.${quote("group_id")}`;
  const text = [
    `CAST(COALESCE(${id}, ${pk}, '') AS TEXT) LIKE ? ${LIKE_ESCAPE}`,
    `CAST(COALESCE(${na}, '') AS TEXT) LIKE ? ${LIKE_ESCAPE}`,
    `LOWER(COALESCE(${name}, '')) LIKE LOWER(?) ${LIKE_ESCAPE}`,
  ].join(" OR ");

  if (!groupNameMatch) {
    return {
      joinSql: "",
      whereSql: `(${text})`,
      selectSql: "",
      joinConsumesPattern: false,
      textMatchConsumesMinId: false,
    };
  }

  const textMatch = floorTextMatches
    ? `((${text}) AND CAST(COALESCE(${id}, ${pk}) AS INTEGER) >= ?)`
    : `(${text})`;

  const monsterKey = `CAST(COALESCE(${id}, ${pk}) AS INTEGER)`;
  const roster = `EXISTS (
    SELECT 1 FROM monsters _roster
    WHERE _roster.monster_id = ${monsterKey}
      AND _roster.group_id = _grp.group_id
      AND _roster.monster_id = _roster.base_id
      AND _roster.type_1_id != ${REDEEMABLE_MAT_TYPE_ID}
      AND (_roster.type_2_id IS NULL OR _roster.type_2_id != ${REDEEMABLE_MAT_TYPE_ID})
      AND (_roster.type_3_id IS NULL OR _roster.type_3_id != ${REDEEMABLE_MAT_TYPE_ID})
      AND _roster.monster_id NOT IN (SELECT to_monster_id FROM transformations)
  )`;
  const joinSql = `LEFT JOIN (
    SELECT group_id, matched_group_name, matched_group_kind
    FROM (
      SELECT
        mm.group_id AS group_id,
        s.name_en AS matched_group_name,
        CASE
          WHEN s.series_type IN ('collab', 'ghcollab') THEN 'collab'
          ELSE 'group'
        END AS matched_group_kind,
        ROW_NUMBER() OVER (
          PARTITION BY mm.group_id
          ORDER BY CASE WHEN s.series_type = 'collab' THEN 0 ELSE 1 END,
                   ms.priority,
                   s.series_id
        ) AS rn
      FROM monsters mm
      INNER JOIN monster_series ms ON ms.monster_id = mm.monster_id
      INNER JOIN series s ON s.series_id = ms.series_id
      WHERE mm.group_id IS NOT NULL
        AND mm.group_id != 0
        AND TRIM(COALESCE(s.name_en, '')) != ''
    )
    WHERE rn = 1
      AND LOWER(matched_group_name) LIKE LOWER(?) ${LIKE_ESCAPE}
  ) AS _grp ON _grp.group_id = ${groupId}`;

  return {
    joinSql,
    whereSql: `(${textMatch} OR (_grp.group_id IS NOT NULL AND ${roster}))`,
    selectSql: "_grp.matched_group_name, _grp.matched_group_kind",
    joinConsumesPattern: true,
    textMatchConsumesMinId: floorTextMatches,
  };
}
