import { fetchAwokenSkills } from "../api";
import {
  blurbFromAwokenRow,
  resolveAwokenSkillBlurb,
  type AwokenSkillBlurb,
} from "./awoken-skill-blurbs";

let pending: Promise<Map<number, AwokenSkillBlurb>> | null = null;

/** One shared request. A failed load can be retried on the next hover. */
export function loadAwokenSkillBlurbs(): Promise<Map<number, AwokenSkillBlurb>> {
  if (!pending) {
    pending = fetchAwokenSkills()
      .then((page) => {
        const byId = new Map<number, AwokenSkillBlurb>();
        for (const row of page.rows) {
          const parsed = blurbFromAwokenRow(row);
          if (!parsed) continue;
          const blurb = resolveAwokenSkillBlurb(parsed.id, parsed.blurb);
          if (blurb) byId.set(parsed.id, blurb);
        }
        return byId;
      })
      .catch((error: unknown) => {
        pending = null;
        throw error;
      });
  }
  return pending;
}
