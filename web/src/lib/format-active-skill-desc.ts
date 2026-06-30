const RANDOM_SKILL_HEADER = "Activate a random skill from the list";
const EVO_SKILL_HEADER_PREFIX = "After each skill, evolve to the next";

const CHANGE_TO_MONSTER_RE = /change to \[(\d+)\]/gi;

/** Monster ids from "Change to [13326] …" active skill lines. */
export function parseChangeToMonsterIds(text: string): number[] {
  const ids: number[] = [];
  CHANGE_TO_MONSTER_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CHANGE_TO_MONSTER_RE.exec(text)) !== null) {
    ids.push(Number.parseInt(match[1], 10));
  }
  return [...new Set(ids)];
}

/** Bracketed delayed-effect markers, e.g. [1 turn after activation]. */
export const AFTER_ACTIVATION_SPLIT_RE = /(\[\d+ turns? after activation\])/g;

export function isAfterActivationMarker(segment: string): boolean {
  return /^\[\d+ turns? after activation\]$/.test(segment);
}

const STAGE_MARKER_RE = /(?:^|[\s,])(?:and\s+)?(\d+)\)\s*/g;

type ParsedStage = { num: number; body: string };
type ParsedStagedSkill = { header: string; stages: ParsedStage[] };

function splitSkillClauses(text: string): string[] {
  const trimmed = text.trim().replace(/,\s*$/, "");
  if (!trimmed) return [];
  const parts = trimmed.split(/;\s+/);
  return parts.map((part, i) => {
    const clause = part.trim();
    return i < parts.length - 1 ? `${clause};` : clause;
  });
}

function joinSkillClauses(clauses: string[]): string {
  return clauses.filter(Boolean).join(" ");
}

function commonLeadingClauses(stageBodies: string[]): string[] {
  if (stageBodies.length < 2) return [];
  const split = stageBodies.map(splitSkillClauses);
  const minLen = Math.min(...split.map((clauses) => clauses.length));
  const common: string[] = [];
  for (let i = 0; i < minLen; i++) {
    const clause = split[0][i];
    if (split.every((clauses) => clauses[i] === clause)) {
      common.push(clause);
    } else {
      break;
    }
  }
  return common;
}

function stripLeadingClauses(body: string, count: number): string {
  if (count <= 0) return body.trim();
  return joinSkillClauses(splitSkillClauses(body).slice(count));
}

export function parseStagedActiveSkill(text: string): ParsedStagedSkill | null {
  const markers: { index: number; end: number; num: number }[] = [];
  STAGE_MARKER_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = STAGE_MARKER_RE.exec(text)) !== null) {
    markers.push({
      index: match.index,
      end: match.index + match[0].length,
      num: Number.parseInt(match[1], 10),
    });
  }
  if (markers.length < 2) return null;

  const header = text.slice(0, markers[0].index).replace(/:\s*$/, "").trim();
  const stages = markers.map((marker, i) => {
    const bodyEnd = i + 1 < markers.length ? markers[i + 1].index : text.length;
    const body = text.slice(marker.end, bodyEnd).trim().replace(/,\s*$/, "");
    return { num: marker.num, body };
  });

  return { header, stages };
}

function isRandomStagedSkill(header: string): boolean {
  return header.startsWith(RANDOM_SKILL_HEADER);
}

function isEvoStagedSkill(header: string): boolean {
  return header.startsWith(EVO_SKILL_HEADER_PREFIX);
}

/** Pretty-print multi-stage active skills (evo loop, random list). */
export function formatActiveSkillDesc(raw: string): string {
  const text = raw.trim();
  if (!text) return text;

  const parsed = parseStagedActiveSkill(text);
  if (!parsed) return text;

  const { header, stages } = parsed;
  if (!isRandomStagedSkill(header) && !isEvoStagedSkill(header)) {
    return text;
  }

  let commonPrefix = "";
  let displayStages = stages;

  if (isRandomStagedSkill(header)) {
    const shared = commonLeadingClauses(stages.map((s) => s.body));
    if (shared.length > 0) {
      commonPrefix = joinSkillClauses(shared);
      displayStages = stages.map((stage) => ({
        ...stage,
        body: stripLeadingClauses(stage.body, shared.length),
      }));
    }
  }

  const lines: string[] = [];
  if (commonPrefix) {
    lines.push(commonPrefix, "");
  }
  lines.push(`${header}:`);
  for (const stage of displayStages) {
    lines.push(`${stage.num}) ${stage.body}`);
  }
  return lines.join("\n");
}
