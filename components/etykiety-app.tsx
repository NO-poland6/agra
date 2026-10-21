"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FileDown, Printer, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CareScaleEditor } from "@/components/care-scales";
import { EmptyCard, PlantCard, TwoUpSheet } from "@/components/plant-card";
import { PhotoPicker, type PhotoSearchStatus } from "@/components/photo-picker";
import { ScaledFrame } from "@/components/scaled-frame";
import { readCachedPlant, readRecent, writeCachedPlant, writeRecent, type RecentEntry } from "@/lib/cache";
import { cacheKey } from "@/lib/cache-key";
import {
  clearUploadData,
  readDraft,
  readPhotoChoice,
  readUploadData,
  writeDraft,
  writePhotoChoice,
  writeUploadData,
} from "@/lib/photo-cache";
import { formatPrice } from "@/lib/format";
import { parsePrice } from "@/lib/format";
import { findPlantById, interpretMatches, searchPlants, type MatchHit } from "@/lib/match";
import { normalize } from "@/lib/normalize";
import { BADGE_SUGGESTIONS, MONTH_ROMAN, parseBadges, withPlantDefaults } from "@/lib/shelf";
import { buildGeneratePayload } from "@/lib/plant-query";
import { isPhotoCandidate, photoProxyUrl, type PhotoCandidate } from "@/lib/photos";
import { PLANTS } from "@/lib/plants";
import type { CardModel, PlantInfo, PlantRecord, SourceKind } from "@/lib/types";

import { DEFAULT_VARIANT, LABEL_VARIANTS, VARIANT_STORAGE_KEY, labelVariant, type LabelVariant } from "@/lib/variants";

const SOURCE_LABEL: Record<SourceKind, string> = {
  catalog: "katalog szkółki",
  cache: "pamięć przeglądarki",
  ai: "opis AI",
  manual: "wpis ręczny",
};

