import { fileSlug } from "./normalize";
import { formatPriceParts } from "./format";
import { FROST_CAPTION, LIGHT_LABEL, WATERING_LABEL, dropsFor } from "./labels";
import type { CardModel } from "./types";

const MM = 72 / 25.4;
const mm = (value: number) => value * MM;

const FONTS = {
  regular: "/fonts/SourceSans3-Regular.ttf",
  semibold: "/fonts/SourceSans3-Semibold.ttf",
  bold: "/fonts/SourceSans3-Bold.ttf",
  italic: "/fonts/SourceSans3-Italic.ttf",
  display: "/fonts/Fraunces-SemiBold.ttf",
  displayItalic: "/fonts/Fraunces-Italic.ttf",
};

const fontBytes = new Map<string, ArrayBuffer>();

async function loadFont(url: string): Promise<ArrayBuffer> {
  const cached = fontBytes.get(url);
  if (cached) return cached;
  const response = await fetch(url);
  if (!response.ok) throw new Error("font");
  const bytes = await response.arrayBuffer();
  fontBytes.set(url, bytes);
  return bytes;
}

async function rasterToPng(dataUrl: string): Promise<Uint8Array | null> {
  const image = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("photo"));
  });
  image.src = dataUrl;
  await loaded;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, 0, 0);
  const png = canvas.toDataURL("image/png");
  const base64 = png.split(",")[1];
  if (!base64) return null;
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function embedPhoto(pdf: import("pdf-lib").PDFDocument, dataUrl: string | null) {
  if (!dataUrl) return null;
  const [header, base64] = dataUrl.split(",");
  if (!base64) return null;
  try {
    if (header.includes("image/png")) {
      return pdf.embedPng(Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)));
    }
    if (header.includes("image/jpeg") || header.includes("image/jpg")) {
      return pdf.embedJpg(Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)));
    }
    const png = await rasterToPng(dataUrl);
    return png ? pdf.embedPng(png) : null;
  } catch {
    return null;
  }
}

function wrap(text: string, font: import("pdf-lib").PDFFont, size: number, width: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!word) continue;
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) line = next;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

type Fonts = {
  regular: import("pdf-lib").PDFFont;
  semibold: import("pdf-lib").PDFFont;
  bold: import("pdf-lib").PDFFont;
  italic: import("pdf-lib").PDFFont;
  display: import("pdf-lib").PDFFont;
  displayItalic: import("pdf-lib").PDFFont;
};

const INK = { r: 0.106, g: 0.141, b: 0.094 };

