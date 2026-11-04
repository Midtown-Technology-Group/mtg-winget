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
winget source add -n mtg-tools -a https://winget.midtowntg.com/api -t Microsoft.Rest --explicit
winget source update mtg-tools
winget install --id MidtownTechnologyGroup.Voquill --source mtg-tools
```

Register `mtg-tools` with `--explicit`. WinGet queries an explicit source only
for commands that name it with `--source`, so ordinary commands such as
`winget install 7zip.7zip` never contact this private feed, never wait on its
Microsoft Entra sign-in prompt, and never see its failures. The feed is picked
only for packages it actually publishes, which is every
`MidtownTechnologyGroup.*` identifier.

`scripts/install-package.ps1` applies that rule: it pins `--source mtg-tools`
for Midtown packages and `--source winget` for everything else. Add `-DryRun` to
print the command instead of running it.

```powershell
./scripts/install-package.ps1 MidtownTechnologyGroup.Halocli
./scripts/install-package.ps1 7zip.7zip
```

The source requires WinGet 1.7 or newer. WinGet obtains a Microsoft Entra token
for Azure Resource Manager and the feed accepts only tokens issued by the
Midtown tenant to the WinGet client. Interactive commands may prompt the user
to sign in with their Midtown account. Package search and manifest endpoints
return `401` without a valid token.

WinGet defaults to the pre-indexed MSIX source type when `-t Microsoft.Rest`
is omitted, which makes it look for `source2.msix` or `source.msix`.

Keep `mtg-tools` explicit. An implicit (non-explicit) source is added to every
discovery operation, so each `winget search` or `winget install` also queries
this feed, announces the Entra sign-in prompt, and prints
`Failed when searching source; results will not be included: mtg-tools` when the
token is missing or stale. If an existing machine has `mtg-tools` listed as
`Explicit false`, remove and re-add it from an elevated shell:

```powershell
winget source remove mtg-tools
winget source add -n mtg-tools -a https://winget.midtowntg.com/api -t Microsoft.Rest --explicit
winget source update mtg-tools
```

Use `--source mtg-tools` for MTG packages and `--source winget` for public
packages when a command must be unambiguous.

## Operations

- Releases are built in the toy repos and uploaded as MSI assets.
- Feed updates are handled here through `update-package.yml`.
- Feed deployment is handled here through `deploy-feed.yml`.
