const fs = require("fs");
const path = require("path");

const DATA_ROOT = process.env.WINGET_DATA_ROOT || path.join(__dirname, "..", "data");

const localeMap = {
  packageLocale: "PackageLocale",
  publisher: "Publisher",
  publisherUrl: "PublisherUrl",
  publisherSupportUrl: "PublisherSupportUrl",
  author: "Author",
  packageName: "PackageName",
  packageUrl: "PackageUrl",
  license: "License",
  licenseUrl: "LicenseUrl",
  copyright: "Copyright",
  shortDescription: "ShortDescription",
  description: "Description",
  moniker: "Moniker",
  tags: "Tags",
  releaseNotes: "ReleaseNotes",
  releaseNotesUrl: "ReleaseNotesUrl"
};

const installerMap = {
  architecture: "Architecture",
  installerType: "InstallerType",
  scope: "Scope",
  installerUrl: "InstallerUrl",
  installerSha256: "InstallerSha256",
  productCode: "ProductCode",
  upgradeBehavior: "UpgradeBehavior"
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function readJsonFromStaticSite(filePath) {
  const relativePath = path.relative(DATA_ROOT, filePath).split(path.sep).join("/");
  const host = process.env.WEBSITE_HOSTNAME;
  if (!host) {
    return null;
  }

  const res = await fetch(`https://${host}/${relativePath}`);
  if (!res.ok) {
    return null;
  }

  return res.json();
}

function response(data) {
  return { Data: data };
}

function searchResponse(data, extra = {}) {
  return {
    Data: data,
    ContinuationToken: null,
    UnsupportedPackageMatchFields: extra.UnsupportedPackageMatchFields || [],
    RequiredPackageMatchFields: extra.RequiredPackageMatchFields || []
  };
}

function information() {
  return response({
    SourceIdentifier: "mtg-tools",
    ServerSupportedVersions: ["1.4.0"]
  });
}

function packageIndex() {
  return readJson(path.join(DATA_ROOT, "index.json")).packages || [];
}

function normalizePackageId(value) {
  return String(value || "").trim().toLowerCase();
}

function packageManifestPath(packageId, version) {
  const parts = packageId.split(".");
  if (parts.length < 2) {
    return null;
  }

  return path.join(
    DATA_ROOT,
    "packageManifests",
    packageId[0].toLowerCase(),
    parts[0],
    parts.slice(1).join("."),
    `${version}.json`
  );
}

function latestVersion(packageEntry) {
  return (packageEntry.Versions || [])[0]?.PackageVersion;
}

function packageManifestRaw(packageEntry) {
  const manifestVersion = latestVersion(packageEntry);
  const manifestPath = packageManifestPath(packageEntry.PackageIdentifier, manifestVersion);
  if (!manifestPath || !fs.existsSync(manifestPath)) {
    return null;
  }

  return readJson(manifestPath).data;
}

function normalizeSearchValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickSearchText(body) {
  return [
    body?.Query?.KeyWord,
    body?.Query?.Keyword,
    body?.Query?.RequestMatch?.KeyWord,
    body?.Query?.RequestMatch?.Keyword,
    body?.Query?.Value,
    body?.Query?.SearchTerm,
    body?.SearchTerm
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function normalizeMatchType(value) {
  return String(value || "Substring").trim().toLowerCase();
}

function queryMatchType(body) {
  return body?.Query?.MatchType || body?.Query?.RequestMatch?.MatchType || "Substring";
}

function pickRequestMatchText(filter) {
  return [
    filter?.RequestMatch?.KeyWord,
    filter?.RequestMatch?.Keyword,
    filter?.RequestMatch?.Value,
    filter?.RequestMatch?.SearchTerm,
    filter?.KeyWord,
    filter?.Keyword,
    filter?.Value,
    filter?.SearchTerm
  ]
    .filter(Boolean)
    .join(" ");
}

function packageFieldValues(pkg, packageMatchField) {
  const field = String(packageMatchField || "").trim().toLowerCase();
  const locales = (pkg.Versions || []).map((version) => version.DefaultLocale || {});
  const manifest = packageManifestRaw(pkg);

  switch (field) {
    case "packageidentifier":
    case "id":
      return [pkg.PackageIdentifier];
    case "packagename":
    case "name":
      return [pkg.PackageName, ...locales.map((locale) => locale.PackageName)];
    case "publisher":
      return [pkg.Publisher, ...locales.map((locale) => locale.Publisher)];
    case "moniker":
      return locales.map((locale) => locale.Moniker);
    case "tag":
    case "tags":
      return locales.flatMap((locale) => locale.Tags || []);
    case "description":
      return locales.map((locale) => locale.Description);
    case "shortdescription":
      return locales.map((locale) => locale.ShortDescription);
    case "productcode":
      return (manifest?.versions || []).flatMap((version) =>
        (version.installers || []).map((installer) => installer.productCode)
      );
    case "normalizednameandpublisher":
    case "normalizedpackagenameandpublisher":
      return [
        `${normalizeSearchValue(pkg.PackageName)} ${normalizeSearchValue(pkg.Publisher)}`,
        ...locales.map(
          (locale) =>
            `${normalizeSearchValue(locale.PackageName || pkg.PackageName)} ${normalizeSearchValue(
              locale.Publisher || pkg.Publisher
            )}`
        )
      ];
    case "command":
    case "packagefamilyname":
    case "market":
      return [];
    default:
      return [];
  }
}

function isSupportedPackageMatchField(packageMatchField) {
  return [
    "command",
    "description",
    "id",
    "market",
    "moniker",
    "name",
    "normalizednameandpublisher",
    "normalizedpackagenameandpublisher",
    "packagefamilyname",
    "packageidentifier",
    "packagename",
    "productcode",
    "publisher",
    "shortdescription",
    "tag",
    "tags"
  ].includes(String(packageMatchField || "").trim().toLowerCase());
}

function valueMatches(candidate, searchText, matchType) {
  if (!candidate || !searchText) {
    return false;
  }

  const rawCandidate = String(candidate);
  const rawSearchText = String(searchText);
  const normalizedCandidate = rawCandidate.toLowerCase();
  const normalizedSearchText = rawSearchText.toLowerCase();
  const searchNormalizedCandidate = normalizeSearchValue(candidate);
  const searchNormalizedSearchText = normalizeSearchValue(searchText);

  switch (normalizeMatchType(matchType)) {
    case "exact":
      return rawCandidate === rawSearchText || searchNormalizedCandidate === searchNormalizedSearchText;
    case "caseinsensitive":
      return normalizedCandidate === normalizedSearchText || searchNormalizedCandidate === searchNormalizedSearchText;
    case "startswith":
      return normalizedCandidate.startsWith(normalizedSearchText);
    case "substring":
    default:
      return normalizedCandidate.includes(normalizedSearchText);
  }
}

function packageMatchesFilter(pkg, filter) {
  const searchText = pickRequestMatchText(filter);
  if (!searchText) {
    return true;
  }

  const values = packageFieldValues(pkg, filter?.PackageMatchField);
  if (values.length === 0) {
    return false;
  }

  return values.some((value) => valueMatches(value, searchText, filter?.RequestMatch?.MatchType));
}

function packageMatchesSearch(pkg, searchText, matchType) {
  if (!searchText) {
    return true;
  }

  return [
    pkg.PackageIdentifier,
    pkg.PackageName,
    pkg.Publisher,
    ...(pkg.Versions || []).flatMap((version) => [
      version.DefaultLocale?.PackageName,
      version.DefaultLocale?.ShortDescription,
      version.DefaultLocale?.Description,
      version.DefaultLocale?.Moniker,
      ...(version.DefaultLocale?.Tags || [])
    ])
  ].some((value) => valueMatches(value, searchText, matchType));
}

function collectUnsupportedPackageMatchFields(filters) {
  return [
    ...new Set(
      filters
        .map((filter) => filter?.PackageMatchField)
        .filter((field) => field && !isSupportedPackageMatchField(field))
    )
  ];
}

function manifestSearch(body) {
  const searchText = pickSearchText(body || {});
  const inclusions = Array.isArray(body?.Inclusions) ? body.Inclusions : [];
  const filters = Array.isArray(body?.Filters) ? body.Filters : [];
  const unsupportedFields = collectUnsupportedPackageMatchFields([...inclusions, ...filters]);
  const packages = packageIndex()
    .filter((pkg) => {
      if (!packageMatchesSearch(pkg, searchText, queryMatchType(body))) {
        return false;
      }

      if (inclusions.length > 0 && !inclusions.some((filter) => packageMatchesFilter(pkg, filter))) {
        return false;
      }

      return filters.every((filter) => packageMatchesFilter(pkg, filter));
    })
    .map((pkg) => ({
      PackageIdentifier: pkg.PackageIdentifier,
      PackageName: pkg.PackageName,
      Publisher: pkg.Publisher,
      Versions: (pkg.Versions || []).map((version) => ({
        PackageVersion: version.PackageVersion
      }))
    }));

  return searchResponse(packages, {
    UnsupportedPackageMatchFields: unsupportedFields
  });
}

function mapKeys(source, keyMap) {
  return Object.fromEntries(
    Object.entries(keyMap)
      .filter(([from]) => source[from] !== undefined)
      .map(([from, to]) => [to, source[from]])
  );
}

async function packageManifest(packageId, version) {
  const entry = packageIndex().find((pkg) => normalizePackageId(pkg.PackageIdentifier) === normalizePackageId(packageId));
  if (!entry) {
    return null;
  }

  const manifestVersion = version || latestVersion(entry);
  const manifestPath = packageManifestPath(entry.PackageIdentifier, manifestVersion);
  if (!manifestPath) {
    return null;
  }

  const manifest = fs.existsSync(manifestPath)
    ? readJson(manifestPath)
    : await readJsonFromStaticSite(manifestPath);
  if (!manifest) {
    return null;
  }

  const raw = manifest.data;
  return response({
    PackageIdentifier: raw.packageIdentifier,
    Versions: (raw.versions || []).map((item) => ({
      PackageVersion: item.packageVersion,
      DefaultLocale: mapKeys(item.defaultLocale || {}, localeMap),
      Installers: (item.installers || []).map((installer) => ({
        ...mapKeys(installer, installerMap),
        InstallerSwitches: installer.installerSwitches
          ? {
              Silent: installer.installerSwitches.silent,
              SilentWithProgress: installer.installerSwitches.silentWithProgress
            }
          : undefined
      }))
    }))
  });
}

module.exports = {
  information,
  manifestSearch,
  packageManifest
};
