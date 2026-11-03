# MTG Winget agent guide

This repository publishes the private WinGet REST feed for Midtown tools. Read [README.md](README.md), [source.json](source.json), and the relevant package metadata before changing identifiers, source routing, or release automation.

## Code and generated data

`packages/` contains package metadata; `scripts/update_package.py` generates versioned YAML manifests, JSON package manifests, and the index. `api/` serves REST endpoints; `staticwebapp.config.json` owns routing and authentication. Preserve package identifiers, installer architecture, SHA256, and MSI ProductCode relationships. Never invent release metadata or change hashes to bypass validation.

## Verification

The deployment workflow runs `npm --prefix api test` with `WINGET_DATA_ROOT` set to the repository root, then `./scripts/prepare_site.ps1` in PowerShell. Reproduce those checks for feed/API changes and inspect the generated diff. They do not prove the Azure site was deployed or a client can install the package.

Use [.github/workflows/update-package.yml](.github/workflows/update-package.yml) for the package-update PR path and [.github/workflows/deploy-feed.yml](.github/workflows/deploy-feed.yml) for feed deployment. Releases and MSI builds belong in each toy's source repository. Confirm the installer asset, version, hash, and ProductCode before updating the feed.

## Client and release boundaries

The source is `Microsoft.Rest`; retain that distinction from `Microsoft.PreIndexed.Package` sources. `--explicit` changes discovery, and `--source` pins a client operation. Do not remove or re-register a user's sources as a validation shortcut.

Publishing the feed or dispatching updates affects downstream installations. Name the exact package and environment, retain Azure authentication boundaries, and verify deployed feed/client behavior independently when authorized. Keep deployment and dispatch credentials out of committed files and logs.

## Secret gate before publication

Before publishing the current PR branch, commit the complete candidate and run
`python3 scripts/secret_gate.py` (native Windows: `python`). Require exit 0;
missing tooling/authentication, scan errors and skipped scans block publication.
Then run the existing repository gates. Repeat after changing outgoing commits.
Push exactly the scanned HEAD. This PR scan covers the current branch against its
fetched intended base; other refs, multi-ref pushes and rewritten history require
`--pre-push` with Git's complete ref-update stream. Stop if any pushed ref is
uncovered. See [secret scanning](SECRET-SCANNING.md) for base selection, new branches,
pre-push input and prerequisites. Preserve GitGuardian App, CI and Gitleaks checks.