function drawCard(
  page: import("pdf-lib").PDFPage,
  card: CardModel,
  photo: import("pdf-lib").PDFImage | null,
  x: number,
  y: number,
  fonts: Fonts,
) {
  const { rgb } = requireRgb();
  const ink = rgb(INK.r, INK.g, INK.b);
  const width = mm(148);
  const height = mm(210);
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderColor: ink,
    borderWidth: 1.1,
    color: rgb(0.984, 0.973, 0.949),
  });
  page.drawRectangle({
    x: x + mm(5.5),
    y: y + mm(5.5),
    width: width - mm(11),
    height: height - mm(11),
    borderColor: ink,
    borderWidth: 0.7,
  });

  const left = x + mm(9);
  const right = x + width - mm(9);
  const contentWidth = right - left;
  let cursor = y + height - mm(12);

  const brandSize = 8.5;
  page.drawText("AGRA PSK", {
    x: left,
    y: cursor,
    size: brandSize,
    font: fonts.bold,
    color: ink,
  });
  const city = "KŁODZKO";
  page.drawText(city, {
    x: right - fonts.bold.widthOfTextAtSize(city, brandSize),
    y: cursor,
    size: brandSize,
    font: fonts.bold,
    color: ink,
  });
  cursor -= mm(2.2);
  page.drawLine({
    start: { x: left, y: cursor },
    end: { x: right, y: cursor },
    thickness: 0.8,
    color: ink,
  });
  cursor -= mm(3);

  if (photo) {
    const boxW = contentWidth;
    const boxH = mm(42);
    const scale = Math.min(boxW / photo.width, boxH / photo.height);
    const drawW = photo.width * scale;
    const drawH = photo.height * scale;
    page.drawRectangle({
      x: left,
      y: cursor - boxH,
      width: boxW,
      height: boxH,
      borderColor: ink,
      borderWidth: 0.7,
    });
    page.drawImage(photo, {
      x: left + (boxW - drawW) / 2,
      y: cursor - boxH + (boxH - drawH) / 2,
      width: drawW,
      height: drawH,
    });
    cursor -= boxH + mm(3);
  }

  const nameSize = card.polishName.length > 28 ? 16 : 20;
  const nameLines = wrap(card.polishName || "Nazwa rośliny", fonts.display, nameSize, contentWidth).slice(0, 2);
  for (const line of nameLines) {
    cursor -= nameSize * 0.92;
    page.drawText(line, { x: left, y: cursor, size: nameSize, font: fonts.display, color: ink });
    cursor -= mm(1.1);
  }
  if (card.latinName) {
    cursor -= 11;
    const latin = wrap(card.latinName, fonts.displayItalic, 11, contentWidth)[0] ?? card.latinName;
    page.drawText(latin, { x: left, y: cursor, size: 11, font: fonts.displayItalic, color: ink });
    cursor -= mm(2.4);
  } else {
    cursor -= mm(2);
  }

  const priceBottom = y + mm(16);
  const reservedTop = priceBottom + mm(18) + mm(22) + (card.frostDetail ? mm(8) : 0) + mm(6);
  const descSize = card.photoDataUrl ? 9.5 : 10.5;
  const descLeading = descSize + 3.2;
  const descLines = wrap(card.description, fonts.regular, descSize, contentWidth);
  for (const line of descLines) {
    if (cursor - descLeading < reservedTop) break;
    cursor -= descLeading;
    page.drawText(line, { x: left, y: cursor, size: descSize, font: fonts.regular, color: ink });
  }

  const meta = [card.plantType, card.height].filter(Boolean).join(" · ");
  if (meta) {
    cursor -= mm(5);
    page.drawText(meta, { x: left, y: cursor, size: 9, font: fonts.semibold, color: ink });
  }

  cursor -= mm(4);
  const iconTop = cursor;
  const col = contentWidth / 3;
  drawWater(page, left + col * 0.5, iconTop, card, fonts, ink);
  drawLight(page, left + col * 1.5, iconTop, card, fonts, ink);
  drawFrost(page, left + col * 2.5, iconTop, card, fonts, ink);
  cursor = iconTop - mm(20);
  if (card.frostDetail) {
    const detail = wrap(card.frostDetail, fonts.regular, 8, contentWidth).slice(0, 2);
    for (const line of detail) {
      const lineWidth = fonts.regular.widthOfTextAtSize(line, 8);
      cursor -= 10;
      page.drawText(line, { x: left + (contentWidth - lineWidth) / 2, y: cursor, size: 8, font: fonts.regular, color: ink });
    }
  }

  const priceHeight = mm(16);
  page.drawRectangle({
    x: left,
    y: priceBottom,
    width: contentWidth,
    height: priceHeight,
    borderColor: ink,
    borderWidth: 1.6,
  });
  const { amount, currency } = formatPriceParts(card.price);
  const amountSize = amount.replace(/\s/g, "").length > 6 ? 22 : 28;
  const amountWidth = fonts.display.widthOfTextAtSize(amount, amountSize);
  const currencySize = 13;
  const currencyWidth = fonts.bold.widthOfTextAtSize(currency, currencySize);
  const gap = mm(2);
  const total = amountWidth + gap + currencyWidth;
  const priceX = left + (contentWidth - total) / 2;
  const priceBaseline = priceBottom + mm(4.2);
  page.drawText(amount, {
    x: priceX,
    y: priceBaseline,
    size: amountSize,
    font: fonts.display,
    color: ink,
  });
  page.drawText(currency, {
    x: priceX + amountWidth + gap,
    y: priceBaseline + mm(1.2),
    size: currencySize,
    font: fonts.bold,
    color: ink,
  });

  const footer = "AGRA PSK Kłodzko – od 1991 r.";
  const footerWidth = fonts.semibold.widthOfTextAtSize(footer, 8);
  page.drawText(footer, {
    x: left + (contentWidth - footerWidth) / 2,
    y: y + mm(8.2),
    size: 8,
    font: fonts.semibold,
    color: ink,
  });
}

