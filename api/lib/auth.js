const crypto = require("crypto");

const TENANT_ID = "a3599b15-c39c-4b41-a219-7e24dd5b5190";
const RESOURCE = "https://management.core.windows.net/";
const ALLOWED_AUDIENCES = new Set([
  RESOURCE,
  "https://management.azure.com/"
]);
const WINGET_CLIENT_ID = "7b8ea11a-7f45-4b3a-ab51-794d5863af15";
const JWKS_URL = `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`;
const CLOCK_SKEW_SECONDS = 300;
const JWKS_CACHE_MILLISECONDS = 60 * 60 * 1000;
const JWKS_MIN_REFRESH_MILLISECONDS = 1000;
const JWKS_FETCH_TIMEOUT_MILLISECONDS = 5000;

let jwksCache;
let jwksInFlight;
let lastForcedRefreshMilliseconds = Number.NEGATIVE_INFINITY;

class AuthenticationError extends Error {}

function decodeJsonSegment(segment, label) {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
  } catch {
    throw new AuthenticationError(`Invalid JWT ${label}`);
  }
}

function claimContains(value, expected) {
  return Array.isArray(value) ? value.includes(expected) : value === expected;
}

async function loadSigningKeys(fetchImpl, nowMilliseconds, forceRefresh = false) {
  if (!forceRefresh && jwksCache && jwksCache.expiresAt > nowMilliseconds) {
    return jwksCache.keys;
  }

  if (jwksInFlight) {
    return jwksInFlight;
  }

  if (
    forceRefresh &&
    jwksCache &&
    nowMilliseconds - lastForcedRefreshMilliseconds < JWKS_MIN_REFRESH_MILLISECONDS
  ) {
    return jwksCache.keys;
  }

  if (forceRefresh) {
    lastForcedRefreshMilliseconds = nowMilliseconds;
  }

  jwksInFlight = (async () => {
    const response = await fetchImpl(JWKS_URL, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(JWKS_FETCH_TIMEOUT_MILLISECONDS)
    });
    if (!response.ok) {
      throw new Error(`Microsoft Entra signing-key request failed with HTTP ${response.status}`);
    }

    const body = await response.json();
    if (!Array.isArray(body.keys)) {
      throw new Error("Microsoft Entra signing-key response did not contain keys");
    }

    jwksCache = {
      keys: body.keys,
      expiresAt: nowMilliseconds + JWKS_CACHE_MILLISECONDS
    };
    return body.keys;
  })().finally(() => {
    jwksInFlight = undefined;
  });

  return jwksInFlight;
}

async function verifyAccessToken(token, options = {}) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) {
    throw new AuthenticationError("Invalid JWT structure");
  }

  const header = decodeJsonSegment(parts[0], "header");
  const claims = decodeJsonSegment(parts[1], "claims");
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new AuthenticationError("Unsupported JWT signing parameters");
  }

  const fetchImpl = options.fetchImpl || global.fetch;
  const nowMilliseconds = options.nowMilliseconds ?? Date.now();
  let keys = options.keys || await loadSigningKeys(fetchImpl, nowMilliseconds);
  let jwk = keys.find((key) => key.kid === header.kid && key.kty === "RSA");
  if (!jwk && !options.keys) {
    keys = await loadSigningKeys(fetchImpl, nowMilliseconds, true);
    jwk = keys.find((key) => key.kid === header.kid && key.kty === "RSA");
  }
  if (!jwk) {
    throw new AuthenticationError("Unknown JWT signing key");
  }
  if ((jwk.use && jwk.use !== "sig") || (jwk.alg && jwk.alg !== "RS256")) {
    throw new AuthenticationError("JWT key is not valid for RS256 signatures");
  }

  let publicKey;
  try {
    publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });
  } catch {
    throw new AuthenticationError("Invalid JWT signing key");
  }
  const verified = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    publicKey,
    Buffer.from(parts[2], "base64url")
  );
  if (!verified) {
    throw new AuthenticationError("Invalid JWT signature");
  }

  const nowSeconds = Math.floor(nowMilliseconds / 1000);
  if (typeof claims.exp !== "number" || claims.exp <= nowSeconds - CLOCK_SKEW_SECONDS) {
    throw new AuthenticationError("Expired JWT");
  }
  if (typeof claims.nbf === "number" && claims.nbf > nowSeconds + CLOCK_SKEW_SECONDS) {
    throw new AuthenticationError("JWT is not yet valid");
  }
  if (claims.tid !== TENANT_ID) {
    throw new AuthenticationError("JWT tenant is not allowed");
  }

  const allowedIssuers = new Set([
    `https://sts.windows.net/${TENANT_ID}/`,
    `https://login.microsoftonline.com/${TENANT_ID}/v2.0`
  ]);
  if (!allowedIssuers.has(claims.iss)) {
    throw new AuthenticationError("JWT issuer is not allowed");
  }
  if (![...ALLOWED_AUDIENCES].some((audience) => claimContains(claims.aud, audience))) {
    throw new AuthenticationError("JWT audience is not allowed");
  }
  if ((claims.azp || claims.appid) !== WINGET_CLIENT_ID) {
    throw new AuthenticationError("JWT client is not WinGet");
  }
  if (typeof claims.oid !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.oid)) {
    throw new AuthenticationError("JWT does not identify a user");
  }

  return claims;
}

function bearerToken(req) {
  const header = req?.headers?.authorization || req?.headers?.Authorization;
  const match = typeof header === "string" && header.match(/^Bearer\s+([^\s]+)$/i);
  return match ? match[1] : null;
}

async function authorize(context, req, options = {}) {
  const token = bearerToken(req);
  if (!token) {
    context.res = unauthorizedResponse();
    return false;
  }

  try {
    await verifyAccessToken(token, options);
    return true;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      context.res = unauthorizedResponse();
      return false;
    }
    context.log?.error?.("Unable to validate Microsoft Entra access token", error);
    context.res = {
      status: 503,
      headers: { "content-type": "application/json" },
      body: { error: "Authentication service unavailable" }
    };
    return false;
  }
}

function unauthorizedResponse() {
  return {
    status: 401,
    headers: {
      "content-type": "application/json",
      "www-authenticate": "Bearer"
    },
    body: { error: "Authentication required" }
  };
}

function resetKeyCacheForTests() {
  jwksCache = undefined;
  jwksInFlight = undefined;
  lastForcedRefreshMilliseconds = Number.NEGATIVE_INFINITY;
}

module.exports = {
  RESOURCE,
  TENANT_ID,
  WINGET_CLIENT_ID,
  authorize,
  resetKeyCacheForTests,
  verifyAccessToken
};
