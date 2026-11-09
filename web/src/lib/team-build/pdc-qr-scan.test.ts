import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pdcQrModules } from "./pdc-image.ts";
import { classifyQrText, cropScaled, findPdcTeamQr, type QrScanImage } from "./pdc-qr-scan.ts";
import { PDC_QR_SAMPLES } from "./pdc-team-string.fixtures.ts";

/** White canvas with `text` as a QR at (x, y), `px` pixels per module, plus coloured noise below. */
function imageWithQr(text: string | null, width: number, height: number, x: number, y: number, px: number): QrScanImage {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const set = (cx: number, cy: number, v: number) => {
    const i = (cy * width + cx) * 4;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  };
  if (text) {
    pdcQrModules(text).forEach((row, r) =>
      row.forEach((dark, c) => {
        if (!dark) return;
        for (let dy = 0; dy < px; dy++) for (let dx = 0; dx < px; dx++) set(x + c * px + dx, y + r * px + dy, 0);
      }),
    );
  }
  // Card-like blocks under the QR so the full-image pass is not trivially blank.
  for (let cy = Math.floor(height * 0.4); cy < height * 0.8; cy++) {
    for (let cx = 0; cx < width; cx++) set(cx, cy, (cx * 7 + cy * 13) % 256);
  }
  return { width, height, data };
}

describe("findPdcTeamQr", () => {
  it("reads the PDC QR from the top-left corner at PDC's 2 px per module", () => {
    const text = PDC_QR_SAMPLES[0];
    const hit = findPdcTeamQr(imageWithQr(text, 1080, 905, 12, 12, 2));
    assert.equal(hit?.kind, "pdc");
    assert.equal(hit?.text, text);
    assert.equal(hit?.kind === "pdc" ? hit.team.members.length : 0, 6);
  });

  it("finds a QR away from the corner with the full-image pass", () => {
    const text = PDC_QR_SAMPLES[10];
    const hit = findPdcTeamQr(imageWithQr(text, 900, 1400, 520, 40, 3));
    assert.equal(hit?.kind, "pdc");
    assert.equal(hit?.text, text);
  });

  it("reports a QR that is not a PDC team, and null without a QR", () => {
    const other = findPdcTeamQr(imageWithQr("https://example.com/not-a-team", 1080, 905, 12, 12, 4));
    assert.deepEqual(other, { kind: "other", text: "https://example.com/not-a-team" });
    assert.equal(findPdcTeamQr(imageWithQr(null, 600, 600, 0, 0, 2)), null);
  });
});

describe("cropScaled / classifyQrText", () => {
  it("crops and scales with nearest-neighbour sampling", () => {
    const img: QrScanImage = { width: 2, height: 1, data: new Uint8ClampedArray([10, 10, 10, 255, 200, 200, 200, 255]) };
    const out = cropScaled(img, { x: 1, y: 0, width: 5, height: 5 }, 2);
    assert.deepEqual([out.width, out.height], [2, 2]);
    assert.deepEqual([...out.data.slice(0, 4)], [200, 200, 200, 255]);
  });

  it("classifies PDC text", () => {
    assert.equal(classifyQrText(PDC_QR_SAMPLES[3])?.kind, "pdc");
    assert.equal(classifyQrText("hello")?.kind, "other");
  });
});
