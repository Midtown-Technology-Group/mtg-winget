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
otherwise. `winget search 7zip` returns 7-Zip, and
a bare `winget install MidtownTechnologyGroup.Voquill` resolves against this
feed.

The feed is anonymous by design. WinGet builds a source authenticator and
acquires a token *before* it sends discovery, so a source that advertises
Microsoft Entra makes every WinGet command authenticate and fail (the WinGet
client also cannot get an Azure Resource Manager token in this tenant:
`AADSTS65002`). Anonymous discovery is what lets WinGet answer "not published
here" without a challenge and pick this source per package. Installers are
public GitHub release assets in the toy repositories.

`ProductCode` filters are matched exactly, never by prefix or substring, because
anonymous discovery would otherwise turn them into a value-recovery oracle.

If the feed is unreachable, WinGet prints
`Failed when searching source; results will not be included: mtg-tools` and
continues with the remaining sources.

WinGet defaults to the pre-indexed MSIX source type when `-t Microsoft.Rest`
is omitted, which makes it look for `source2.msix` or `source.msix`.

Keep `mtg-tools` implicit. An explicit source is excluded from discovery, so a
bare `winget install <id>` can no longer select it. If a machine has it listed as
`Explicit true`, remove and re-add it from an elevated shell:

```powershell
winget source remove mtg-tools
winget source add -n mtg-tools -a https://winget.midtowntg.com/api -t Microsoft.Rest
winget source update mtg-tools
```
```

Use `--source mtg-tools` to pin an MTG package and `--source winget` to keep a
command away from this feed entirely. `scripts/install-package.ps1` does that
pinning for you (`-DryRun` prints the command) when determinism matters more than
dynamic selection.

## Operations

- Releases are built in the toy repos and uploaded as MSI assets.
- Feed updates are handled here through `update-package.yml`.
- Feed deployment is handled here through `deploy-feed.yml`.
