/**
 * Decide whether a screenshot shows a card the catalog already knows. Two signals: the card
 * number read from the header (our DB has `monster_no_jp == monster_id` for every row) and the
 * thumbnail icon compared with the CDN icon descriptors of the icon index.
 */
import {
  ALL_CELLS,
  cardDescriptor,
  correlation,
  grayThumbnail,
  type Box,
  type RgbaImage,
} from "../team-build/screenshot/descriptor.ts";
import {
  descriptorForId,
  rankIconCandidates,
  type IconCandidate,
  type IconIndex,
} from "../team-build/screenshot/icon-index.ts";

/** Thumbnail vs the icon of the number read from the header. */
export const KNOWN_BY_NUMBER_MIN_SCORE = 0.85;
/** Thumbnail vs the best icon in the whole index when the number is unknown or not indexed. */
export const KNOWN_BY_ICON_MIN_SCORE = 0.92;
export const IDENTIFY_CANDIDATES = 5;

export type Identification = {
  kind: "known" | "new";
  /** The catalog id when `kind` is "known". */
  id: number | null;
  /** Correlation of the thumbnail with the icon of `id` (or of the best candidate). */
  iconScore: number;
  /** Correlation with the icon of the header number, when that number is indexed. */
  numberScore: number | null;
  candidates: IconCandidate[];
  /** Human-readable reasons for review ("number not in catalog", "icon differs from number"). */
  flags: string[];
};

/** Best thumbnail descriptor over small offsets and scales of `box`, scored against `target`. */
export function alignedThumbScore(
  img: RgbaImage,
  box: Box,
  target: ArrayLike<number>,
  search = { step: 3, range: 6, scales: [0.96, 1, 1.04] }
): { score: number; descriptor: Uint8Array; box: Box } {
  let best: { score: number; descriptor: Uint8Array; box: Box } = {
    score: -1,
    descriptor: new Uint8Array(0),
    box,
  };
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  for (const scale of search.scales) {
    const w = box.w * scale;
    const h = box.h * scale;
    for (let dy = -search.range; dy <= search.range; dy += search.step) {
      for (let dx = -search.range; dx <= search.range; dx += search.step) {
        const candidate: Box = { x: cx - w / 2 + dx, y: cy - h / 2 + dy, w, h };
        const descriptor = cardDescriptor(grayThumbnail(img, candidate));
        const score = correlation(descriptor, target, descriptor.length);
        if (score > best.score) best = { score, descriptor, box: candidate };
      }
    }
  }
  return best;
}

export function identifyCard(
  img: RgbaImage,
  thumb: Box,
  index: IconIndex,
  number: number | null
): Identification {
  const flags: string[] = [];
  const base = cardDescriptor(grayThumbnail(img, thumb));
  const candidates = rankIconCandidates(index, base, IDENTIFY_CANDIDATES, ALL_CELLS);

  let numberScore: number | null = null;
  if (number != null) {
    const target = descriptorForId(index, number);
    if (target) {
      numberScore = alignedThumbScore(img, thumb, target).score;
      if (numberScore >= KNOWN_BY_NUMBER_MIN_SCORE) {
        return { kind: "known", id: number, iconScore: numberScore, numberScore, candidates, flags };
      }
      flags.push("icon differs from the icon of the card number");
    } else {
      flags.push("card number is not in the catalog");
    }
  } else {
    flags.push("card number could not be read");
  }

  const top = candidates[0];
  const topDescriptor = top ? descriptorForId(index, top.id) : null;
  if (top && topDescriptor) {
    const aligned = alignedThumbScore(img, thumb, topDescriptor);
    if (aligned.score >= KNOWN_BY_ICON_MIN_SCORE) {
      if (number != null && number !== top.id) flags.push(`icon matches No.${top.id}, header says No.${number}`);
      return { kind: "known", id: top.id, iconScore: aligned.score, numberScore, candidates, flags };
    }
    return { kind: "new", id: null, iconScore: aligned.score, numberScore, candidates, flags };
  }
  return { kind: "new", id: null, iconScore: 0, numberScore, candidates, flags };
}
