param([string]$Archive = "")
$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location -LiteralPath $ProjectRoot
if (-not $Archive) { $Archive = Join-Path $ProjectRoot ("backups\local-mvp-{0}.zip" -f (Get-Date -Format "yyyyMMdd-HHmmss")) }
python scripts/backup_restore.py backup --archive $Archive
