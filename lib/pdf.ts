import { fileSlug } from "./normalize";
import { formatPriceParts } from "./format";
import {
  FROST_STEPS,
  LIGHT_STEPS,
  SCALE_LEGEND,
  WATER_STEPS,
  rangeCaption,
  resolveFrost,
  snowflakeLines,
} from "./scales";
import { MONTH_ROMAN, plantInfoUrl, sizeLabel } from "./shelf";
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

function sniffImage(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  return "";
}

async function rasterToPng(src: string): Promise<Uint8Array | null> {
  const image = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("photo"));
  });
  image.src = src;
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

async function imageBytes(src: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (src.startsWith("data:")) {
    const match = src.match(/^data:([^;,]+);base64,(.+)$/);
    if (!match?.[2]) return null;
    const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
    return { bytes, mime: sniffImage(bytes) || match[1] };
  }
  if (!src.startsWith("/api/photo?")) return null;
  const response = await fetch(src);
  if (!response.ok) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  const header = (response.headers.get("content-type") || "").split(";")[0]?.trim() || "";
  return { bytes, mime: sniffImage(bytes) || header };
}

async function embedPhoto(pdf: import("pdf-lib").PDFDocument, src: string | null) {
  if (!src) return null;
  try {
    const loaded = await imageBytes(src);
    if (!loaded) return null;
    if (loaded.mime.includes("png")) return await pdf.embedPng(loaded.bytes);
    if (loaded.mime.includes("jpeg") || loaded.mime.includes("jpg")) return await pdf.embedJpg(loaded.bytes);
    const png = await rasterToPng(src);
    return png ? pdf.embedPng(png) : null;
  } catch {
    try {
      const png = await rasterToPng(src);
      return png ? pdf.embedPng(png) : null;
    } catch {
      return null;
    }
  }
}

