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
}

winget source add -n $sourceName -a $sourceUrl -t Microsoft.Rest --accept-source-agreements
winget source update $sourceName
winget source list
