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

function response(data) {
  return { Data: data };
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

function pickSearchText(body) {
  return [
    body?.Query?.KeyWord,
    body?.Query?.Keyword,
    body?.Query?.Value,
    body?.Query?.SearchTerm,
    body?.SearchTerm
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function manifestSearch(body) {
  const searchText = pickSearchText(body || {});
  const packages = packageIndex()
    .filter((pkg) => {
      if (!searchText) {
        return true;
      }

      return [
        pkg.PackageIdentifier,
        pkg.PackageName,
        pkg.Publisher,
        ...(pkg.Versions || []).map((version) => version.DefaultLocale?.ShortDescription)
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(searchText);
    })
    .map((pkg) => ({
      PackageIdentifier: pkg.PackageIdentifier,
      PackageName: pkg.PackageName,
      Publisher: pkg.Publisher,
      Versions: (pkg.Versions || []).map((version) => ({
        PackageVersion: version.PackageVersion
      }))
    }));

  return response(packages);
}

function mapKeys(source, keyMap) {
  return Object.fromEntries(
    Object.entries(keyMap)
      .filter(([from]) => source[from] !== undefined)
      .map(([from, to]) => [to, source[from]])
  );
}

function packageManifest(packageId, version) {
  const entry = packageIndex().find((pkg) => normalizePackageId(pkg.PackageIdentifier) === normalizePackageId(packageId));
  if (!entry) {
    return null;
  }

  const manifestVersion = version || latestVersion(entry);
  const manifestPath = packageManifestPath(entry.PackageIdentifier, manifestVersion);
  if (!manifestPath || !fs.existsSync(manifestPath)) {
    return null;
  }

  const raw = readJson(manifestPath).data;
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
