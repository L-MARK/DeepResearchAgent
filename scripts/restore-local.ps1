param([Parameter(Mandatory=$true)][string]$Archive)
$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ResolvedArchive = (Resolve-Path -LiteralPath $Archive).Path
Set-Location -LiteralPath $ProjectRoot
python scripts/backup_restore.py restore --archive $ResolvedArchive --confirm
