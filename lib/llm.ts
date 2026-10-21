import { buildUserPrompt, type PlantQuery } from "./plant-query";
import { extractJson, parsePlantResponse, type ParsedPlant } from "./parse-plant";

export type LlmProvider = "openai" | "anthropic";

export type LlmConfig = {
  provider: LlmProvider;
  apiKey: string;
  base: string;
  model: string;
};

const SYSTEM_PROMPT = `Jesteś botanikiem piszącym krótkie etykiety do sklepu ogrodniczego w Kłodzku (Kotlin Kłodzka, przedgórze Sudetów; zimą bywa około -20 °C).
Zwróć wyłącznie jeden obiekt JSON, bez markdown i bez komentarza, o kluczach:
- polishName: string, polska nazwa zwyczajowa
- latinName: string, nazwa łacińska; pusty string, jeśli naprawdę nieznana
- description: string, 2 do 4 zdań po polsku: co to za roślina, wartość ozdobna albo użytkowa, jedna konkretna wskazówka pielęgnacji
- watering: "low" albo "moderate" albo "high"
- light: "sun" albo "partial" albo "shade"
- frostLabel: "mrozoodporna" albo "wymaga okrycia" albo "nie zimuje w gruncie"
- frostDetail: string, np. "mrozoodporna do ok. -25 °C (strefa USDA 5)"
- plantType: string, np. "bylina", "krzew", "iglaki", "drzewo owocowe", "roślina balkonowa", "roślina doniczkowa", "zioło"
- height: string, np. "40–60 cm"; pusty string, jeśli nieznana
- width: string, szerokość dorosłej rośliny, np. "40–50 cm"; pusty string, jeśli nieznana
- hardinessC: string, krótko, np. "−20 °C"; pusty string, jeśli roślina nie zimuje w gruncie albo liczba jest nieznana
- bloomMonths: tablica liczb 1–12 (miesiące kwitnienia albo głównej ozdoby); pusta tablica, jeśli nie kwitnie albo nie wiadomo
- badges: tablica do czterech krótkich cech po polsku, tylko gdy pasują, z listy: "miododajna", "zimozielona", "do pojemników", "jadalna", "przyciąga motyle", "trująca dla zwierząt", "pachnąca", "okrywowa", "na żywopłot", "na kwiat cięty", "odporna na suszę", "do wnętrz"
Pisz rzeczowo, bez wykrzykników i bez obietnic w rodzaju „idealna do każdego ogrodu”. Nie podawaj ceny i nie dodawaj innych kluczy. Gdy nazwa jest niejednoznaczna, wybierz gatunek najczęściej sprzedawany w polskich szkółkach i doprecyzuj go w polishName. Nie wymyślaj nazwy odmiany, jeśli jej nie podano.`;

export function resolveLlmConfig(env: Record<string, string | undefined>): LlmConfig | null {
  const provider: LlmProvider =
    (env.LLM_PROVIDER || "openai").trim().toLowerCase() === "anthropic" ? "anthropic" : "openai";
  const apiKey = (env.LLM_API_KEY || (provider === "openai" ? env.OPENAI_API_KEY : "") || "").trim();
  if (!apiKey) return null;
  const model = (
    env.LLM_MODEL || (provider === "anthropic" ? "claude-3-5-haiku-latest" : "gpt-4o-mini")
  ).trim();
  const base = (
    env.LLM_API_BASE ||
    (provider === "anthropic" ? "https://api.anthropic.com" : "https://api.openai.com/v1")
  )
    .trim()
    .replace(/\/$/, "");
  return { provider, apiKey, base, model };
}

export function isLlmConfigured(env: Record<string, string | undefined>): boolean {
  return resolveLlmConfig(env) !== null;
}

/** Jawny odczyt zmiennych. Next nie podstawia całego process.env. */
export function readLlmEnv(env: NodeJS.ProcessEnv): Record<string, string | undefined> {
  return {
    LLM_API_KEY: env.LLM_API_KEY,
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    LLM_PROVIDER: env.LLM_PROVIDER,
    LLM_API_BASE: env.LLM_API_BASE,
    LLM_MODEL: env.LLM_MODEL,
  };
}

function chatCompletionsUrl(base: string): string {
  if (base.endsWith("/chat/completions")) return base;
  return `${base}/chat/completions`;
}

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join("");
  }
  return "";
}

async function readErrorStatus(response: Response): Promise<number> {
  return response.status;
}

async function completeOpenAi(config: LlmConfig, prompt: string, jsonMode: boolean): Promise<string> {
  const response = await fetch(chatCompletionsUrl(config.base), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(25_000),
    body: JSON.stringify({
      model: config.model,
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!response.ok) {
    const error = new Error(`upstream ${await readErrorStatus(response)}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  const payload = (await response.json()) as {
    choices?: { message?: { content?: unknown } }[];
  };
  return messageText(payload.choices?.[0]?.message?.content);
}

async function completeAnthropic(config: LlmConfig, prompt: string): Promise<string> {
  const root = config.base.replace(/\/v1$/, "");
  const response = await fetch(`${root}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(25_000),
    body: JSON.stringify({
      model: config.model,
      max_tokens: 900,
      temperature: 0.3,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) {
    const error = new Error(`upstream ${response.status}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  const payload = (await response.json()) as { content?: unknown };
  return messageText(payload.content);
}

export async function generatePlantInfo(
  config: LlmConfig,
  query: PlantQuery,
): Promise<{ ok: true; parsed: ParsedPlant } | { ok: false; error: string }> {
  const prompt = buildUserPrompt(query);
  try {
    let text = "";
    if (config.provider === "anthropic") {
      text = await completeAnthropic(config, prompt);
    } else {
      try {
        text = await completeOpenAi(config, prompt, true);
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (status === 400) text = await completeOpenAi(config, prompt, false);
        else throw error;
      }
    }
    const parsed = parsePlantResponse(extractJson(text), query);
    if (!parsed) {
      return { ok: false, error: "Model zwrócił opis, którego nie dało się odczytać. Uzupełnij etykietę ręcznie." };
    }
    return { ok: true, parsed };
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (error instanceof Error && error.name === "TimeoutError") {
      return { ok: false, error: "Usługa opisu nie odpowiedziała w czasie. Spróbuj ponownie albo wpisz tekst ręcznie." };
    }
    if (status) {
      return {
        ok: false,
        error: `Usługa opisu zwróciła błąd (${status}). Sprawdź klucz, adres API i nazwę modelu.`,
      };
    }
    return { ok: false, error: "Nie udało się pobrać opisu. Sprawdź połączenie albo wpisz etykietę ręcznie." };
  }
}
