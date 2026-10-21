import { cacheKey } from "./cache-key";
import { isPhotoCandidate, type PhotoCandidate } from "./photos";
import type { PlantInfo, SourceKind } from "./types";

export type StoredPhotoChoice = {
  key: string;
  mode: "remote" | "none";
  photo: PhotoCandidate | null;
  savedAt: number;
};

export type CardDraft = {
  polishName: string;
  latinName: string;
  priceInput: string;
  info: PlantInfo;
  source: SourceKind | null;
  notice: string | null;
  photoMode: "remote" | "none" | "upload" | "empty";
  photo: PhotoCandidate | null;
  candidates: PhotoCandidate[];
};

const CHOICE_STORAGE = "agra-psk.zdjecia.v1";
const DRAFT_STORAGE = "agra-psk.szkic.v1";
const UPLOAD_STORAGE = "agra-psk.wlasne-zdjecie.v1";
const CHOICE_LIMIT = 200;

function readJson(storage: Storage, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function choiceList(): StoredPhotoChoice[] {
  if (typeof window === "undefined") return [];
  const parsed = readJson(window.localStorage, CHOICE_STORAGE);
  return Array.isArray(parsed) ? (parsed as StoredPhotoChoice[]) : [];
}

export function readPhotoChoice(polishName: string, latinName: string): StoredPhotoChoice | null {
  const key = cacheKey(polishName, latinName);
  if (key === "|") return null;
  const found = choiceList().find((entry) => entry && entry.key === key);
  if (!found || (found.mode !== "remote" && found.mode !== "none")) return null;
  if (found.mode === "remote") {
    if (!isPhotoCandidate(found.photo)) return null;
    return { key, mode: "remote", photo: found.photo, savedAt: found.savedAt || Date.now() };
  }
  return { key, mode: "none", photo: null, savedAt: found.savedAt || Date.now() };
}

export function writePhotoChoice(polishName: string, latinName: string, choice: { mode: "remote"; photo: PhotoCandidate } | { mode: "none" }) {
  if (typeof window === "undefined") return;
  const key = cacheKey(polishName, latinName);
  if (key === "|") return;
  const next: StoredPhotoChoice = {
    key,
    mode: choice.mode,
    photo: choice.mode === "remote" ? choice.photo : null,
    savedAt: Date.now(),
  };
  const rest = choiceList().filter((entry) => entry.key !== key);
  try {
    window.localStorage.setItem(CHOICE_STORAGE, JSON.stringify([next, ...rest].slice(0, CHOICE_LIMIT)));
  } catch {
    // Pełna pamięć przeglądarki — wybór zostaje na ekranie do odświeżenia.
  }
}

function isDraft(value: unknown): value is CardDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as CardDraft;
  if (!draft.info || typeof draft.info.polishName !== "string") return false;
  if (typeof draft.priceInput !== "string") return false;
  if (!Array.isArray(draft.candidates)) return false;
  return true;
}

export function readDraft(): CardDraft | null {
  if (typeof window === "undefined") return null;
  const parsed = readJson(window.localStorage, DRAFT_STORAGE);
  if (!isDraft(parsed)) return null;
  const photo = isPhotoCandidate(parsed.photo) ? parsed.photo : null;
  const candidates = parsed.candidates.filter(isPhotoCandidate).slice(0, 8);
  const photoMode =
    parsed.photoMode === "remote" || parsed.photoMode === "none" || parsed.photoMode === "upload" || parsed.photoMode === "empty"
      ? parsed.photoMode
      : "empty";
  return { ...parsed, photo: photoMode === "remote" ? photo : null, candidates, photoMode };
}

export function writeDraft(draft: CardDraft) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_STORAGE, JSON.stringify(draft));
  } catch {
    // Szkic jest wygodny, ale etykieta na ekranie nie zależy od zapisu.
  }
}

export function readUploadData(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(UPLOAD_STORAGE);
    return value && value.startsWith("data:image/") && value.length < 4_000_000 ? value : null;
  } catch {
    return null;
  }
}

export function writeUploadData(dataUrl: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(UPLOAD_STORAGE, dataUrl);
  } catch {
    // Zdjęcie i tak jest na karcie w tej sesji.
  }
}

export function clearUploadData() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(UPLOAD_STORAGE);
  } catch {
    // Nic do sprzątania.
  }
}