function fitLine(text: string, font: import("pdf-lib").PDFFont, size: number, width: number): string {
  if (font.widthOfTextAtSize(text, size) <= width) return text;
  let cut = text;
  while (cut.length > 8 && font.widthOfTextAtSize(`${cut}…`, size) > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
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
  qr: import("pdf-lib").PDFImage | null,
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

  const left = x + mm(7.5);
  const right = x + width - mm(7.5);
  const contentWidth = right - left;
  const headerTop = y + height - mm(7.2);

  page.drawText("AGRA PSK", {
    x: left,
    y: headerTop - mm(3.4),
    size: 11,
    font: fonts.bold,
    color: ink,
  });
  page.drawText("Kłodzko · od 1991 r.", {
    x: left,
    y: headerTop - mm(7.4),
    size: 8,
    font: fonts.semibold,
    color: ink,
  });

  const ruleY = headerTop - mm(10.2);
  page.drawLine({
    start: { x: left, y: ruleY },
    end: { x: right, y: ruleY },
    thickness: 1.5,
    color: ink,
  });

  let cursor = ruleY - mm(1.6);
  if (photo) {
    const boxW = width - mm(8);
    const photoLeft = x + mm(4);
    const boxH = mm(104);
    const scale = Math.max(boxW / photo.width, boxH / photo.height);
    const drawW = photo.width * scale;
    const drawH = photo.height * scale;
    const imageX = photoLeft + (boxW - drawW) * 0.5;
    const imageY = cursor - (boxH - drawH) * 0.38 - drawH;
    const boxBottom = cursor - boxH;
    const { pushGraphicsState, popGraphicsState, rectangle, clip, endPath } = requireClip();
    page.pushOperators(pushGraphicsState(), rectangle(photoLeft, boxBottom, boxW, boxH), clip(), endPath());
    page.drawImage(photo, { x: imageX, y: imageY, width: drawW, height: drawH });
    page.pushOperators(popGraphicsState());
    page.drawRectangle({
      x: photoLeft,
      y: boxBottom,
      width: boxW,
      height: boxH,
      borderColor: ink,
      borderWidth: 0.7,
    });
    if (qr) {
      const qrSize = mm(13);
      const pad = mm(1.1);
      const qrX = photoLeft + boxW - qrSize - pad - mm(0.8);
      const qrY = boxBottom + boxH - qrSize - pad - mm(3.4);
      page.drawRectangle({
        x: qrX - mm(0.8),
        y: qrY - mm(3.2),
        width: qrSize + mm(1.6),
        height: qrSize + mm(4.4),
        color: rgb(1, 1, 1),
        borderColor: ink,
        borderWidth: 0.6,
      });
      page.drawImage(qr, { x: qrX, y: qrY, width: qrSize, height: qrSize });
      const wiki = "Wikipedia";
      const wikiWidth = fonts.semibold.widthOfTextAtSize(wiki, 5.5);
      page.drawText(wiki, {
        x: qrX + (qrSize - wikiWidth) / 2,
        y: qrY - mm(2.4),
        size: 5.5,
        font: fonts.semibold,
        color: ink,
      });
    }
    cursor = boxBottom;
    if (card.photoCredit) {
      const creditSize = 6.2;
      cursor -= mm(3);
      const line = fitLine(card.photoCredit, fonts.regular, creditSize, contentWidth);
      const lineWidth = fonts.regular.widthOfTextAtSize(line, creditSize);
      page.drawText(line, {
        x: right - lineWidth,
        y: cursor,
        size: creditSize,
        font: fonts.regular,
        color: ink,
      });
      cursor -= mm(1.6);
    } else {
      cursor -= mm(2.2);
    }
  }

  const nameSize = (card.polishName || "").length > 24 ? 15 : 18;
  const nameLines = wrap(card.polishName || "Nazwa rośliny", fonts.display, nameSize, contentWidth).slice(0, 2);
  for (const line of nameLines) {
    cursor -= nameSize * 0.86;
    page.drawText(line, { x: left, y: cursor, size: nameSize, font: fonts.display, color: ink });
    cursor -= mm(0.6);
  }

  const latinSize = 10;
  cursor -= latinSize * 0.35 + mm(1.2);
  if (card.latinName) {
    const latin = fitLine(card.latinName, fonts.displayItalic, latinSize, contentWidth);
    page.drawText(latin, { x: left, y: cursor, size: latinSize, font: fonts.displayItalic, color: ink });
  }
  cursor -= mm(1.4);

  if (card.plantType) {
    const type = card.plantType.toLocaleUpperCase("pl");
    cursor -= mm(3.2);
    page.drawText(fitLine(type, fonts.semibold, 7.5, contentWidth), {
      x: left,
      y: cursor,
      size: 7.5,
      font: fonts.semibold,
      color: ink,
    });
    cursor -= mm(1.6);
  }

  cursor = drawBadges(page, card, left, right, cursor, fonts, ink);
  cursor = drawScales(page, card, left, contentWidth, cursor, fonts, ink);
  cursor = drawMonths(page, card, left, contentWidth, cursor, fonts, ink, rgb);

  const priceHeight = mm(16);
  const priceBottom = y + mm(12.5);
  const descSize = 9;
  const descLeading = 11.5;
  const descLines = wrap(card.description || "", fonts.regular, descSize, contentWidth).slice(0, 2);
  const descFloor = priceBottom + priceHeight + mm(2.4);
  for (const line of descLines) {
    if (cursor - descLeading < descFloor) break;
    cursor -= descLeading;
    page.drawText(line, { x: left, y: cursor, size: descSize, font: fonts.regular, color: ink });
  }

  page.drawRectangle({
    x: left,
    y: priceBottom,
    width: contentWidth,
    height: priceHeight,
    borderColor: ink,
    borderWidth: mm(0.7),
    color: rgb(0.953, 0.886, 0.643),
  });
  const { amount, currency } = formatPriceParts(card.price);
  const amountSize = amount.replace(/\s/g, "").length > 6 ? 26 : 32;
  const amountWidth = fonts.display.widthOfTextAtSize(amount, amountSize);
  const currencySize = 13;
  const currencyWidth = fonts.bold.widthOfTextAtSize(currency, currencySize);
  const gap = mm(2);
  const total = amountWidth + gap + currencyWidth;
  const priceX = left + (contentWidth - total) / 2;
  const priceBaseline = priceBottom + mm(4.4);
  page.drawText(amount, {
    x: priceX,
    y: priceBaseline,
    size: amountSize,
    font: fonts.display,
    color: ink,
  });
  page.drawText(currency, {
    x: priceX + amountWidth + gap,
    y: priceBaseline + mm(1.4),
    size: currencySize,
    font: fonts.bold,
    color: ink,
  });

  const footer = "AGRA PSK · Kłodzko · od 1991 r.";
  const footerWidth = fonts.semibold.widthOfTextAtSize(footer, 8);
  page.drawText(footer, {
    x: left + (contentWidth - footerWidth) / 2,
    y: y + mm(6.4),
    size: 8,
    font: fonts.semibold,
    color: ink,
  });
}

function drawBadges(
  page: import("pdf-lib").PDFPage,
  card: CardModel,
  left: number,
  right: number,
  cursor: number,
  fonts: Fonts,
  ink: ReturnType<typeof import("pdf-lib").rgb>,
) {
  const badges = (card.badges ?? []).map((badge) => badge.trim()).filter(Boolean).slice(0, 3);
  if (badges.length === 0) return cursor - mm(1);
  const size = 8;
  const padX = mm(1.5);
  const height = mm(5);
  const gap = mm(1.3);
  const bottom = cursor - height - mm(0.6);
  let badgeX = left;
  for (const badge of badges) {
    const textWidth = fonts.semibold.widthOfTextAtSize(badge, size);
    const pillWidth = textWidth + padX * 2;
    if (badgeX + pillWidth > right + 1) break;
    page.drawRectangle({
      x: badgeX,
      y: bottom,
      width: pillWidth,
      height,
      borderColor: ink,
      borderWidth: 0.7,
    });
    page.drawText(badge, {
      x: badgeX + padX,
      y: bottom + mm(1.45),
      size,
      font: fonts.semibold,
      color: ink,
    });
    badgeX += pillWidth + gap;
  }
  return bottom - mm(2.2);
}

function drawCentered(
  page: import("pdf-lib").PDFPage,
  text: string,
  center: number,
  y: number,
  size: number,
  font: import("pdf-lib").PDFFont,
  ink: ReturnType<typeof import("pdf-lib").rgb>,
  width: number,
) {
  const shown = fitLine(text, font, size, width);
  const textWidth = font.widthOfTextAtSize(shown, size);
  page.drawText(shown, { x: center - textWidth / 2, y, size, font, color: ink });
}

function drawSnowflake(
  page: import("pdf-lib").PDFPage,
  cx: number,
  cy: number,
  size: number,
  filled: boolean,
  ink: ReturnType<typeof import("pdf-lib").rgb>,
) {
  const scale = size / 100;
  for (const line of snowflakeLines()) {
    page.drawLine({
      start: { x: cx + (line.x1 - 50) * scale, y: cy - (line.y1 - 50) * scale },
      end: { x: cx + (line.x2 - 50) * scale, y: cy - (line.y2 - 50) * scale },
      thickness: filled ? 1.15 : 0.45,
      color: ink,
    });
  }
  page.drawCircle({
    x: cx,
    y: cy,
    size: filled ? size * 0.045 : size * 0.03,
    color: filled ? ink : undefined,
    borderColor: ink,
    borderWidth: 0.4,
  });
}

function drawScales(
  page: import("pdf-lib").PDFPage,
  card: CardModel,
  left: number,
  contentWidth: number,
  cursor: number,
  fonts: Fonts,
  ink: ReturnType<typeof import("pdf-lib").rgb>,
) {
  const { rgb } = requireRgb();
  const frost = resolveFrost(card);
  const columns: { title: string; kind: "light" | "water" | "frost" }[] = [
    { title: "STANOWISKO", kind: "light" },
    { title: "PODLEWANIE", kind: "water" },
    { title: "ODPORNOŚĆ NA MRÓZ", kind: "frost" },
  ];
  const gap = mm(1.4);
  const columnWidth = (contentWidth - gap * 2) / 3;
  const widths = [columnWidth * 1.05, columnWidth * 0.9, columnWidth * 1.15];
  const widthSum = widths.reduce((sum, item) => sum + item, 0);
  const scaled = widths.map((item) => (item / widthSum) * (contentWidth - gap * 2));
  let columnX = left;
  scaled.forEach((width, index) => {
    const column = columns[index];
    const center = columnX + width / 2;
    drawCentered(page, column.title, center, cursor - mm(2.6), 6.2, fonts.bold, ink, width);
    const cellGap = mm(0.4);
    const cell = (width - cellGap * 4) / 5;
    const markY = cursor - mm(8.2);
    for (let step = 1; step <= 5; step += 1) {
      const cellX = columnX + (step - 1) * (cell + cellGap);
      const cellCenter = cellX + cell / 2;
      if (column.kind === "light") {
        const on = step >= card.lightFrom && step <= card.lightTo;
        page.drawRectangle({
          x: cellX,
          y: markY - mm(0.4),
          width: cell,
          height: mm(1.5),
          borderColor: ink,
          borderWidth: 0.5,
          color: on ? ink : rgb(1, 1, 1),
        });
        drawCentered(page, String(step), cellCenter, markY + mm(1.5), 7, fonts.bold, ink, cell);
      } else if (column.kind === "water") {
        const on = step >= card.waterFrom && step <= card.waterTo;
        page.drawEllipse({
          x: cellCenter,
          y: markY + mm(1.3),
          xScale: mm(1.15),
          yScale: mm(1.7),
          borderColor: ink,
          borderWidth: 0.7,
          color: on ? ink : undefined,
        });
      } else {
        const on = frost.known && step <= frost.level;
        drawSnowflake(page, cellCenter, markY + mm(1.5), mm(6.4), on, ink);
      }
      const caption = column.kind === "light" ? LIGHT_STEPS[step - 1].caption : column.kind === "water" ? WATER_STEPS[step - 1].caption : FROST_STEPS[step - 1].caption;
      drawCentered(page, caption, cellCenter, cursor - mm(11.4), 5.2, fonts.semibold, ink, cell + cellGap);
    }
    if (column.kind === "frost") {
      const markerX = columnX + width * 0.6;
      page.drawLine({
        start: { x: markerX, y: cursor - mm(4.2) },
        end: { x: markerX, y: cursor - mm(10.2) },
        thickness: 1.1,
        color: ink,
      });
      page.drawText("6a", { x: markerX + mm(0.4), y: cursor - mm(4.6), size: 5, font: fonts.bold, color: ink });
    }
    const value = column.kind === "light"
      ? rangeCaption(LIGHT_STEPS, card.lightFrom, card.lightTo)
      : column.kind === "water"
        ? rangeCaption(WATER_STEPS, card.waterFrom, card.waterTo)
        : frost.value;
    drawCentered(page, value, center, cursor - mm(14.2), 6.4, fonts.bold, ink, width);
    columnX += width + gap;
  });
  const legendWidth = fonts.regular.widthOfTextAtSize(SCALE_LEGEND, 6);
  const legend = legendWidth > contentWidth ? fitLine(SCALE_LEGEND, fonts.regular, 6, contentWidth) : SCALE_LEGEND;
  const legendTextWidth = fonts.regular.widthOfTextAtSize(legend, 6);
  page.drawText(legend, {
    x: left + (contentWidth - legendTextWidth) / 2,
    y: cursor - mm(17.2),
    size: 6,
    font: fonts.regular,
    color: ink,
  });
  let next = cursor - mm(19);
  if (frost.note) {
    const note = fitLine(frost.note, fonts.semibold, 6.5, contentWidth);
    const noteWidth = fonts.semibold.widthOfTextAtSize(note, 6.5);
    page.drawText(note, {
      x: left + (contentWidth - noteWidth) / 2,
      y: next,
      size: 6.5,
      font: fonts.semibold,
      color: ink,
    });
    next -= mm(3.2);
  }
  const size = `WYMIAR  ${sizeLabel(card.height ?? "", card.width ?? "")}`;
  page.drawText(fitLine(size, fonts.bold, 8, contentWidth), {
    x: left,
    y: next - mm(0.4),
    size: 8,
    font: fonts.bold,
    color: ink,
  });
  return next - mm(3.4);
}

function drawMonths(
  page: import("pdf-lib").PDFPage,
  card: CardModel,
  left: number,
  contentWidth: number,
  cursor: number,
  fonts: Fonts,
  ink: ReturnType<typeof import("pdf-lib").rgb>,
  rgb: typeof import("pdf-lib").rgb,
) {
  const active = new Set(card.bloomMonths ?? []);
  const gap = mm(0.55);
  const boxWidth = (contentWidth - gap * 11) / 12;
  const boxHeight = mm(5.6);
  const bottom = cursor - boxHeight;
  const sage = rgb(0.843, 0.894, 0.784);
  MONTH_ROMAN.forEach((label, index) => {
    const boxX = left + index * (boxWidth + gap);
    page.drawRectangle({
      x: boxX,
      y: bottom,
      width: boxWidth,
      height: boxHeight,
      borderColor: ink,
      borderWidth: 0.6,
      color: active.has(index + 1) ? sage : rgb(1, 1, 1),
    });
    const size = label.length > 2 ? 5.4 : 6.4;
    const textWidth = fonts.bold.widthOfTextAtSize(label, size);
    page.drawText(label, {
      x: boxX + (boxWidth - textWidth) / 2,
      y: bottom + mm(1.55),
      size,
      font: fonts.bold,
      color: ink,
    });
  });
  const caption = active.size > 0 ? "kwitnienie albo główna ozdoba" : "miesiące ozdoby niepodane";
  const captionWidth = fonts.regular.widthOfTextAtSize(caption, 6.5);
  page.drawText(caption, {
    x: left + (contentWidth - captionWidth) / 2,
    y: bottom - mm(3.2),
    size: 6.5,
    font: fonts.regular,
    color: ink,
  });
  return bottom - mm(5);
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

type ClipOps = Pick<
  typeof import("pdf-lib"),
  "pushGraphicsState" | "popGraphicsState" | "rectangle" | "clip" | "endPath"
>;

const clipHolder: { ops: ClipOps | null } = { ops: null };

function requireClip(): ClipOps {
  if (!clipHolder.ops) throw new Error("PDF nie jest gotowe");
  return clipHolder.ops;
}

export async function downloadCardPdf(card: CardModel, mode: "a5" | "a4") {
  const pdfLib = await import("pdf-lib");
  const { PDFDocument, rgb } = pdfLib;
  const fontkit = (await import("@pdf-lib/fontkit")).default;
  rgbHolder.rgb = rgb;
  clipHolder.ops = pdfLib;
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
  const infoUrl = plantInfoUrl(card.latinName, card.polishName);
  let qr: import("pdf-lib").PDFImage | null = null;
  if (infoUrl) {
    const dataUrl = await import("qrcode").then((QRCode) =>
      QRCode.toDataURL(infoUrl, {
        margin: 0,
        width: 180,
        errorCorrectionLevel: "M",
        color: { dark: "#1b2418", light: "#ffffff" },
      }),
    );
    qr = await embedPhoto(pdf, dataUrl);
  }
  if (mode === "a5") {
    const page = pdf.addPage([mm(148), mm(210)]);
    drawCard(page, card, photo, qr, 0, 0, fonts);
  } else {
    const page = pdf.addPage([mm(297), mm(210)]);
    drawCard(page, card, photo, qr, 0, 0, fonts);
    drawCard(page, card, photo, qr, mm(149), 0, fonts);
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
