const assert = require("assert");
const crypto = require("node:crypto");
const fs = require("fs");

const auth = require("../lib/auth");
const feed = require("../lib/feed");

function makeToken(privateKey, kid, claims) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid, typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = crypto.sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey);
  return `${header}.${payload}.${signature.toString("base64url")}`;
}

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
  const information = feed.information().Data;
  assert.deepStrictEqual(information.ServerSupportedVersions, ["1.7.0"]);
  assert.strictEqual(information.Authentication.AuthenticationType, "microsoftEntraId");
  assert.strictEqual(information.Authentication.MicrosoftEntraIdAuthenticationInfo.Resource, auth.RESOURCE);

  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const kid = "test-key";
  const jwk = publicKey.export({ format: "jwk" });
  jwk.kid = kid;
  const nowMilliseconds = Date.UTC(2026, 9, 9, 12, 0, 0);
  const baseClaims = {
    aud: auth.RESOURCE,
    appid: auth.WINGET_CLIENT_ID,
    exp: Math.floor(nowMilliseconds / 1000) + 600,
    iss: `https://sts.windows.net/${auth.TENANT_ID}/`,
    nbf: Math.floor(nowMilliseconds / 1000) - 60,
    oid: "11111111-2222-3333-4444-555555555555",
    tid: auth.TENANT_ID
  };
  const validToken = makeToken(privateKey, kid, baseClaims);
  await auth.verifyAccessToken(validToken, { keys: [jwk], nowMilliseconds });

  const { publicKey: rotatedPublicKey, privateKey: rotatedPrivateKey } =
    crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const rotatedJwk = rotatedPublicKey.export({ format: "jwk" });
  rotatedJwk.kid = "rotated-key";
  const rotatedToken = makeToken(rotatedPrivateKey, rotatedJwk.kid, baseClaims);
  const unknownToken = makeToken(privateKey, "unknown-key", baseClaims);
  const fetchResponses = [[jwk], [jwk], [rotatedJwk]];
  const fetchSignals = [];
  let fetchCalls = 0;
  let releaseInitialFetch;
  const initialFetchBlocked = new Promise((resolve) => {
    releaseInitialFetch = resolve;
  });
  const fetchImpl = async (_url, options) => {
    const responseNumber = fetchCalls++;
    fetchSignals.push(options.signal);
    if (responseNumber === 0) {
      await initialFetchBlocked;
    }
    return {
      ok: true,
      json: async () => ({ keys: fetchResponses[responseNumber] })
    };
  };

  auth.resetKeyCacheForTests();
  const concurrentUnknownTokens = [
    auth.verifyAccessToken(unknownToken, { fetchImpl, nowMilliseconds }),
    auth.verifyAccessToken(unknownToken, { fetchImpl, nowMilliseconds })
  ];
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(fetchCalls, 1, "concurrent cache misses share the initial JWKS fetch");
  releaseInitialFetch();
  await Promise.all(concurrentUnknownTokens.map((verification) => assert.rejects(verification)));
  assert.strictEqual(fetchCalls, 2, "concurrent unknown-kid refreshes share one JWKS fetch");
  assert.ok(fetchSignals.every((signal) => signal instanceof AbortSignal), "JWKS fetches have abort signals");

  await assert.rejects(
    auth.verifyAccessToken(unknownToken, { fetchImpl, nowMilliseconds: nowMilliseconds + 999 })
  );
  assert.strictEqual(fetchCalls, 2, "unknown-kid refreshes are limited during the short interval");

  await auth.verifyAccessToken(rotatedToken, {
    fetchImpl,
    nowMilliseconds: nowMilliseconds + 1000
  });
  assert.strictEqual(fetchCalls, 3, "a rotated signing key is fetched after the short interval");

  for (const changedClaims of [
    { ...baseClaims, tid: "00000000-0000-0000-0000-000000000000" },
    { ...baseClaims, aud: "https://graph.microsoft.com" },
    { ...baseClaims, appid: "04b07795-8ddb-461a-bbee-02f9e1bf7b46" },
    { ...baseClaims, oid: undefined },
    { ...baseClaims, exp: Math.floor(nowMilliseconds / 1000) - 301 }
  ]) {
    await assert.rejects(
      auth.verifyAccessToken(makeToken(privateKey, kid, changedClaims), { keys: [jwk], nowMilliseconds })
    );
  }

  const unauthenticatedContext = {};
  await manifestSearchHandler(unauthenticatedContext, { body: {} });
  assert.strictEqual(unauthenticatedContext.res.status, 401);

  const originalAuthorize = auth.authorize;
  auth.authorize = async () => true;
  const context = {};
  try {
    await manifestSearchHandler(context, { body: { Filters: Array.from({ length: 33 }, () => ({})) } });
    assert.strictEqual(context.res.status, 400);
  } finally {
    auth.authorize = originalAuthorize;
  }
  console.log("feed tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
