import type { DetailLayout } from "./layout.ts";

/** Height of one line of skill description text (44 reference pixels). */
export function jpTextLineHeight(layout: DetailLayout): number {
  return 44 * layout.scale;
}
