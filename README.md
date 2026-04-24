# MTG Winget

Private Winget REST source for Midtown Technology Group internal tools.

## Layout

- `source.json`: Winget source metadata
- `index.json`: package index
- `manifests/`: YAML manifests
- `packageManifests/`: pre-indexed JSON package manifests
- `staticwebapp.config.json`: Azure Static Web Apps routing and auth
- `packages/`: package metadata used to generate manifests

## Client usage

```powershell
winget source add -n mtg-tools -a https://<your-swa-hostname>
winget source update
winget search --source mtg-tools
```

## Operations

- Releases are built in the toy repos and uploaded as MSI assets.
- Feed updates are handled here through `update-package.yml`.
- Feed deployment is handled here through `deploy-feed.yml`.
