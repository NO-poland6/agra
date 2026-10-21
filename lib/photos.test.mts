import assert from "node:assert/strict";
import { test } from "node:test";
import { commonsSearchUrl, inatSearchUrl } from "./photo-search";
import { plantQueryFromBody } from "./plant-query";
import {
  commonsThumbAt,
  formatCredit,
  isAllowedPhotoUrl,
  isFreeLicense,
  latinBinomial,
  photoSearchTerms,
  plainAuthor,
  rankPhotos,
  readCommonsPayload,
  readInatPayload,
  type ParsedPhoto,
} from "./photos";

const COMMONS =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Lavandula_angustifolia.jpg/1920px-Lavandula_angustifolia.jpg";

test("licencja wolna zostaje, NC i ND odpadają", () => {
  assert.equal(isFreeLicense("CC BY-SA 4.0"), true);
  assert.equal(isFreeLicense("CC BY 2.0"), true);
  assert.equal(isFreeLicense("CC0 1.0"), true);
  assert.equal(isFreeLicense("Public domain"), true);
  assert.equal(isFreeLicense("cc-by"), true);
  assert.equal(isFreeLicense("cc-by-sa"), true);
  assert.equal(isFreeLicense("CC BY-NC-SA 4.0"), false);
  assert.equal(isFreeLicense("cc-by-nc"), false);
  assert.equal(isFreeLicense("CC BY-ND 4.0"), false);
  assert.equal(isFreeLicense(""), false);
  assert.equal(isFreeLicense("GFDL"), false);
});

test("podpis autora jest krótki i bez html", () => {
  const author = plainAuthor(
    '<a href="//commons.wikimedia.org/wiki/User:NorbertNagel">Norbert Nagel</a>',
  );
  assert.equal(author, "Norbert Nagel");
  assert.equal(
    formatCredit(author, "CC BY-SA 3.0", "wikimedia"),
    "fot. Norbert Nagel, CC BY-SA 3.0, Wikimedia Commons",
  );
  assert.equal(
    plainAuthor("(c) Naturalista, some rights reserved (CC BY)"),
    "Naturalista",
  );
});

test("do wyszukiwarki idzie tylko nazwa rośliny", () => {
  const query = plantQueryFromBody({
    polishName: "Lawenda wąskolistna",
    latinName: "Lavandula angustifolia",
    price: 19.99,
    photoDataUrl: "data:image/png;base64,aaaa",
    shop: "AGRA PSK",
  });
  assert.deepEqual(query, {
    polishName: "Lawenda wąskolistna",
    latinName: "Lavandula angustifolia",
  });
  assert.ok(query);
  const terms = photoSearchTerms(query);
  assert.deepEqual(terms, ["Lavandula angustifolia", "Lawenda wąskolistna"]);
  const commons = commonsSearchUrl(terms[0]);
  const inat = inatSearchUrl(latinBinomial(query.latinName) ?? "");
  for (const url of [commons, inat]) {
    assert.equal(url.includes("19.99"), false);
    assert.equal(url.includes("19,99"), false);
    assert.equal(url.includes("AGRA"), false);
    assert.equal(url.includes("data:image"), false);
  }
  assert.ok(commons.includes("Lavandula"));
  assert.equal(latinBinomial("Hydrangea anomala subsp. petiolaris"), "Hydrangea anomala");
  assert.equal(latinBinomial("Hosta"), "Hosta");
});

test("proxy przyjmuje tylko pliki wolnych źródeł", () => {
  assert.equal(isAllowedPhotoUrl(COMMONS), true);
  assert.equal(
    isAllowedPhotoUrl("https://inaturalist-open-data.s3.amazonaws.com/photos/172041726/large.jpeg"),
    true,
  );
  assert.equal(isAllowedPhotoUrl("https://upload.wikimedia.org/wikipedia/commons/a/ab/Nota.txt"), false);
  assert.equal(isAllowedPhotoUrl("http://upload.wikimedia.org/wikipedia/commons/a/ab/A.jpg"), false);
  assert.equal(isAllowedPhotoUrl("https://user:pass@upload.wikimedia.org/wikipedia/commons/a/ab/A.jpg"), false);
  assert.equal(isAllowedPhotoUrl("https://images.google.com/a.jpg"), false);
  assert.equal(
    commonsThumbAt(COMMONS, 400),
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Lavandula_angustifolia.jpg/500px-Lavandula_angustifolia.jpg",
  );
});

