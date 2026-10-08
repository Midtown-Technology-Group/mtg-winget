from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit
from uuid import UUID


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT
MANIFEST_VERSION = "1.5.0"
PACKAGE_KEY_RE = re.compile(r"[a-z0-9][a-z0-9_-]*\Z")
VERSION_RE = re.compile(r"[0-9]+\.[0-9]+\.[0-9]+(?:\.[0-9]+)?(?:-[A-Za-z0-9.-]+)?\Z")
SHA256_RE = re.compile(r"[0-9a-fA-F]{64}\Z")


def validate_metadata(package_key: str, version: str, installer_url: str, sha256: str, product_code: str) -> None:
    """Reject unsafe dispatch values before using them as paths or manifest data."""
    if not PACKAGE_KEY_RE.fullmatch(package_key) or not (SOURCE_ROOT / "packages" / f"{package_key}.json").is_file():
        raise ValueError("unknown or invalid package key")
    if not VERSION_RE.fullmatch(version):
        raise ValueError("invalid package version")
    if not SHA256_RE.fullmatch(sha256):
        raise ValueError("invalid installer SHA256")
    if any(char.isspace() or ord(char) < 32 for char in installer_url):
        raise ValueError("invalid installer URL")
    parsed_url = urlsplit(installer_url)
    if parsed_url.scheme != "https" or not parsed_url.hostname or parsed_url.username or parsed_url.password:
        raise ValueError("installer URL must be HTTPS without embedded credentials")
    if product_code:
        try:
            UUID(product_code)
        except ValueError as error:
            raise ValueError("invalid MSI ProductCode") from error


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def dump_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    if len(sys.argv) != 6:
        raise SystemExit(
            "usage: update_package.py <package-key> <version> <installer-url> <sha256> <product-code>"
        )

    package_key, version, installer_url, sha256, product_code = sys.argv[1:]
    validate_metadata(package_key, version, installer_url, sha256, product_code)

    package_meta = load_json(SOURCE_ROOT / "packages" / f"{package_key}.json")
    package_id = package_meta["packageIdentifier"]
    package_name = package_meta["packageName"]
    publisher = package_meta["publisher"]
    package_namespace, package_leaf = package_id.split(".", 1)

    manifest_dir = SOURCE_ROOT / "manifests" / package_id[0].lower() / package_namespace / package_leaf
    package_manifest_dir = (
        SOURCE_ROOT / "packageManifests" / package_id[0].lower() / package_namespace / package_leaf
    )
    manifest_dir.mkdir(parents=True, exist_ok=True)
    package_manifest_dir.mkdir(parents=True, exist_ok=True)

    release_tag_template = package_meta.get("releaseTagTemplate", "v{version}")
    tag = release_tag_template.format(version=version)
    version_yaml = f"""# yaml-language-server: $schema=https://aka.ms/winget-manifest.version.1.5.0.schema.json

PackageIdentifier: {package_id}
PackageVersion: {version}
DefaultLocale: en-US
ManifestType: version
ManifestVersion: {MANIFEST_VERSION}
"""

    product_code_yaml = f"ProductCode: '{product_code}'\n" if product_code else ""
    installer_yaml = f"""# yaml-language-server: $schema=https://aka.ms/winget-manifest.installer.1.5.0.schema.json

PackageIdentifier: {package_id}
PackageVersion: {version}
MinimumOSVersion: 10.0.0.0
InstallerType: {package_meta['installerType']}
Scope: {package_meta['scope']}
UpgradeBehavior: {package_meta['upgradeBehavior']}
{product_code_yaml}\
Installers:
  - Architecture: {package_meta['architecture']}
    InstallerUrl: {installer_url}
    InstallerSha256: {sha256}
    InstallerSwitches:
      Silent: {package_meta['silent']}
      SilentWithProgress: {package_meta['silentWithProgress']}
ManifestType: installer
ManifestVersion: {MANIFEST_VERSION}
"""

    locale_yaml = f"""# yaml-language-server: $schema=https://aka.ms/winget-manifest.defaultLocale.1.5.0.schema.json

PackageIdentifier: {package_id}
PackageVersion: {version}
PackageLocale: en-US
Publisher: {publisher}
PublisherUrl: {package_meta['publisherUrl']}
PublisherSupportUrl: {package_meta['publisherSupportUrl']}
Author: {package_meta['author']}
PackageName: {package_name}
PackageUrl: {package_meta['packageUrl']}
License: {package_meta['license']}
LicenseUrl: {package_meta['licenseUrl']}
Copyright: {package_meta['copyright']}
ShortDescription: {package_meta['shortDescription']}
Description: |
  {package_meta['description']}
Moniker: {package_meta['moniker']}
Tags:
""" + "\n".join(f"  - {tag_item}" for tag_item in package_meta["tags"]) + f"""
ReleaseNotes: |
  {package_meta['releaseNotes']}
ReleaseNotesUrl: https://github.com/{package_meta['repo']}/releases/tag/{tag}
ManifestType: defaultLocale
ManifestVersion: {MANIFEST_VERSION}
"""

    (manifest_dir / "version.yaml").write_text(version_yaml, encoding="utf-8")
    (manifest_dir / f"{version}.yaml").write_text(installer_yaml, encoding="utf-8")
    (manifest_dir / "locale.yaml").write_text(locale_yaml, encoding="utf-8")

    installer = {
        "architecture": package_meta["architecture"],
        "installerType": package_meta["installerType"],
        "scope": package_meta["scope"],
        "installerUrl": installer_url,
        "installerSha256": sha256,
        "upgradeBehavior": package_meta["upgradeBehavior"],
        "installerSwitches": {
            "silent": package_meta["silent"],
            "silentWithProgress": package_meta["silentWithProgress"],
        },
    }
    if product_code:
        installer["productCode"] = product_code

    package_manifest = {
        "$schema": "https://aka.ms/winget-rest-source.schema.json",
        "data": {
            "packageIdentifier": package_id,
            "versions": [
                {
                    "packageVersion": version,
                    "defaultLocale": {
                        "packageLocale": "en-US",
                        "publisher": publisher,
                        "publisherUrl": package_meta["publisherUrl"],
                        "publisherSupportUrl": package_meta["publisherSupportUrl"],
                        "author": package_meta["author"],
                        "packageName": package_name,
                        "packageUrl": package_meta["packageUrl"],
                        "license": package_meta["license"],
                        "licenseUrl": package_meta["licenseUrl"],
                        "copyright": package_meta["copyright"],
                        "shortDescription": package_meta["shortDescription"],
                        "description": package_meta["description"],
                        "moniker": package_meta["moniker"],
                        "tags": package_meta["tags"],
                        "releaseNotes": package_meta["releaseNotes"],
                        "releaseNotesUrl": f"https://github.com/{package_meta['repo']}/releases/tag/{tag}",
                    },
                    "installers": [installer],
                }
            ],
        },
    }
    dump_json(package_manifest_dir / f"{version}.json", package_manifest)

    index_path = SOURCE_ROOT / "index.json"
    index_data = load_json(index_path)
    packages = index_data["packages"]
    package_entry = next((item for item in packages if item["PackageIdentifier"] == package_id), None)
    if package_entry is None:
        package_entry = {
            "PackageIdentifier": package_id,
            "PackageName": package_name,
            "Publisher": publisher,
            "Versions": [],
        }
        packages.append(package_entry)
    package_entry["PackageName"] = package_name
    package_entry["Publisher"] = publisher
    package_entry["Versions"] = [
        {
            "PackageVersion": version,
            "DefaultLocale": {
                "PackageLocale": "en-US",
                "Publisher": publisher,
                "PackageName": package_name,
                "ShortDescription": package_meta["shortDescription"],
            },
        }
    ]
    dump_json(index_path, index_data)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