function requireRgb() {
  // pdf-lib is loaded by the caller; rgb is passed through a lazy require-like import kept local
  // to avoid pulling the module into the type of every helper. The real import lives in downloadCardPdf.
  return rgbHolder;
}

const rgbHolder: { rgb: typeof import("pdf-lib").rgb } = {
  rgb: (r, g, b) => {
    throw new Error(`PDF nie jest gotowe (${r},${g},${b})`);
  },
};

function drawWater(
  page: import("pdf-lib").PDFPage,
  center: number,
  top: number,
  card: CardModel,
  fonts: Fonts,
  ink: ReturnType<typeof import("pdf-lib").rgb>,
) {
  const level = dropsFor(card.watering);
  for (let index = 0; index < 3; index += 1) {
    const cx = center - mm(7) + index * mm(7);
    page.drawEllipse({
      x: cx,
      y: top - mm(4.5),
      xScale: mm(1.7),
      yScale: mm(2.4),
      borderColor: ink,
      borderWidth: 0.8,
      color: index < level ? ink : undefined,
    });
  }
  labelUnder(page, center, top - mm(9), WATERING_LABEL[card.watering], "PODLEWANIE", fonts, ink);
}

function drawLight(
  page: import("pdf-lib").PDFPage,
  center: number,
  top: number,
  card: CardModel,
  fonts: Fonts,
  ink: ReturnType<typeof import("pdf-lib").rgb>,
) {
  const y = top - mm(4.5);
  if (card.light === "shade") {
    page.drawEllipse({
      x: center,
      y,
      xScale: mm(6),
      yScale: mm(3.2),
      borderColor: ink,
      borderWidth: 0.9,
    });
  } else {
    page.drawCircle({ x: center, y, size: mm(2.3), borderColor: ink, borderWidth: 0.9, color: card.light === "sun" ? ink : undefined });
    if (card.light === "partial") {
      page.drawCircle({ x: center - mm(0.7), y, size: mm(1.5), color: ink });
    }
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI / 4) * i;
      page.drawLine({
        start: { x: center + Math.cos(angle) * mm(3.2), y: y + Math.sin(angle) * mm(3.2) },
        end: { x: center + Math.cos(angle) * mm(4.6), y: y + Math.sin(angle) * mm(4.6) },
        thickness: 0.8,
        color: ink,
      });
    }
  }
  labelUnder(page, center, top - mm(9), LIGHT_LABEL[card.light], "STANOWISKO", fonts, ink);
}

