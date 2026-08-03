<#
.SYNOPSIS
  Run npm security audit for KnowledgeMap project (root and api).
.DESCRIPTION
  This script runs npm audit on the root project and optionally on api/ if it has a package.json.
  It is non-blocking: it reports vulnerabilities as warnings but does not exit with an error code.
#>

$ErrorActionPreference = "Continue"
$rootDir = Split-Path -Parent $PSScriptRoot
$hasIssues = $false

function Run-Audit {
  param([string]$Path, [string]$Label)

  Write-Host "`n========================================" -ForegroundColor Cyan
  Write-Host "  Security Audit: $Label" -ForegroundColor Cyan
  Write-Host "  Path: $Path" -ForegroundColor Cyan
  Write-Host "========================================`n" -ForegroundColor Cyan

  Push-Location $Path
  try {
    $result = npm audit 2>&1
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
      Write-Host "✓ No vulnerabilities found in $Label" -ForegroundColor Green
    } else {
      $hasIssues = $true
      Write-Host "⚠  Vulnerabilities found in $Label (exit code: $exitCode)" -ForegroundColor Yellow
      Write-Host "`n$result`n" -ForegroundColor Yellow
      Write-Host "Run 'npm audit fix' to auto-fix where possible, or review manually." -ForegroundColor Yellow
    }
  }
  catch {
    $hasIssues = $true
    Write-Host "⚠  Audit failed for $Label : $_" -ForegroundColor Yellow
  }
  finally {
    Pop-Location
  }
}

# --- Root project ---
Run-Audit -Path $rootDir -Label "root"

# --- API project (if exists) ---
$apiPkg = Join-Path (Join-Path $rootDir "api") "package.json"
if (Test-Path $apiPkg) {
  Run-Audit -Path (Join-Path $rootDir "api") -Label "api"
}
else {
  Write-Host "`nℹ Skipping api/ audit (no package.json found)" -ForegroundColor Gray
}

# --- Summary ---
Write-Host "`n========================================" -ForegroundColor Cyan
if ($hasIssues) {
  Write-Host "  Audit complete — some issues found (review warnings above)." -ForegroundColor Yellow
} else {
  Write-Host "  Audit complete — no vulnerabilities detected." -ForegroundColor Green
}
Write-Host "========================================`n" -ForegroundColor Cyan

# Non-blocking: always exit 0
exit 0