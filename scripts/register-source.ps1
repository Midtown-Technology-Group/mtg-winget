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

winget source add -n $sourceName -a $sourceUrl -t Microsoft.Rest --explicit --accept-source-agreements
winget source update $sourceName
winget source list

# An implicit source joins every discovery query, so public packages would depend
# on this private feed. Fail loudly if the registration did not stay explicit.
$registeredLine = Get-SourceLine
if (-not $registeredLine -or $registeredLine.ToString() -notmatch "\sTrue\s*$") {
    throw "$sourceName is not registered as an explicit source."
}
