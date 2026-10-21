import assert from "node:assert/strict";
import { test } from "node:test";
import { formatPrice, formatPriceParts, parsePrice } from "./format";
import { interpretMatches, searchPlants } from "./match";
import { normalize } from "./normalize";
import { extractJson, parsePlantResponse } from "./parse-plant";
import { buildGeneratePayload, buildUserPrompt, plantQueryFromBody } from "./plant-query";
import { PLANTS } from "./plants";
import { FROST_LABELS, LIGHT, WATERING } from "./types";

test("katalog ma pokrycie szkółki i unikalne identyfikatory", () => {
  assert.ok(PLANTS.length >= 90 && PLANTS.length <= 140);
  const ids = new Set(PLANTS.map((plant) => plant.id));
  assert.equal(ids.size, PLANTS.length);
  for (const plant of PLANTS) {
    assert.ok(plant.polishName.length > 2);
    assert.ok(plant.latinName.length > 2);
    assert.ok(plant.description.length >= 120 && plant.description.length <= 520);
    assert.ok((plant.description.match(/[.!?]/g) || []).length >= 2);
    assert.ok(WATERING.includes(plant.watering));
    assert.ok(LIGHT.includes(plant.light));
    assert.ok(FROST_LABELS.includes(plant.frostLabel));
  }
});

test("lawenda wąskolistna znajduje się po nazwie bez ogonków", () => {
  const found = interpretMatches(searchPlants("Lawenda waskolistna"));
  assert.equal(found.type, "one");
  if (found.type === "one") assert.equal(found.plant.id, "lawenda-waskolistna");
});

test("sama lawenda daje wybór, a tuja szmaragd wskazuje odmianę", () => {
  assert.equal(interpretMatches(searchPlants("lawenda")).type, "many");
  const thuja = interpretMatches(searchPlants("tuja szmaragd"));
  assert.equal(thuja.type, "one");
  if (thuja.type === "one") assert.equal(thuja.plant.id, "tuja-smaragd");
});

test("cena po polsku", () => {
  assert.equal(parsePrice("19,99"), 19.99);
  assert.equal(parsePrice("19.99 zł"), 19.99);
  assert.equal(parsePrice("0"), null);
  assert.equal(parsePrice("abc"), null);
  assert.equal(formatPrice(19.99), "19,99 zł");
  assert.equal(formatPriceParts(19.9).amount, "19,90");
});

test("do modelu idzie tylko nazwa rośliny", () => {
  const payload = buildGeneratePayload({
    polishName: "  Lawenda wąskolistna ",
    latinName: "Lavandula angustifolia",
  });
  assert.deepEqual(payload, {
    polishName: "Lawenda wąskolistna",
    latinName: "Lavandula angustifolia",
  });
  const dirty = plantQueryFromBody({
    polishName: "Lawenda",
    latinName: "Lavandula",
    price: 19.99,
    photoDataUrl: "data:secret",
    shop: "AGRA",
  });
  assert.deepEqual(dirty, { polishName: "Lawenda", latinName: "Lavandula" });
  assert.equal(JSON.stringify(dirty).includes("19.99"), false);
  assert.equal(JSON.stringify(dirty).includes("AGRA"), false);
  const prompt = buildUserPrompt(payload);
  assert.equal(prompt.includes("19,99"), false);
  assert.equal(prompt.includes("zł"), false);
  assert.equal(normalize("Łubin"), "lubin");
});

test("odpowiedź modelu da się odczytać z markdownu", () => {
  const parsed = parsePlantResponse(
    extractJson('```json\n{"polishName":"Mięta","latinName":"Mentha","description":"Aromatyczne zioło do naparów i kuchni, rozrastające się przez rozłogi. Najlepiej trzymać je w donicy.","watering":"umiarkowane","light":"półcień","frostLabel":"mrozoodporna","frostDetail":"do ok. -30 °C","plantType":"zioło","height":"40 cm"}\n```'),
    { polishName: "mięta", latinName: "" },
  );
  assert.ok(parsed);
  assert.equal(parsed?.plant.watering, "moderate");
  assert.equal(parsed?.plant.light, "partial");
  assert.equal(parsed?.plant.frostLabel, "mrozoodporna");
});
