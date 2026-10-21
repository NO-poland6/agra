import { fileSlug } from "./normalize";
import { formatPriceParts } from "./format";
import { FROST_CAPTION, LIGHT_LABEL, WATERING_LABEL } from "./labels";
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

  let ruleY = headerTop - mm(10.2);
  if (qr) {
    const qrSize = mm(14);
    const qrX = right - qrSize;
    const qrY = headerTop - qrSize + mm(1);
    page.drawImage(qr, { x: qrX, y: qrY, width: qrSize, height: qrSize });
    const wiki = "Wikipedia";
    const wikiWidth = fonts.semibold.widthOfTextAtSize(wiki, 6);
    page.drawText(wiki, {
      x: qrX + (qrSize - wikiWidth) / 2,
      y: qrY - mm(2.8),
      size: 6,
      font: fonts.semibold,
      color: ink,
    });
    ruleY = qrY - mm(5.2);
  }
  page.drawLine({
    start: { x: left, y: ruleY },
    end: { x: right, y: ruleY },
    thickness: 1.5,
    color: ink,
  });

  let cursor = ruleY - mm(2.4);
  if (photo) {
    const boxW = contentWidth;
    const boxH = mm(card.photoCredit ? 32 : 36);
    const scale = Math.max(boxW / photo.width, boxH / photo.height);
    const drawW = photo.width * scale;
    const drawH = photo.height * scale;
    const imageX = left + (boxW - drawW) * 0.5;
    const imageY = cursor - (boxH - drawH) * 0.42 - drawH;
    const boxBottom = cursor - boxH;
    const { pushGraphicsState, popGraphicsState, rectangle, clip, endPath } = requireClip();
    page.pushOperators(pushGraphicsState(), rectangle(left, boxBottom, boxW, boxH), clip(), endPath());
    page.drawImage(photo, { x: imageX, y: imageY, width: drawW, height: drawH });
    page.pushOperators(popGraphicsState());
    page.drawRectangle({
      x: left,
      y: boxBottom,
      width: boxW,
      height: boxH,
      borderColor: ink,
      borderWidth: 0.7,
    });
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
  cursor = drawFacts(page, card, left, contentWidth, cursor, fonts, ink);
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

function drawFacts(
  page: import("pdf-lib").PDFPage,
  card: CardModel,
  left: number,
  contentWidth: number,
  cursor: number,
  fonts: Fonts,
  ink: ReturnType<typeof import("pdf-lib").rgb>,
) {
  const facts: [string, string][] = [
    ["Światło", LIGHT_LABEL[card.light]],
    ["Woda", WATERING_LABEL[card.watering]],
    ["Mróz", card.hardinessC?.trim() || FROST_CAPTION[card.frostLabel]],
    ["Wys. × szer.", sizeLabel(card.height ?? "", card.width ?? "")],
  ];
  const column = contentWidth / facts.length;
  const valueSize = 8;
  const labelSize = 6.5;
  facts.forEach(([label, value], index) => {
    const center = left + column * index + column / 2;
    const shown = fitLine(value, fonts.bold, valueSize, column - mm(1.2));
    const valueWidth = fonts.bold.widthOfTextAtSize(shown, valueSize);
    page.drawText(shown, {
      x: center - valueWidth / 2,
      y: cursor - mm(3.2),
      size: valueSize,
      font: fonts.bold,
      color: ink,
    });
    const labelWidth = fonts.semibold.widthOfTextAtSize(label, labelSize);
    page.drawText(label, {
      x: center - labelWidth / 2,
      y: cursor - mm(7.2),
      size: labelSize,
      font: fonts.semibold,
      color: ink,
    });
  });
  return cursor - mm(10);
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