function drawFrost(
  page: import("pdf-lib").PDFPage,
  center: number,
  top: number,
  card: CardModel,
  fonts: Fonts,
  ink: ReturnType<typeof import("pdf-lib").rgb>,
) {
  const y = top - mm(4.2);
  if (card.frostLabel === "nie zimuje w gruncie") {
    page.drawRectangle({
      x: center - mm(4),
      y: y - mm(3.2),
      width: mm(8),
      height: mm(4.2),
      borderColor: ink,
      borderWidth: 0.9,
    });
    page.drawLine({
      start: { x: center - mm(5), y: y + mm(1.2) },
      end: { x: center + mm(5), y: y + mm(1.2) },
      thickness: 1,
      color: ink,
    });
  } else if (card.frostLabel === "wymaga okrycia") {
    page.drawRectangle({
      x: center - mm(1.3),
      y: y - mm(1),
      width: mm(2.6),
      height: mm(6),
      borderColor: ink,
      borderWidth: 0.8,
    });
    page.drawCircle({ x: center, y: y - mm(2.4), size: mm(2.1), borderColor: ink, borderWidth: 0.8 });
  } else {
    for (let i = 0; i < 3; i += 1) {
      const angle = (Math.PI / 3) * i;
      page.drawLine({
        start: { x: center - Math.cos(angle) * mm(4.2), y: y - Math.sin(angle) * mm(4.2) },
        end: { x: center + Math.cos(angle) * mm(4.2), y: y + Math.sin(angle) * mm(4.2) },
        thickness: 0.9,
        color: ink,
      });
    }
  }
  const caption = FROST_CAPTION[card.frostLabel];
  const lines = wrap(caption, fonts.bold, 8, mm(40)).slice(0, 2);
  let textY = top - mm(9.5);
  for (const line of lines) {
    const lineWidth = fonts.bold.widthOfTextAtSize(line, 8);
    page.drawText(line, { x: center - lineWidth / 2, y: textY, size: 8, font: fonts.bold, color: ink });
    textY -= 10;
  }
  const label = "ZIMA";
  const labelWidth = fonts.semibold.widthOfTextAtSize(label, 7);
  page.drawText(label, {
    x: center - labelWidth / 2,
    y: textY - 1,
    size: 7,
    font: fonts.semibold,
    color: ink,
  });
}

function labelUnder(
  page: import("pdf-lib").PDFPage,
  center: number,
  y: number,
  value: string,
  label: string,
  fonts: Fonts,
  ink: ReturnType<typeof import("pdf-lib").rgb>,
) {
  const valueWidth = fonts.bold.widthOfTextAtSize(value, 8.5);
  page.drawText(value, { x: center - valueWidth / 2, y, size: 8.5, font: fonts.bold, color: ink });
  const labelWidth = fonts.semibold.widthOfTextAtSize(label, 7);
  page.drawText(label, {
    x: center - labelWidth / 2,
    y: y - 11,
    size: 7,
    font: fonts.semibold,
    color: ink,
  });
}

export async function downloadCardPdf(card: CardModel, mode: "a5" | "a4") {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const fontkit = (await import("@pdf-lib/fontkit")).default;
  rgbHolder.rgb = rgb;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regular, semibold, bold, italic, display, displayItalic] = await Promise.all([
    loadFont(FONTS.regular),
    loadFont(FONTS.semibold),
    loadFont(FONTS.bold),
    loadFont(FONTS.italic),
    loadFont(FONTS.display),
    loadFont(FONTS.displayItalic),
  ]);
  const fonts: Fonts = {
    regular: await pdf.embedFont(regular, { subset: true }),
    semibold: await pdf.embedFont(semibold, { subset: true }),
    bold: await pdf.embedFont(bold, { subset: true }),
    italic: await pdf.embedFont(italic, { subset: true }),
    display: await pdf.embedFont(display, { subset: true }),
    displayItalic: await pdf.embedFont(displayItalic, { subset: true }),
  };
  const photo = await embedPhoto(pdf, card.photoDataUrl);
  if (mode === "a5") {
    const page = pdf.addPage([mm(148), mm(210)]);
    drawCard(page, card, photo, 0, 0, fonts);
  } else {
    const page = pdf.addPage([mm(297), mm(210)]);
    drawCard(page, card, photo, 0, 0, fonts);
    drawCard(page, card, photo, mm(149), 0, fonts);
    page.drawLine({
      start: { x: mm(148.5), y: mm(6) },
      end: { x: mm(148.5), y: mm(204) },
      thickness: 0.7,
      color: rgb(0.1, 0.1, 0.1),
      dashArray: [3, 2],
    });
  }
  const bytes = await pdf.save();
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const blob = new Blob([copy], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const slug = fileSlug(card.polishName || card.latinName);
  link.download = mode === "a5" ? `etykieta-${slug}.pdf` : `etykiety-a4-${slug}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
