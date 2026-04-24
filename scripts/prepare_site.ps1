$ErrorActionPreference = "Stop"

$site = Join-Path $PSScriptRoot "..\\_site"
if (Test-Path $site) {
    Remove-Item -Recurse -Force $site
}

New-Item -ItemType Directory -Force $site | Out-Null
Copy-Item (Join-Path $PSScriptRoot "..\\index.json") $site
Copy-Item (Join-Path $PSScriptRoot "..\\index.html") $site
Copy-Item (Join-Path $PSScriptRoot "..\\source.json") $site
Copy-Item (Join-Path $PSScriptRoot "..\\staticwebapp.config.json") $site
Copy-Item -Recurse (Join-Path $PSScriptRoot "..\\packageManifests") $site
Copy-Item -Recurse (Join-Path $PSScriptRoot "..\\manifests") $site
