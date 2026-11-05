$ErrorActionPreference = "Stop"

$sourceName = "mtg-tools"
$sourceUrl = "https://winget.midtowntg.com/api"

function Get-SourceLine {
    winget source list |
        Select-String -Pattern ("^" + [regex]::Escape($sourceName) + "\s+") |
        Select-Object -First 1
}

$sourceLine = Get-SourceLine
if ($sourceLine) {
    winget source remove $sourceName
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to remove existing source $sourceName. Run from an elevated shell."
    }
}

winget source add -n $sourceName -a $sourceUrl -t Microsoft.Rest --accept-source-agreements
winget source update $sourceName
winget source list

# An explicit source is skipped by discovery, so WinGet could never select it for
# a bare install. Fail loudly if the registration did not stay implicit.
$registeredLine = Get-SourceLine
if (-not $registeredLine -or $registeredLine.ToString() -notmatch "\sFalse\s*$") {
    throw "$sourceName must be registered implicitly (no --explicit) so WinGet can pick it per package."
}
