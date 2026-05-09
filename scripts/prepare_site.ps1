$ErrorActionPreference = "Stop"

$site = Join-Path $PSScriptRoot "..\\_site"
if (Test-Path $site) {
    Remove-Item -Recurse -Force $site
}

New-Item -ItemType Directory -Force $site | Out-Null
Copy-Item (Join-Path $PSScriptRoot "..\\index.json") $site
Copy-Item (Join-Path $PSScriptRoot "..\\index.html") $site
Copy-Item (Join-Path $PSScriptRoot "..\\source.json") $site
Copy-Item (Join-Path $PSScriptRoot "..\\information.json") $site
Copy-Item (Join-Path $PSScriptRoot "..\\staticwebapp.config.json") $site
Copy-Item -Recurse (Join-Path $PSScriptRoot "..\\packageManifests") $site
Copy-Item -Recurse (Join-Path $PSScriptRoot "..\\manifests") $site

$apiData = Join-Path $PSScriptRoot "..\\api\\data"
if (Test-Path $apiData) {
    Remove-Item -Recurse -Force $apiData
}

New-Item -ItemType Directory -Force $apiData | Out-Null
Copy-Item (Join-Path $PSScriptRoot "..\\index.json") $apiData
Copy-Item (Join-Path $PSScriptRoot "..\\source.json") $apiData
Copy-Item -Recurse (Join-Path $PSScriptRoot "..\\packageManifests") $apiData