function toInfo(plant: PlantRecord): PlantInfo {
  return {
    polishName: plant.polishName,
    latinName: plant.latinName,
    description: plant.description,
    watering: plant.watering,
    light: plant.light,
    frostLabel: plant.frostLabel,
    frostDetail: plant.frostDetail,
    plantType: plant.plantType,
    height: plant.height,
    width: plant.width,
    hardinessC: plant.hardinessC,
    bloomMonths: plant.bloomMonths,
    badges: plant.badges,
    waterFrom: plant.waterFrom,
    waterTo: plant.waterTo,
    lightFrom: plant.lightFrom,
    lightTo: plant.lightTo,
    usdaZone: plant.usdaZone,
  };
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function EtykietyApp() {
  const [variant, setVariant] = useState<LabelVariant>(DEFAULT_VARIANT);
  const [polishName, setPolishName] = useState("");
  const [latinName, setLatinName] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoCredit, setPhotoCredit] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<PhotoCandidate[]>([]);
  const [photoStatus, setPhotoStatus] = useState<PhotoSearchStatus>("idle");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [photoChoice, setPhotoChoice] = useState<"remote" | "none" | "upload" | "empty">("empty");
  const [hydrated, setHydrated] = useState(false);
  const [info, setInfo] = useState<PlantInfo | null>(null);
  const [source, setSource] = useState<SourceKind | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<MatchHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiOn, setAiOn] = useState(false);
  const [preview, setPreview] = useState<"a5" | "a4">("a5");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [clipped, setClipped] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const baseline = useRef("");
  const photoKey = useRef("");
  const photoMode = useRef<"remote" | "none" | "upload" | "empty">("empty");
  const searchGen = useRef(0);
  const candidatesRef = useRef<PhotoCandidate[]>([]);
  const currentPhotoRef = useRef<PhotoCandidate | null>(null);
  const plantNames = useRef({ polishName: "", latinName: "" });

  useEffect(() => {
    const restore = () => {
      let saved: string | null = null;
      try { saved = localStorage.getItem(VARIANT_STORAGE_KEY); } catch {}
      const next = labelVariant(new URLSearchParams(window.location.search).get("wariant")) ?? labelVariant(saved) ?? DEFAULT_VARIANT;
      setVariant(next);
      try { localStorage.setItem(VARIANT_STORAGE_KEY, next); } catch {}
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  function chooseVariant(value: string) {
    const next = labelVariant(value) ?? DEFAULT_VARIANT;
    setVariant(next);
    try { localStorage.setItem(VARIANT_STORAGE_KEY, next); } catch {}
    const url = new URL(window.location.href);
    url.searchParams.set("wariant", next);
    window.history.replaceState(null, "", url);
  }

  useEffect(() => {
    let cancelled = false;
    const draft = readDraft();
    queueMicrotask(() => {
      if (cancelled) return;
      setRecent(readRecent());
      if (draft?.info) {
        setInfo(withPlantDefaults(draft.info));
        setPolishName(draft.polishName);
        setLatinName(draft.latinName);
        setPriceInput(draft.priceInput);
        setSource(draft.source);
        setNotice(draft.notice);
        baseline.current = JSON.stringify(draft.info);
        photoKey.current = cacheKey(draft.info.polishName, draft.info.latinName);
        plantNames.current = { polishName: draft.info.polishName, latinName: draft.info.latinName };
        candidatesRef.current = draft.candidates;
        setCandidates(draft.candidates);
        if (draft.photoMode === "remote" && draft.photo) {
          photoMode.current = "remote";
          setPhotoChoice("remote");
          currentPhotoRef.current = draft.photo;
          setPhoto(photoProxyUrl(draft.photo.printUrl));
          setPhotoCredit(draft.photo.credit);
          setSelectedId(draft.photo.id);
          setPhotoStatus(draft.candidates.length ? "ready" : "idle");
        } else if (draft.photoMode === "upload") {
          const data = readUploadData();
          const saved = readPhotoChoice(draft.info.polishName, draft.info.latinName);
          if (data) {
            photoMode.current = "upload";
            setPhotoChoice("upload");
            setPhoto(data);
            setPhotoCredit(null);
            setSelectedId("upload");
            setPhotoStatus(draft.candidates.length ? "ready" : "idle");
          } else if (saved?.mode === "remote" && saved.photo) {
            photoMode.current = "remote";
            setPhotoChoice("remote");
            currentPhotoRef.current = saved.photo;
            setPhoto(photoProxyUrl(saved.photo.printUrl));
            setPhotoCredit(saved.photo.credit);
            setSelectedId(saved.photo.id);
            setPhotoStatus("ready");
          }
        } else if (draft.photoMode === "none") {
          photoMode.current = "none";
          setPhotoChoice("none");
          setSelectedId("none");
          setPhotoStatus(draft.candidates.length ? "ready" : "idle");
        }
      }
      setHydrated(true);
    });
    fetch("/api/status")
      .then((response) => response.json())
      .then((data: { configured?: boolean }) => {
        if (!cancelled) setAiOn(Boolean(data.configured));
      })
      .catch(() => {
        if (!cancelled) setAiOn(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const reset = () => {
      delete document.documentElement.dataset.print;
    };
    window.addEventListener("afterprint", reset);
    return () => window.removeEventListener("afterprint", reset);
  }, []);

  useEffect(() => {
    if (!info) return;
    const serialized = JSON.stringify(info);
    if (serialized === baseline.current) return;
    const handle = window.setTimeout(() => {
      if (info.description.trim().length < 40) return;
      writeCachedPlant(info, "edited");
      baseline.current = JSON.stringify(info);
      const priceValue = parsePrice(priceInput);
      if (priceValue) {
        writeRecent(info, priceValue);
        setRecent(readRecent());
      }
    }, 1200);
    return () => window.clearTimeout(handle);
  }, [info, priceInput]);

  useEffect(() => {
    if (!hydrated || !info) return;
    const handle = window.setTimeout(() => {
      writeDraft({
        polishName,
        latinName,
        priceInput,
        info,
        source,
        notice,
        photoMode: photoMode.current,
        photo: photoMode.current === "remote" ? currentPhotoRef.current : null,
        candidates: candidatesRef.current,
      });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [hydrated, info, latinName, notice, photo, photoChoice, photoCredit, polishName, priceInput, source, candidates]);

  const suggestions = useMemo(() => {
    if (normalize(polishName).length < 2) return [];
    return searchPlants(polishName, latinName).slice(0, 6);
  }, [polishName, latinName]);

  const price = parsePrice(priceInput);
  const card: CardModel | null = info && price ? { ...info, price, photoDataUrl: photo, photoCredit } : null;

  function applyRemote(candidate: PhotoCandidate, persist: boolean) {
    photoMode.current = "remote";
    setPhotoChoice("remote");
    setPhoto(photoProxyUrl(candidate.printUrl));
    setPhotoCredit(candidate.credit);
    setSelectedId(candidate.id);
    currentPhotoRef.current = candidate;
    if (persist) {
      writePhotoChoice(plantNames.current.polishName, plantNames.current.latinName, {
        mode: "remote",
        photo: candidate,
      });
    }
  }

  async function startPhotoSearch(plant: PlantInfo, force = false) {
    const key = cacheKey(plant.polishName, plant.latinName);
    const previous = photoKey.current;
    const changed = previous !== key;
    if (!force && !changed && candidatesRef.current.length > 0 && photoMode.current !== "empty") return;
    photoKey.current = key;
    plantNames.current = { polishName: plant.polishName, latinName: plant.latinName };
    if (changed && previous && photoMode.current === "upload") {
      photoMode.current = "empty";
      setPhotoChoice("empty");
      setPhoto(null);
      setPhotoCredit(null);
      setSelectedId(null);
      clearUploadData();
    }
    const saved = readPhotoChoice(plant.polishName, plant.latinName);
    if (photoMode.current !== "upload") {
      if (!force && saved?.mode === "none") {
        photoMode.current = "none";
        setPhotoChoice("none");
        setPhoto(null);
        setPhotoCredit(null);
        setSelectedId("none");
        currentPhotoRef.current = null;
      } else if (!force && saved?.mode === "remote" && saved.photo) {
        applyRemote(saved.photo, false);
      } else if (changed || photoMode.current !== "remote") {
        photoMode.current = "empty";
        setPhotoChoice("empty");
        setPhoto(null);
        setPhotoCredit(null);
        setSelectedId(null);
        currentPhotoRef.current = null;
      }
    }
    if (changed) {
      const seed = saved?.mode === "remote" && saved.photo ? [saved.photo] : [];
      candidatesRef.current = seed;
      setCandidates(seed);
    }
    const gen = ++searchGen.current;
    setPhotoStatus("loading");
    try {
      const response = await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildGeneratePayload({ polishName: plant.polishName, latinName: plant.latinName })),
      });
      let data: { photos?: unknown } = {};
      try {
        data = (await response.json()) as { photos?: unknown };
      } catch {
        data = {};
      }
      if (gen !== searchGen.current) return;
      const photos = Array.isArray(data.photos) ? data.photos.filter(isPhotoCandidate) : [];
      const extra = photoMode.current === "remote" ? currentPhotoRef.current : null;
      const merged = extra && !photos.some((item) => item.id === extra.id) ? [extra, ...photos].slice(0, 8) : photos;
      candidatesRef.current = merged;
      setCandidates(merged);
      if (!response.ok && merged.length === 0) {
        setPhotoStatus("error");
        return;
      }
      setPhotoStatus(merged.length ? "ready" : "empty");
      if (photoMode.current === "empty" && photos[0]) applyRemote(photos[0], true);
    } catch {
      if (gen !== searchGen.current) return;
      setPhotoStatus(photoMode.current === "remote" || photoMode.current === "upload" ? "ready" : "error");
    }
  }

  function apply(plant: PlantInfo, nextSource: SourceKind, nextNotice: string, priceValue: number) {
    const ready = withPlantDefaults(plant);
    setInfo(ready);
    setPolishName(plant.polishName);
    setLatinName(plant.latinName);
    setSource(nextSource);
    setNotice(nextNotice);
    setChoices(null);
    setError(null);
    baseline.current = JSON.stringify(ready);
    writeRecent(ready, priceValue);
    setRecent(readRecent());
    setPreview("a5");
    void startPhotoSearch(ready);
  }

  function openManual(names: { polishName: string; latinName: string }, message: string, priceValue: number) {
    const plant: PlantInfo = {
      polishName: names.polishName,
      latinName: names.latinName,
      description: "",
      watering: "moderate",
      light: "partial",
      frostLabel: "wymaga okrycia",
      frostDetail: "",
      plantType: "",
      height: "",
      width: "",
      hardinessC: "",
      bloomMonths: [],
      badges: [],
      waterFrom: 0,
      waterTo: 0,
      lightFrom: 0,
      lightTo: 0,
      usdaZone: "",
    };
    apply(plant, "manual", message, priceValue);
  }

  async function prepare(options?: { forceAI?: boolean; plant?: PlantRecord }) {
    setPdfError(null);
    const priceValue = parsePrice(priceInput);
    if (!priceValue) {
      setError("Podaj cenę większą od zera, na przykład 19,99.");
      return;
    }
    const names = { polishName: polishName.trim(), latinName: latinName.trim() };
    if (!options?.plant && !names.polishName && !names.latinName) {
      setError("Wpisz polską albo łacińską nazwę rośliny.");
      return;
    }
    if (options?.plant) {
      apply(toInfo(options.plant), "catalog", "Opis z katalogu szkółki. Możesz poprawić każde pole przed drukiem.", priceValue);
      return;
    }
    if (!options?.forceAI) {
      const cached = readCachedPlant(names.polishName, names.latinName);
      if (cached) {
        apply(
          cached.info,
          "cache",
          cached.origin === "ai"
            ? "Opis z pamięci tej przeglądarki, wcześniej pobrany z AI. Sprawdź, czy nadal się zgadza."
            : "Przywrócono poprawioną wersję zapisaną w tej przeglądarce.",
          priceValue,
        );
        return;
      }
      const found = interpretMatches(searchPlants(names.polishName, names.latinName));
      if (found.type === "one") {
        apply(toInfo(found.plant), "catalog", "Opis z katalogu szkółki. Możesz poprawić każde pole przed drukiem.", priceValue);
        return;
      }
      if (found.type === "many") {
        setChoices(found.plants);
        setError(null);
        setNotice("W katalogu jest kilka podobnych roślin. Wybierz właściwą albo wpisz opis ręcznie.");
        return;
      }
    }

    if (options?.forceAI || aiOn) {
      setBusy(true);
      setError(null);
      try {
        const payload = buildGeneratePayload(names);
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await response.json()) as { plant?: PlantInfo; warnings?: string[]; error?: string };
        if (!response.ok || !data.plant) {
          setError(data.error || "Nie udało się pobrać opisu.");
          openManual(names, "Uzupełnij etykietę ręcznie.", priceValue);
          return;
        }
        writeCachedPlant(data.plant, "ai");
        const warning =
          data.warnings && data.warnings.length
            ? `Opis z AI. ${data.warnings.join(" ")}`
            : "Opis przygotowany przez AI. Sprawdź go przed drukiem — model bywa niedokładny.";
        apply(data.plant, "ai", warning, priceValue);
      } catch {
        setError("Brak połączenia z usługą opisu.");
        openManual(names, "Uzupełnij etykietę ręcznie.", priceValue);
      } finally {
        setBusy(false);
      }
      return;
    }

    openManual(
      names,
      "Tej rośliny nie ma w katalogu. Wpisz opis i pielęgnację ręcznie. Klucz AI nie jest ustawiony.",
      priceValue,
    );
  }

  function loadExample() {
    const plant = findPlantById("lawenda-waskolistna");
    if (!plant) return;
    setPriceInput("19,99");
    setPolishName(plant.polishName);
    setLatinName(plant.latinName);
    apply(toInfo(plant), "catalog", "Przykład z katalogu: lawenda wąskolistna za 19,99 zł.", 19.99);
  }

  function restoreCatalog() {
    if (!info) return;
    const found = interpretMatches(searchPlants(info.polishName, info.latinName));
    const priceValue = parsePrice(priceInput);
    if (found.type !== "one" || !priceValue) return;
    apply(toInfo(found.plant), "catalog", "Przywrócono opis z katalogu szkółki.", priceValue);
  }

  function patch(partial: Partial<PlantInfo>) {
    setInfo((current) => (current ? { ...current, ...partial } : current));
  }

  function onPhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Wybierz plik graficzny, na przykład JPG albo PNG.");
      return;
    }
    if (file.size > 2.5 * 1024 * 1024) {
      setError("Zdjęcie jest za duże. Wybierz plik do 2,5 MB.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      photoMode.current = "upload";
      setPhotoChoice("upload");
      setPhoto(reader.result);
      setPhotoCredit(null);
      setSelectedId("upload");
      writeUploadData(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function chooseCandidate(candidate: PhotoCandidate) {
    plantNames.current = {
      polishName: info?.polishName || polishName,
      latinName: info?.latinName || latinName,
    };
    applyRemote(candidate, true);
  }

  function clearPhoto() {
    photoMode.current = "none";
    setPhotoChoice("none");
    setPhoto(null);
    setPhotoCredit(null);
    setSelectedId("none");
    currentPhotoRef.current = null;
    clearUploadData();
    const names = plantNames.current.polishName || plantNames.current.latinName ? plantNames.current : { polishName, latinName };
    if (names.polishName || names.latinName) writePhotoChoice(names.polishName, names.latinName, { mode: "none" });
  }

  function printSheet(mode: "a5" | "a4") {
    if (!card || !info) return;
    writeRecent(info, card.price);
    const style = document.getElementById("print-page-size") ?? document.createElement("style");
    style.id = "print-page-size";
    style.textContent =
      mode === "a4" ? "@page { size: 297mm 210mm; margin: 0; }" : "@page { size: 148mm 210mm; margin: 0; }";
    document.head.appendChild(style);
    document.documentElement.dataset.print = mode;
    window.print();
  }

  async function savePdf(mode: "a5" | "a4") {
    if (!card || !info) return;
    setPdfError(null);
    writeRecent(info, card.price);
    try {
      const { downloadCardPdf } = await import("@/lib/pdf");
      await downloadCardPdf(card, mode, variant);
    } catch {
      setPdfError("Nie udało się zbudować PDF. Użyj przycisku drukowania i wybierz „Zapisz jako PDF”.");
    }
  }

  function loadRecent(entry: RecentEntry) {
    setPriceInput(formatPrice(entry.price).replace(/\s*zł\s*$/u, "").trim());
    apply(withPlantDefaults(entry.info), "cache", "Wczytano ostatnią etykietę z tej przeglądarki.", entry.price);
  }

  const catalogPlant = info
    ? interpretMatches(searchPlants(info.polishName, info.latinName))
    : null;
  const catalogAgain =
    info &&
    catalogPlant?.type === "one" &&
    JSON.stringify(toInfo(catalogPlant.plant)) !== JSON.stringify(info);

  return (
    <>
      <div className="screen-ui min-h-screen">
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-md border border-primary text-primary" aria-hidden>
                <Sprout className="size-6" />
              </span>
              <div>
                <p className="text-[0.7rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                  Kłodzko · od 1991 r.
                </p>
                <h1 className="font-display text-2xl leading-none text-foreground">AGRA PSK</h1>
              </div>
            </div>
            <div className="text-right">
              <p className="hidden text-sm font-medium sm:block">Etykiety roślin na półkę</p>
              <p className="text-xs text-muted-foreground">{aiOn ? "Opis AI włączony" : `Katalog: ${PLANTS.length} roślin`}</p>
            </div>
          </div>
        </header>

        <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <section className="grid content-start gap-5">
            <form
              className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-sm"
              onSubmit={(event) => {
                event.preventDefault();
                void prepare();
              }}
            >
              <div>
                <h2 className="font-display text-xl">Nowa etykieta</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Wpisz nazwę rośliny i cenę. Do opisu AI i do wyszukiwarki zdjęć wędruje wyłącznie nazwa — cena zostaje w tej przeglądarce.
                </p>
              </div>

              <div className="relative">
                <Field label="Nazwa polska" htmlFor="nazwa-polska">
                  <Input
                    id="nazwa-polska"
                    className="h-10 bg-background"
                    value={polishName}
                    autoComplete="off"
                    placeholder="np. Lawenda wąskolistna"
                    onFocus={() => setSuggestionsOpen(true)}
                    onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 160)}
                    onChange={(event) => {
                      setPolishName(event.target.value);
                      setSuggestionsOpen(true);
                    }}
                  />
                </Field>
                {suggestionsOpen && suggestions.length > 0 ? (
                  <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-popover shadow-md">
                    {suggestions.map((hit) => (
                      <li key={hit.plant.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-accent"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setPolishName(hit.plant.polishName);
                            setLatinName(hit.plant.latinName);
                            setSuggestionsOpen(false);
                            if (parsePrice(priceInput)) void prepare({ plant: hit.plant });
                          }}
                        >
                          <span className="block text-sm font-medium">{hit.plant.polishName}</span>
                          <span className="block text-xs text-muted-foreground">
                            {hit.plant.latinName} · {hit.plant.plantType}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <Field label="Nazwa łacińska" htmlFor="nazwa-lacinska" hint="Opcjonalnie. Pomaga wybrać właściwy gatunek.">
                <Input
                  id="nazwa-lacinska"
                  className="h-10 bg-background"
                  value={latinName}
                  autoComplete="off"
                  placeholder="np. Lavandula angustifolia"
                  onChange={(event) => setLatinName(event.target.value)}
                />
              </Field>

              <Field label="Cena" htmlFor="cena" hint="W złotych, na przykład 19,99.">
                <Input
                  id="cena"
                  className="h-10 bg-background"
                  inputMode="decimal"
                  value={priceInput}
                  placeholder="19,99"
                  onChange={(event) => setPriceInput(event.target.value)}
                />
              </Field>

              <PhotoPicker
                status={photoStatus}
                candidates={candidates}
                selectedId={selectedId}
                credit={photoCredit}
                onSelect={chooseCandidate}
                onClear={clearPhoto}
                onUpload={onPhoto}
                onRetry={() => {
                  if (info) void startPhotoSearch(info, true);
                }}
              />

              {error ? (
                <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                  {error}
                </p>
              ) : null}

              <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={busy}>
                {busy ? "Przygotowuję opis…" : "Przygotuj etykietę"}
              </Button>
              <div className="flex flex-wrap gap-2">
                {aiOn ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10"
                    disabled={busy}
                    onClick={() => void prepare({ forceAI: true })}
                  >
                    Poproś AI o nowy opis
                  </Button>
                ) : null}
                <Button type="button" variant="ghost" className="h-10" onClick={loadExample}>
                  Przykład: lawenda, 19,99 zł
                </Button>
              </div>
            </form>

            {recent.length > 0 ? (
              <div>
                <h3 className="mb-2 text-sm font-medium">Ostatnie etykiety</h3>
                <div className="flex flex-wrap gap-2">
                  {recent.map((entry) => (
                    <Button
                      key={entry.key}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => loadRecent(entry)}
                    >
                      {entry.info.polishName || entry.info.latinName} · {formatPrice(entry.price)}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            {choices ? (
              <div className="grid gap-2 rounded-xl border border-border bg-card p-4">
                <h3 className="font-medium">Wybierz roślinę z katalogu</h3>
                {choices.map((hit) => (
                  <button
                    key={hit.plant.id}
                    type="button"
                    className="rounded-lg border border-border px-3 py-2 text-left hover:bg-accent"
                    onClick={() => void prepare({ plant: hit.plant })}
                  >
                    <span className="block font-medium">{hit.plant.polishName}</span>
                    <span className="block text-sm text-muted-foreground">
                      {hit.plant.latinName} · {hit.plant.plantType}
                      {hit.plant.height ? ` · ${hit.plant.height}` : ""}
                    </span>
                  </button>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    const priceValue = parsePrice(priceInput);
                    if (!priceValue) return;
                    openManual(
                      { polishName: polishName.trim(), latinName: latinName.trim() },
                      "Wpis ręczny. Uzupełnij opis i pielęgnację.",
                      priceValue,
                    );
                  }}
                >
                  Żadna z tych — wpiszę ręcznie
                </Button>
              </div>
            ) : null}

            {info ? (
              <div className="grid gap-4 rounded-xl border border-border bg-card p-4">
                <div>
                  <h2 className="font-display text-xl">Popraw przed drukiem</h2>
                  {source ? (
                    <p className="mt-1 text-sm text-muted-foreground">Źródło: {SOURCE_LABEL[source]}</p>
                  ) : null}
                  {notice ? <p className="mt-2 text-sm">{notice}</p> : null}
                  {catalogAgain ? (
                    <Button type="button" variant="ghost" size="sm" className="mt-1 px-0" onClick={restoreCatalog}>
                      Przywróć opis z katalogu
                    </Button>
                  ) : null}
                </div>

                <Field label="Nazwa na etykiecie" htmlFor="edit-nazwa">
                  <Input
                    id="edit-nazwa"
                    className="h-10 bg-background"
                    value={info.polishName}
                    onChange={(event) => {
                      patch({ polishName: event.target.value });
                      setPolishName(event.target.value);
                    }}
                  />
                </Field>
                <Field label="Nazwa łacińska na etykiecie" htmlFor="edit-lacina">
                  <Input
                    id="edit-lacina"
                    className="h-10 bg-background"
                    value={info.latinName}
                    onChange={(event) => {
                      patch({ latinName: event.target.value });
                      setLatinName(event.target.value);
                    }}
                  />
                </Field>
                <Field label="Opis" htmlFor="edit-opis">
                  <Textarea
                    id="edit-opis"
                    className="min-h-28 bg-background"
                    value={info.description}
                    onChange={(event) => patch({ description: event.target.value })}
                  />
                </Field>
                {clipped ? (
                  <p className="text-sm text-destructive">
                    Opis ma więcej niż dwie linijki i na karcie zostanie skrócony.
                  </p>
                ) : null}
                <div className="grid gap-2">
                  <p className="text-sm font-medium">Miesiące kwitnienia</p>
                  <div className="flex flex-wrap gap-1">
                    {MONTH_ROMAN.map((label, index) => {
                      const month = index + 1;
                      const on = info.bloomMonths.includes(month);
                      return (
                        <button
                          key={label}
                          type="button"
                          aria-pressed={on}
                          className={
                            on
                              ? "h-8 min-w-8 rounded-md bg-primary px-1.5 text-xs font-semibold text-primary-foreground"
                              : "h-8 min-w-8 rounded-md border border-border bg-background px-1.5 text-xs"
                          }
                          onClick={() => {
                            const bloomMonths = on
                              ? info.bloomMonths.filter((item) => item !== month)
                              : [...info.bloomMonths, month].sort((left, right) => left - right);
                            patch({ bloomMonths });
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Field label="Cechy" htmlFor="edit-cechy" hint="Krótkie plakietki, oddzielone przecinkami.">
                  <Input
                    id="edit-cechy"
                    className="h-10 bg-background"
                    value={info.badges.join(", ")}
                    onChange={(event) => patch({ badges: parseBadges(event.target.value) })}
                  />
                </Field>
                <div className="flex flex-wrap gap-1">
                  {BADGE_SUGGESTIONS.map((badge) => {
                    const on = info.badges.some((item) => item.toLocaleLowerCase("pl") === badge);
                    return (
                      <button
                        key={badge}
                        type="button"
                        className="rounded-full border border-border px-2 py-1 text-xs hover:bg-accent"
                        aria-pressed={on}
                        onClick={() => {
                          const badges = on
                            ? info.badges.filter((item) => item.toLocaleLowerCase("pl") !== badge)
                            : parseBadges([...info.badges, badge].join(", "));
                          patch({ badges });
                        }}
                      >
                        {badge}
                      </button>
                    );
                  })}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Typ rośliny" htmlFor="edit-typ">
                    <Input
                      id="edit-typ"
                      className="h-10 bg-background"
                      value={info.plantType}
                      onChange={(event) => patch({ plantType: event.target.value })}
                    />
                  </Field>
                  <Field label="Wysokość" htmlFor="edit-wysokosc">
                    <Input
                      id="edit-wysokosc"
                      className="h-10 bg-background"
                      value={info.height}
                      onChange={(event) => patch({ height: event.target.value })}
                    />
                  </Field>
                  <Field label="Szerokość" htmlFor="edit-szerokosc">
                    <Input
                      id="edit-szerokosc"
                      className="h-10 bg-background"
                      value={info.width}
                      onChange={(event) => patch({ width: event.target.value })}
                    />
                  </Field>
                  <Field label="Mróz, temperatura" htmlFor="edit-mroz" hint="Najniższa temperatura, np. −20 °C. Puste, gdy nie znasz liczby.">
                    <Input
                      id="edit-mroz"
                      className="h-10 bg-background"
                      value={info.hardinessC}
                      onChange={(event) => patch({ hardinessC: event.target.value })}
                    />
                  </Field>
                  <Field label="Strefa USDA" htmlFor="edit-strefa" hint="Na przykład 6b. Puste, gdy nieznana.">
                    <Input
                      id="edit-strefa"
                      className="h-10 bg-background"
                      value={info.usdaZone}
                      onChange={(event) => patch({ usdaZone: event.target.value })}
                    />
                  </Field>
                </div>
                <CareScaleEditor info={info} onChange={patch} />
                <Field label="Dopisek o zimie" htmlFor="edit-mroz-szczegoly" hint="Tylko dopisek, na przykład: okryć młode rośliny na zimę.">
                  <Input
                    id="edit-mroz-szczegoly"
                    className="h-10 bg-background"
                    value={info.frostDetail}
                    onChange={(event) => patch({ frostDetail: event.target.value })}
                  />
                </Field>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" className="h-11" disabled={!card} onClick={() => printSheet("a5")}>
                    <Printer />
                    Drukuj kartę A5
                  </Button>
                  <Button type="button" variant="outline" className="h-11" disabled={!card} onClick={() => printSheet("a4")}>
                    <Printer />
                    Dwie karty na A4
                  </Button>
                  <Button type="button" variant="outline" className="h-10" disabled={!card} onClick={() => void savePdf("a5")}>
                    <FileDown />
                    PDF — karta A5
                  </Button>
                  <Button type="button" variant="outline" className="h-10" disabled={!card} onClick={() => void savePdf("a4")}>
                    <FileDown />
                    PDF — dwie na A4
                  </Button>
                </div>
                {pdfError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {pdfError}
                  </p>
                ) : null}
                <p className="text-xs leading-relaxed text-muted-foreground">
                  W oknie drukowania ustaw skalę 100% (rzeczywisty rozmiar), marginesy: brak, i wyłącz nagłówki oraz stopki.
                  Karta jest czytelna na drukarce czarno-białej. Kremowe tło pojawi się tylko po włączeniu grafiki w tle.
                </p>
              </div>
            ) : null}
          </section>

          <section className="lg:sticky lg:top-4 lg:self-start">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl">Podgląd wydruku</h2>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={preview === "a5" ? "default" : "outline"} onClick={() => setPreview("a5")}>
                  Karta A5
                </Button>
                <Button type="button" size="sm" variant={preview === "a4" ? "default" : "outline"} onClick={() => setPreview("a4")}>
                  Arkusz A4
                </Button>
              </div>
            </div>
            <div className="mb-3 grid gap-1.5">
              <Label htmlFor="label-variant">Wygląd etykiety</Label>
              <select id="label-variant" className="h-11 rounded-md border border-border bg-background px-3 text-sm" value={variant} onChange={(event) => chooseVariant(event.target.value)}>
                {Object.entries(LABEL_VARIANTS).map(([key, name]) => <option key={key} value={key}>{key.toUpperCase()} — {name}</option>)}
              </select>
            </div>
            <div className="rounded-xl bg-[#d5cec1] p-3 sm:p-5">
              {preview === "a5" ? (
                <ScaledFrame widthMm={148} heightMm={210}>
                  <div className="shadow-[0_12px_28px_rgba(40,32,20,0.18)]">
                    {card ? <PlantCard variant={variant} card={card} onOverflow={setClipped} /> : <EmptyCard />}
                  </div>
                </ScaledFrame>
              ) : card ? (
                <ScaledFrame widthMm={297} heightMm={210}>
                  <div className="shadow-[0_12px_28px_rgba(40,32,20,0.18)]">
                    <TwoUpSheet variant={variant} card={card} />
                  </div>
                </ScaledFrame>
              ) : (
                <p className="py-16 text-center text-sm">Najpierw przygotuj etykietę — wtedy pokażemy dwie karty na arkuszu.</p>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {preview === "a5"
                ? "Pojedyncza karta A5, 148 × 210 mm. Na ekranie jest pomniejszona, druk idzie w skali 1:1."
                : "Arkusz A4 poziomo: dwie karty A5 obok siebie i przerywana linia cięcia pośrodku."}
            </p>
          </section>
        </main>
      </div>

      {card ? (
        <>
          <div className="print-only sheet-a5">
            <PlantCard variant={variant} card={card} />
          </div>
          <div className="print-only sheet-a4">
            <TwoUpSheet variant={variant} card={card} />
          </div>
        </>
      ) : null}
    </>
  );
}