test("ranking woli zdjęcie gatunku i odrzuca NC oraz za mały rysunek", () => {
  const files: ParsedPhoto[] = [
    {
      source: "wikimedia",
      title: "File:Bombus pascuorum dorsal view.jpg",
      pageUrl: "",
      printUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Bombus.jpg/1920px-Bombus.jpg",
      thumbUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Bombus.jpg/500px-Bombus.jpg",
      width: 4000,
      height: 3000,
      mime: "image/jpeg",
      author: "Didier Descouens",
      license: "CC BY-SA 4.0",
    },
    {
      source: "wikimedia",
      title: "File:Lavandula angustifolia - lavender.jpg",
      pageUrl: "",
      printUrl: COMMONS,
      thumbUrl: commonsThumbAt(COMMONS, 500),
      width: 3110,
      height: 2000,
      mime: "image/jpeg",
      author: "Norbert Nagel",
      license: "CC BY-SA 3.0",
    },
    {
      source: "wikimedia",
      title: "File:Lavandula angustifolia plate.jpg",
      pageUrl: "",
      printUrl: "https://upload.wikimedia.org/wikipedia/commons/4/40/Lavandula_plate.jpg",
      thumbUrl: "https://upload.wikimedia.org/wikipedia/commons/4/40/Lavandula_plate.jpg",
      width: 438,
      height: 597,
      mime: "image/jpeg",
      author: "Köhler",
      license: "Public domain",
    },
    {
      source: "inaturalist",
      title: "999",
      pageUrl: "",
      printUrl: "https://inaturalist-open-data.s3.amazonaws.com/photos/999/large.jpeg",
      thumbUrl: "https://inaturalist-open-data.s3.amazonaws.com/photos/999/medium.jpeg",
      width: 0,
      height: 0,
      mime: "",
      author: "(c) Ada, some rights reserved (CC BY-NC)",
      license: "cc-by-nc",
    },
  ];
  const ranked = rankPhotos(files, { polishName: "Lawenda wąskolistna", latinName: "Lavandula angustifolia" });
  assert.equal(ranked[0]?.title.includes("Lavandula angustifolia - lavender"), true);
  assert.equal(ranked.some((item) => item.license.includes("NC")), false);
  assert.equal(ranked.some((item) => item.title.includes("plate")), false);
  assert.match(ranked[0]?.credit ?? "", /fot\. Norbert Nagel, CC BY-SA 3\.0, Wikimedia Commons/);
});

test("odpowiedź Commons i iNaturalist da się odczytać", () => {
  const commons = readCommonsPayload({
    query: {
      pages: {
        "1": {
          title: "File:Lavandula angustifolia - lavender.jpg",
          imageinfo: [
            {
              url: `${COMMONS.replace("/thumb/c/c2/Lavandula_angustifolia.jpg/1920px-Lavandula_angustifolia.jpg", "/c/c2/Lavandula_angustifolia.jpg")}?utm_source=commons`,
              thumburl: `${COMMONS}?utm_source=commons`,
              width: 3110,
              height: 2000,
              mime: "image/jpeg",
              descriptionurl: "https://commons.wikimedia.org/wiki/File:Lavandula_angustifolia_-_lavender.jpg",
              extmetadata: {
                LicenseShortName: { value: "CC BY-SA 3.0" },
                Artist: { value: "<a>Norbert Nagel</a>" },
              },
            },
          ],
        },
      },
    },
  });
  assert.equal(commons.length, 1);
  assert.equal(commons[0]?.printUrl.includes("utm_source"), false);
  assert.equal(commons[0]?.thumbUrl.endsWith("500px-Lavandula_angustifolia.jpg"), true);

  const inat = readInatPayload({
    results: [
      {
        photos: [
          {
            id: 15,
            license_code: "cc-by",
            attribution: "(c) Ada, some rights reserved (CC BY)",
            url: "https://inaturalist-open-data.s3.amazonaws.com/photos/15/square.jpg",
          },
        ],
      },
    ],
  });
  assert.equal(inat[0]?.printUrl.endsWith("/large.jpg"), true);
  assert.equal(inat[0]?.thumbUrl.endsWith("/medium.jpg"), true);
});
