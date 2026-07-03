import type { LatentId, TeamMemberConfig } from "./types";
import { LATENT_STAT_PCT } from "./stat-reference";

export function sumLatentPct(
  latents: TeamMemberConfig["latents"],
  stat: "hp" | "rcv"
): number {
  let sum = 0;
  for (const [id, count] of Object.entries(latents ?? {})) {
    const def = LATENT_STAT_PCT[id as LatentId];
    if (!def || !count) continue;
    sum += (stat === "hp" ? def.hp : def.rcv) * count;
  }
  return sum;
}

export function applyLatentMultiplier(value: number, pctSum: number): number {
  if (pctSum <= 0) return value;
  return Math.round(value * (1 + pctSum / 100));
}
