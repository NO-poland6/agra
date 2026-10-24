import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  infoCardLayout,
  infoSheetSize,
  INFO_TOP,
  INFO_BOTTOM,
} from "./info-card.ts";
import {
  PRICE_CONTENT,
  PRICE_LEFT,
  PRICE_MM,
  PRICE_WIDTH,
} from "./price-card.ts";

const pdf = await PDFDocument.create();
pdf.registerFontkit(fontkit);
const [body, title] = await Promise.all([
  pdf.embedFont(await readFile("public/fonts/SourceSans3-Bold.ttf")),
  pdf.embedFont(await readFile("public/fonts/Fraunces-SemiBold.ttf")),
]);
const measure = (text: string, size: number, isTitle: boolean) =>
  (isTitle ? title : body).widthOfTextAtSize(text, size);

test("info auto-fit keeps Polish notices, long words and many newlines inside the card", () => {
  for (const text of [
    "Zapraszamy!",
    "Zażółć gęślą jaźń. ".repeat(150),
    "W".repeat(1500),
    "Wiersz\n".repeat(500),
    "",
    "\n\n",
  ]) {
    for (const align of ["left", "center"] as const) {
      const lines = infoCardLayout(
        { title: "Ważna informacja\nAGRA PSK", text, align },
        measure,
      );
      for (const line of lines) {
        assert.ok(line.size > 0);
        assert.ok(
          measure(line.text, line.size, line.title) <= PRICE_CONTENT + 1e-6,
        );
        assert.ok(line.x >= PRICE_LEFT - 1e-6);
        assert.ok(
          line.x + measure(line.text, line.size, line.title) <=
            PRICE_WIDTH - PRICE_LEFT + 1e-6,
        );
        assert.ok(line.baseline - line.size * 0.95 >= INFO_TOP - 1e-6);
        assert.ok(line.baseline + line.size * 0.25 <= INFO_BOTTOM + 1e-6);
      }
    }
  }
  const short = infoCardLayout(
    { title: "", text: "Zapraszamy!", align: "center" },
    measure,
  );
  const long = infoCardLayout(
    { title: "", text: "Zapraszamy! ".repeat(200), align: "center" },
    measure,
  );
  assert.ok(long[0].size < short[0].size);
});

test("info preserves explicit and empty lines and permits an empty title", () => {
  const lines = infoCardLayout(
    { title: "", text: "Pierwszy\r\n\r\nTrzeci", align: "left" },
    measure,
  );
  assert.deepEqual(
    lines.map((line) => line.text),
    ["Pierwszy", "", "Trzeci"],
  );
  assert.ok(lines.every((line) => !line.title && line.x === PRICE_LEFT));
});

test("sign formats are A5 landscape and two A5 cards on one portrait A4 sheet", () => {
  assert.deepEqual(infoSheetSize("a5"), [210 * PRICE_MM, 148 * PRICE_MM]);
  assert.deepEqual(infoSheetSize("a4"), [210 * PRICE_MM, 297 * PRICE_MM]);
  assert.equal(148 * 2 + 1, 297);
});
