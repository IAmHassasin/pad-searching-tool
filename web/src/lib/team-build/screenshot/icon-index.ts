/**
 * Binary icon index: one card descriptor per monster icon, built offline by
 * `scripts/build-icon-index.ts` and fetched lazily by the browser.
 *
 * Layout (little endian):
 *   0  "PSTI"            4 bytes magic
 *   4  version           u8
 *   5  size              u8   thumbnail edge (DESCRIPTOR_SIZE)
 *   6  rows              u8   rows kept per descriptor (CARD_ROWS)
 *   7  reserved          u8
 *   8  count             u32
 *   12 ids               u32 × count, ascending
 *   …  descriptors       u8 × count × (size × rows)
 */
import { ALL_CELLS, CARD_ROWS, DESCRIPTOR_SIZE, type CellMask } from "./descriptor.ts";

const MAGIC = "PSTI";
const HEADER_BYTES = 12;
export const ICON_INDEX_VERSION = 1;

export type IconIndexEntry = { id: number; descriptor: ArrayLike<number> };

export type IconIndex = {
  size: number;
  rows: number;
  /** Bytes per descriptor (= size × rows). */
  length: number;
  count: number;
  ids: Uint32Array;
  descriptors: Uint8Array;
  /** Per-entry mean and centred L2 norm over every cell, precomputed for fast correlation. */
  means: Float32Array;
  norms: Float32Array;
};

type CellStats = { means: Float32Array; norms: Float32Array };

/** Per-mask statistics of each index, computed on first use (a mask is a few thousand cells). */
const cellStatsCache = new WeakMap<IconIndex, WeakMap<CellMask, CellStats>>();

function computeCellStats(index: IconIndex, cells: CellMask): CellStats {
  const { descriptors, count, length } = index;
  const n = cells.length;
  const means = new Float32Array(count);
  const norms = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const off = i * length;
    let sum = 0;
    for (let k = 0; k < n; k++) sum += descriptors[off + cells[k]];
    const mean = n > 0 ? sum / n : 0;
    let sq = 0;
    for (let k = 0; k < n; k++) {
      const d = descriptors[off + cells[k]] - mean;
      sq += d * d;
    }
    means[i] = mean;
    norms[i] = Math.sqrt(sq);
  }
  return { means, norms };
}

function cellStats(index: IconIndex, cells: CellMask): CellStats {
  if (cells === ALL_CELLS && cells.length === index.length) return index;
  let perMask = cellStatsCache.get(index);
  if (!perMask) {
    perMask = new WeakMap();
    cellStatsCache.set(index, perMask);
  }
  let stats = perMask.get(cells);
  if (!stats) {
    stats = computeCellStats(index, cells);
    perMask.set(cells, stats);
  }
  return stats;
}

export type IconCandidate = { id: number; score: number };

export function encodeIconIndex(
  entries: IconIndexEntry[],
  size = DESCRIPTOR_SIZE,
  rows = CARD_ROWS
): Uint8Array {
  const length = size * rows;
  const sorted = [...entries].sort((a, b) => a.id - b.id);
  const out = new Uint8Array(HEADER_BYTES + sorted.length * (4 + length));
  const view = new DataView(out.buffer);
  for (let i = 0; i < MAGIC.length; i++) out[i] = MAGIC.charCodeAt(i);
  out[4] = ICON_INDEX_VERSION;
  out[5] = size;
  out[6] = rows;
  out[7] = 0;
  view.setUint32(8, sorted.length, true);
  let idOffset = HEADER_BYTES;
  let descOffset = HEADER_BYTES + sorted.length * 4;
  for (const entry of sorted) {
    if (entry.descriptor.length < length) {
      throw new Error(
        `Descriptor for ${entry.id} has ${entry.descriptor.length} bytes, expected ${length}.`
      );
    }
    view.setUint32(idOffset, entry.id, true);
    idOffset += 4;
    for (let i = 0; i < length; i++) out[descOffset + i] = entry.descriptor[i];
    descOffset += length;
  }
  return out;
}

export function parseIconIndex(input: Uint8Array | ArrayBuffer): IconIndex {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < HEADER_BYTES) throw new Error("Icon index is truncated.");
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== MAGIC) throw new Error("Not an icon index file.");
  const version = bytes[4];
  if (version !== ICON_INDEX_VERSION) {
    throw new Error(`Unsupported icon index version ${version}.`);
  }
  const size = bytes[5];
  const rows = bytes[6];
  const length = size * rows;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(8, true);
  const expected = HEADER_BYTES + count * (4 + length);
  if (bytes.length < expected) {
    throw new Error(
      `Icon index is truncated: ${bytes.length} bytes, expected ${expected}.`
    );
  }
  const ids = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    ids[i] = view.getUint32(HEADER_BYTES + i * 4, true);
  }
  const descriptors = bytes.slice(HEADER_BYTES + count * 4, expected);
  const means = new Float32Array(count);
  const norms = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const off = i * length;
    let sum = 0;
    for (let j = 0; j < length; j++) sum += descriptors[off + j];
    const mean = length > 0 ? sum / length : 0;
    let sq = 0;
    for (let j = 0; j < length; j++) {
      const d = descriptors[off + j] - mean;
      sq += d * d;
    }
    means[i] = mean;
    norms[i] = Math.sqrt(sq);
  }
  return { size, rows, length, count, ids, descriptors, means, norms };
}

/** Descriptor bytes of entry `i` (a view, not a copy). */
export function indexDescriptor(index: IconIndex, i: number): Uint8Array {
  return index.descriptors.subarray(i * index.length, (i + 1) * index.length);
}

/** Descriptor of monster `id` (ids are stored ascending), or null when it is not indexed. */
export function descriptorForId(index: IconIndex, id: number): Uint8Array | null {
  let lo = 0;
  let hi = index.count - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = index.ids[mid];
    if (v === id) return indexDescriptor(index, mid);
    if (v < id) lo = mid + 1;
    else hi = mid - 1;
  }
  return null;
}

/**
 * Rank every indexed icon by Pearson correlation with `descriptor` over `cells` (indices into
 * the first `index.length` values) and return the best `topN`, highest score first.
 */
export function rankIconCandidates(
  index: IconIndex,
  descriptor: ArrayLike<number>,
  topN = 5,
  cells: CellMask = ALL_CELLS
): IconCandidate[] {
  const length = index.length;
  const n = cells.length;
  if (n === 0 || descriptor.length < length || topN <= 0 || index.count === 0) return [];
  for (let k = 0; k < n; k++) if (cells[k] >= length) return [];
  let sum = 0;
  for (let k = 0; k < n; k++) sum += descriptor[cells[k]];
  const mean = sum / n;
  let sq = 0;
  for (let k = 0; k < n; k++) {
    const d = descriptor[cells[k]] - mean;
    sq += d * d;
  }
  const norm = Math.sqrt(sq);
  if (norm === 0) return [];

  const best: IconCandidate[] = [];
  const { descriptors, ids, count } = index;
  const { means, norms } = cellStats(index, cells);
  for (let c = 0; c < count; c++) {
    const normB = norms[c];
    if (normB === 0) continue;
    const off = c * length;
    let dot = 0;
    for (let k = 0; k < n; k++) dot += descriptor[cells[k]] * descriptors[off + cells[k]];
    const score = (dot - n * mean * means[c]) / (norm * normB);
    if (best.length < topN || score > best[best.length - 1].score) {
      let pos = best.length;
      while (pos > 0 && best[pos - 1].score < score) pos--;
      best.splice(pos, 0, { id: ids[c], score });
      if (best.length > topN) best.pop();
    }
  }
  return best;
}
