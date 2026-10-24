import { formatPriceParts } from "./format";

export type PriceCardModel = { name: string; price: number };
export type PriceFonts = { bold: string; display: string };
export type PriceLayout = {
  lines: string[];
  nameSize: number;
  priceSize: number;
  amount: string;
  priceX: number;
  currencyX: number;
};

export const PRICE_MM = 72 / 25.4;
export const PRICE_WIDTH = 210 * PRICE_MM;
export const PRICE_HEIGHT = 148 * PRICE_MM;
export const PRICE_LEFT = 7 * PRICE_MM;
export const PRICE_CONTENT = PRICE_WIDTH - 2 * PRICE_LEFT;
export const PRICE_NAME_TOP = 26 * PRICE_MM;

// Shared by SVG preview, browser print and PDF; all measurements are in points.
export function priceCardLayout(
  card: PriceCardModel,
  measure: (text: string, size: number, display: boolean) => number,
): PriceLayout {
  const name = card.name.replace(/\s+/g, " ").trim() || "Nazwa rośliny";
  let nameSize = 42;
  let lines: string[] = [];
  for (; nameSize >= 1; nameSize -= 0.5) {
    lines = [];
    let line = "";
    for (const word of name.split(" ")) {
      if (
        measure(line ? `${line} ${word}` : word, nameSize, true) <=
        PRICE_CONTENT
      ) {
        line = line ? `${line} ${word}` : word;
      } else {
        if (line) lines.push(line);
        line = "";
        for (const char of word) {
          if (line && measure(line + char, nameSize, true) > PRICE_CONTENT) {
            lines.push(line);
            line = "";
          }
          line += char;
        }
      }
    }
    if (line) lines.push(line);
    if (lines.length <= 2) break;
  }
  const amount = formatPriceParts(card.price).amount;
  const gap = 3 * PRICE_MM;
  const priceSize = Math.min(
    priceAreaHeight(nameSize, lines.length) / 0.96,
    (PRICE_CONTENT - gap) /
      (measure(amount, 1, true) + measure("zł", 0.24, false)),
  );
  const width =
    measure(amount, priceSize, true) +
    gap +
    measure("zł", priceSize * 0.24, false);
  const priceX = PRICE_LEFT + (PRICE_CONTENT - width) / 2;
  return {
    lines,
    nameSize,
    priceSize,
    amount,
    priceX,
    currencyX: priceX + measure(amount, priceSize, true) + gap,
  };
}

const nameBottom = (nameSize: number, lineCount: number) =>
  PRICE_NAME_TOP + nameSize * (0.9 + (lineCount - 1) * 1.12 + 0.25);

const priceAreaTop = (nameSize: number, lineCount: number) =>
  nameBottom(nameSize, lineCount) + 6 * PRICE_MM;
const priceAreaBottom = PRICE_HEIGHT - 8 * PRICE_MM;
const priceAreaHeight = (nameSize: number, lineCount: number) =>
  priceAreaBottom - priceAreaTop(nameSize, lineCount);

// Reserve the display font's ascenders and comma descender when fitting vertically.
export const priceBaseline = (
  size: number,
  nameSize: number,
  lineCount: number,
) =>
  (priceAreaTop(nameSize, lineCount) + priceAreaBottom) / 2 + size * 0.26;
