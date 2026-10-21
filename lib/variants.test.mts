import assert from "node:assert/strict";
import { test } from "node:test";
import { labelVariant } from "./variants";
import { careSummary } from "./care-summary";
import { PLANTS } from "./plants";

test("wariant z URL dopuszcza tylko cztery projekty", () => {
  for (const value of ["a", "b", "c", "d"]) assert.equal(labelVariant(value), value);
  for (const value of [null, "", "A", "unknown", "toString", "__proto__"]) assert.equal(labelVariant(value), null);
});

test("skrócone wartości odpowiadają edytowanym zakresom", () => {
  const lavender = PLANTS.find(p => p.id === "lawenda-waskolistna")!;
  assert.deepEqual(careSummary(lavender), {light: "Słońce", water: "Rzadko"});
  assert.deepEqual(careSummary({...lavender, lightFrom: 1, lightTo: 1, waterFrom: 4, waterTo: 5}), {light: "Cień", water: "Obficie"});
});
