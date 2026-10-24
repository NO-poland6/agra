import assert from "node:assert/strict";
import { test } from "node:test";
import { formatPrice, formatPriceParts, parsePrice } from "./format.ts";

test("prices accept Polish and dot decimal separators", () => {
  for (const value of ["19,99", "19.99", "19,99 zł", " 19.99 PLN "])
    assert.equal(parsePrice(value), 19.99);
  assert.equal(parsePrice("149,00"), 149);
  assert.equal(parsePrice("1 234,50"), 1234.5);
});

test("invalid and out of range prices are rejected", () => {
  for (const value of [
    "",
    "0",
    "-1",
    "abc",
    "19,999",
    "1,2.3",
    "100000",
    "Infinity",
  ])
    assert.equal(parsePrice(value), null);
});

test("prices always display two decimal places and Polish currency", () => {
  assert.deepEqual(formatPriceParts(19.99), {
    amount: "19,99",
    currency: "zł",
  });
  assert.equal(formatPrice(149), "149,00 zł");
});
