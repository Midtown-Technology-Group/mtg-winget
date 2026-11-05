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
winget source update mtg-tools
winget install MidtownTechnologyGroup.Voquill
```

WinGet queries every non-explicit source, so it selects `mtg-tools` exactly when
this feed publishes the requested package and the public `winget` source
otherwise. `winget search 7zip` returns 7-Zip with no sign-in prompt, and a bare
`winget install MidtownTechnologyGroup.Voquill` resolves against this feed.

Discovery stays anonymous: `manifestSearch` answers without a token so WinGet
can tell "not published here" apart from "sign in first", which is what makes
per-package source selection work. Package manifests, which carry installer
URLs, hashes, and ProductCodes, require a Microsoft Entra token, so the sign-in
prompt appears only when an MTG package is actually installed. The token is for
Azure Resource Manager and the feed accepts only tokens issued by the Midtown
tenant to the WinGet client.

If the feed is unreachable, WinGet prints
`Failed when searching source; results will not be included: mtg-tools` and
continues with the remaining sources.

WinGet defaults to the pre-indexed MSIX source type when `-t Microsoft.Rest`
is omitted, which makes it look for `source2.msix` or `source.msix`.

Do not register `mtg-tools` with `--explicit`. An explicit source is skipped by
discovery, so a bare `winget install <id>` can never select it and every command
would have to name `--source mtg-tools`. If a machine has `mtg-tools` listed as
`Explicit true`, remove and re-add it from an elevated shell:

```powershell
winget source remove mtg-tools
winget source add -n mtg-tools -a https://winget.midtowntg.com/api -t Microsoft.Rest
winget source update mtg-tools
```

Use `--source mtg-tools` when a command must be pinned to this private source and
`--source winget` to force a public package. `scripts/install-package.ps1` does
that pinning for you (`-DryRun` prints the command) when determinism matters more
than dynamic selection.

## Operations

- Releases are built in the toy repos and uploaded as MSI assets.
- Feed updates are handled here through `update-package.yml`.
- Feed deployment is handled here through `deploy-feed.yml`.
