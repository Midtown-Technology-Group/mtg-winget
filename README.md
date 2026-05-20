# MTG Winget

Private Winget REST source for Midtown Technology Group internal tools.

## Layout

- `source.json`: Winget source metadata
- `index.json`: package index
- `manifests/`: YAML manifests
- `packageManifests/`: pre-indexed JSON package manifests
- `staticwebapp.config.json`: Azure Static Web Apps routing and auth
- `api/`: minimal WinGet REST source endpoints for clients
- `packages/`: package metadata used to generate manifests

## Client usage

```powershell
winget source add -n mtg-tools -a https://winget.midtowntg.com/api -t Microsoft.Rest
winget source update
winget install midtowntechnologygroup.voquill
```

WinGet defaults to the pre-indexed MSIX source type when `-t Microsoft.Rest`
is omitted, which makes it look for `source2.msix` or `source.msix`.

Do not register `mtg-tools` with `--explicit` if bare commands should work.
Explicit sources are excluded from discovery unless every command names the
source. If an existing machine has `mtg-tools` listed as `Explicit true`, remove
and re-add it without `--explicit` from an elevated shell:

```powershell
winget source remove mtg-tools
winget source add -n mtg-tools -a https://winget.midtowntg.com/api -t Microsoft.Rest
winget source update mtg-tools
```

Use `--source mtg-tools` when a command must be pinned to this private source,
and `--source winget` when a public package command must avoid all private
sources.

## Operations

- Releases are built in the toy repos and uploaded as MSI assets.
- Feed updates are handled here through `update-package.yml`.
- Feed deployment is handled here through `deploy-feed.yml`.
