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
winget source update
winget search --source mtg-tools
winget install --id MidtownTechnologyGroup.Voquill --exact --source mtg-tools
```

WinGet defaults to the pre-indexed MSIX source type when `-t Microsoft.Rest`
is omitted, which makes it look for `source2.msix` or `source.msix`.

Keep `mtg-tools` registered as an explicit source. If it is implicit, ordinary
commands such as `winget install --id jj-vcs.jj` query this private REST source
alongside the public `winget` source; any stale source state or unsupported REST
endpoint can then fail unrelated public package installs with errors like
`0x8a150044 : The rest API endpoint is not found.` Use `--source mtg-tools`
for MTG packages and `--source winget` for public packages when a command must
be unambiguous.

Use `--id` and `--exact` for installs from `mtg-tools`. A positional query such
as `winget install midtowntechnologygroup.voquill --source mtg-tools` may be
treated by WinGet as a broad search, which can match every
`MidtownTechnologyGroup.*` package before the client asks for a refined target.

## Operations

- Releases are built in the toy repos and uploaded as MSI assets.
- Feed updates are handled here through `update-package.yml`.
- Feed deployment is handled here through `deploy-feed.yml`.
