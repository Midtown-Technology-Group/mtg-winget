const assert = require("assert");
const fs = require("fs");

const feed = require("../lib/feed");

function packageIdentifiers(response) {
  return response.Data.map((pkg) => pkg.PackageIdentifier);
}

function assertSearch(name, body, expected) {
  const response = feed.manifestSearch(body);
  const actual = packageIdentifiers(response);

  if (Array.isArray(expected)) {
    assert.deepStrictEqual(actual, expected, name);
  } else {
    assert.strictEqual(actual.length, expected, name);
  }

  assert.strictEqual(response.ContinuationToken, null, `${name}: continuation token`);
  assert.ok(Array.isArray(response.UnsupportedPackageMatchFields), `${name}: unsupported fields`);
  assert.ok(Array.isArray(response.RequiredPackageMatchFields), `${name}: required fields`);
}

assertSearch(
  "query substring",
  { Query: { KeyWord: "voquill", MatchType: "Substring" } },
  ["MidtownTechnologyGroup.Voquill"]
);

assertSearch(
  "query exact",
  { Query: { KeyWord: "MidtownTechnologyGroup.Voquill", MatchType: "Exact" } },
  ["MidtownTechnologyGroup.Voquill"]
);

assertSearch(
  "exact package identifier filter",
  {
    Filters: [
      {
        PackageMatchField: "PackageIdentifier",
        RequestMatch: { KeyWord: "MidtownTechnologyGroup.Voquill", MatchType: "Exact" }
      }
    ]
  },
  ["MidtownTechnologyGroup.Voquill"]
);

assertSearch(
  "case-insensitive package identifier filter",
  {
    Filters: [
      {
        PackageMatchField: "PackageIdentifier",
        RequestMatch: { KeyWord: "midtowntechnologygroup.voquill", MatchType: "CaseInsensitive" }
      }
    ]
  },
  ["MidtownTechnologyGroup.Voquill"]
);

assertSearch(
  "normalized name and publisher filter",
  {
    Filters: [
      {
        PackageMatchField: "NormalizedNameAndPublisher",
        RequestMatch: { KeyWord: "voquill+midtown technology group llc", MatchType: "Exact" }
      }
    ]
  },
  ["MidtownTechnologyGroup.Voquill"]
);

assertSearch(
  "normalized package name and publisher filter (winget client field name)",
  {
    Filters: [
      {
        PackageMatchField: "NormalizedPackageNameAndPublisher",
        RequestMatch: { KeyWord: "voquill+midtown technology group llc", MatchType: "Exact" }
      }
    ]
  },
  ["MidtownTechnologyGroup.Voquill"]
);

const unsupportedNormalizedAlias = feed.manifestSearch({
  Filters: [
    {
      PackageMatchField: "NormalizedPackageNameAndPublisher",
      RequestMatch: { KeyWord: "not-a-real-package", MatchType: "Exact" }
    }
  ]
});
assert.deepStrictEqual(packageIdentifiers(unsupportedNormalizedAlias), []);
assert.deepStrictEqual(unsupportedNormalizedAlias.UnsupportedPackageMatchFields, []);

assertSearch(
  "publisher inclusion remains broad",
  {
    Inclusions: [
      {
        PackageMatchField: "Publisher",
        RequestMatch: { KeyWord: "Midtown Technology Group LLC", MatchType: "CaseInsensitive" }
      }
    ]
  },
  14
);

const unsupportedResponse = feed.manifestSearch({
  Filters: [
    {
      PackageMatchField: "Unsupported",
      RequestMatch: { KeyWord: "MidtownTechnologyGroup.Voquill", MatchType: "Substring" }
    }
  ]
});

assert.deepStrictEqual(packageIdentifiers(unsupportedResponse), []);
assert.deepStrictEqual(unsupportedResponse.UnsupportedPackageMatchFields, ["Unsupported"]);

assert.throws(
  () => feed.manifestSearch({ Filters: Array.from({ length: 33 }, () => ({ PackageMatchField: "Publisher" })) }),
  RangeError
);
assert.throws(() => feed.manifestSearch({ Query: { KeyWord: "x".repeat(257) } }), RangeError);
assert.throws(() => feed.manifestSearch({ Query: { KeyWord: `x${" ".repeat(256)}` } }), RangeError);
assert.throws(
  () => feed.manifestSearch({ Filters: [{ PackageMatchField: "Publisher", RequestMatch: { KeyWord: "x".repeat(257) } }] }),
  RangeError
);

const originalReadFileSync = fs.readFileSync;
let manifestReads = 0;
fs.readFileSync = function (...args) {
  if (String(args[0]).includes("packageManifests")) {
    manifestReads++;
  }
  return originalReadFileSync.apply(this, args);
};
try {
  assertSearch("index-only filters", {
    Filters: Array.from({ length: 32 }, () => ({
      PackageMatchField: "Publisher",
      RequestMatch: { KeyWord: "Midtown Technology Group LLC" }
    }))
  }, 14);
  assert.strictEqual(manifestReads, 0, "index-only search must not read manifests");

  feed.manifestSearch({ Inclusions: [
    { PackageMatchField: "ProductCode", RequestMatch: { KeyWord: "does-not-exist" } },
    { PackageMatchField: "ProductCode", RequestMatch: { KeyWord: "does-not-exist" } }
  ] });
  assert.ok(manifestReads > 0, "product-code search must read a manifest");
  assert.ok(manifestReads <= 14, "product-code manifests are read at most once per package");
} finally {
  fs.readFileSync = originalReadFileSync;
}

const manifestSearchHandler = require("../manifestSearch");
(async () => {
  const context = {};
  await manifestSearchHandler(context, { body: { Filters: Array.from({ length: 33 }, () => ({})) } });
  assert.strictEqual(context.res.status, 400);
  console.log("feed tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
