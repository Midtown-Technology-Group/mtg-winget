<#
.SYNOPSIS
Runs a WinGet command against the source that owns the package.

.DESCRIPTION
`mtg-tools` is registered as an explicit WinGet source, so ordinary WinGet
commands never query the private feed. This script restores the convenient
behaviour for Midtown packages only: it pins `--source mtg-tools` when the
package is published by this feed and `--source winget` otherwise.

The private feed publishes only `MidtownTechnologyGroup.*` identifiers, so the
publisher prefix decides the route without contacting the feed first.

.PARAMETER PackageId
WinGet package identifier, for example MidtownTechnologyGroup.Halocli.

.PARAMETER Command
WinGet command to run. Defaults to `install`.

.PARAMETER DryRun
Print the resolved command instead of running it.

.PARAMETER WingetArguments
Extra arguments forwarded to WinGet.

.EXAMPLE
./scripts/install-package.ps1 MidtownTechnologyGroup.Voquill

.EXAMPLE
./scripts/install-package.ps1 7zip.7zip -Command upgrade

.EXAMPLE
./scripts/install-package.ps1 MidtownTechnologyGroup.Halocli -DryRun
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory, Position = 0)]
    [ValidateNotNullOrEmpty()]
    [string] $PackageId,

    [ValidateSet("install", "upgrade", "show", "search")]
    [string] $Command = "install",

    [switch] $DryRun,

    [Parameter(ValueFromRemainingArguments)]
    [string[]] $WingetArguments
)

$ErrorActionPreference = "Stop"

$privateSourceName = "mtg-tools"
$publicSourceName = "winget"
$privatePublisherPrefix = "midtowntechnologygroup."

$normalizedId = $PackageId.Trim().ToLowerInvariant()
$sourceName = if ($normalizedId.StartsWith($privatePublisherPrefix)) {
    $privateSourceName
}
else {
    $publicSourceName
}

$argumentList = @($Command, "--id", $PackageId, "--exact", "--source", $sourceName) +
    @($WingetArguments | Where-Object { $_ })

if ($DryRun) {
    "winget " + ($argumentList -join " ")
    return
}

if ($sourceName -eq $privateSourceName) {
    winget source list -n $privateSourceName > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "$privateSourceName is not registered. Run ./scripts/register-source.ps1 from an elevated shell."
    }
}

& winget @argumentList
exit $LASTEXITCODE
