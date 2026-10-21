import assert from "node:assert/strict";
import { test } from "node:test";
import { PLANTS } from "./plants";
import { parsePlantResponse } from "./parse-plant";
import {
  SHOP_REGION,
  adjustRange,
  frostLevelForCelsius,
  parseMinCelsius,
  resolveFrost,
  snowflakeLines,
  zoneForCelsius,
} from "./scales";

test("skala mrozu lawendy nie sięga kreski Kłodzka", () => {
  const plant = PLANTS.find((item) => item.id === "lawenda-waskolistna");
  assert.ok(plant);
  assert.equal(plant.hardinessC, "−20 °C");
  assert.deepEqual(plant.bloomMonths, [6, 7, 8]);
  assert.ok(plant.badges.includes("miododajna"));
  assert.equal(plant.waterFrom, 1);
  assert.equal(plant.waterTo, 2);
  assert.equal(plant.lightFrom, 4);
  assert.equal(plant.lightTo, 5);
  const frost = resolveFrost(plant);
  assert.equal(frost.level, 3);
  assert.equal(frost.zone, "6b");
  assert.equal(frost.clearsShop, false);
  assert.equal(frost.minC, -20);
  assert.equal(SHOP_REGION.zone, "6a");
  assert.ok(SHOP_REGION.celsius <= -23 && SHOP_REGION.celsius > -23.4);
});

test("progi mrozu i strefa USDA", () => {
  assert.equal(frostLevelForCelsius(0), 1);
  assert.equal(frostLevelForCelsius(-8), 2);
  assert.equal(frostLevelForCelsius(-20), 3);
  assert.equal(frostLevelForCelsius(-23), 4);
  assert.equal(frostLevelForCelsius(-25), 4);
  assert.equal(frostLevelForCelsius(-32), 5);
  assert.equal(zoneForCelsius(-20), "6b");
  assert.equal(zoneForCelsius(-23.3), "6a");
  assert.equal(zoneForCelsius(-30), "4b");
  assert.equal(parseMinCelsius("do ok. -18 °C"), -18);
  const hardy = resolveFrost({ hardinessC: "−25 °C", usdaZone: "", frostLabel: "mrozoodporna", frostDetail: "" });
  assert.equal(hardy.clearsShop, true);
  assert.equal(hardy.level, 4);
  const indoor = resolveFrost({ hardinessC: "", usdaZone: "", frostLabel: "nie zimuje w gruncie", frostDetail: "" });
  assert.equal(indoor.level, 1);
  const missing = resolveFrost({ hardinessC: "", usdaZone: "", frostLabel: "wymaga okrycia", frostDetail: "" });
  assert.equal(missing.known, false);
  assert.equal(missing.level, 0);
});

test("zakres stanowiska i symetryczna geometria płatka", () => {
  assert.deepEqual(adjustRange(4, 5, 3), [3, 5]);
  assert.deepEqual(adjustRange(2, 4, 2), [3, 4]);
  assert.deepEqual(adjustRange(0, 0, 5), [5, 5]);
  const arms = snowflakeLines();
  assert.ok(arms.length >= 18);
  assert.equal(arms.length, 18);
  for (const arm of arms) {
    const rotated = { x1: 100-arm.x1, y1: 100-arm.y1, x2: 100-arm.x2, y2: 100-arm.y2 };
    assert.ok(arms.some((line) => Object.keys(rotated).every((key) => Math.abs(line[key as keyof typeof line] - rotated[key as keyof typeof rotated]) < 0.0001)));
  }
});

test("odpowiedź modelu czyta zakresy, miesiące i strefę", () => {
  const parsed = parsePlantResponse(
    {
      polishName: "Mięta",
      latinName: "Mentha",
      description: "Aromatyczne zioło do naparów i kuchni, rozrastające się przez rozłogi. Najlepiej trzymać je w donicy.",
      watering: "umiarkowane",
      light: "półcień",
      frostLabel: "mrozoodporna",
      waterFrom: 2,
      waterTo: 4,
      lightFrom: 3,
      lightTo: 5,
      hardinessC: "−25 °C",
      usdaZone: "5b",
      bloomMonths: [6, 7, "8", 13],
      badges: ["miododajna", "miododajna"],
      width: "30 cm",
    },
    { polishName: "mięta", latinName: "" },
  );
  assert.equal(parsed?.plant.waterFrom, 2);
  assert.equal(parsed?.plant.waterTo, 4);
  assert.equal(parsed?.plant.lightFrom, 3);
  assert.equal(parsed?.plant.lightTo, 5);
  assert.equal(parsed?.plant.usdaZone, "5b");
  assert.deepEqual(parsed?.plant.bloomMonths, [6, 7, 8]);
  assert.deepEqual(parsed?.plant.badges, ["miododajna"]);
  const bare = parsePlantResponse(
    {
      polishName: "Mięta",
      latinName: "Mentha",
      description: "Aromatyczne zioło do naparów i kuchni, rozrastające się przez rozłogi. Najlepiej trzymać je w donicy.",
      watering: "umiarkowane",
      light: "półcień",
      frostLabel: "mrozoodporna",
    },
    { polishName: "mięta", latinName: "" },
  );
  assert.deepEqual(bare?.plant.bloomMonths, []);
  assert.deepEqual(bare?.plant.badges, []);
  assert.deepEqual([bare?.plant.waterFrom, bare?.plant.waterTo], [2, 4]);
  assert.equal(bare?.plant.usdaZone, "");
});
