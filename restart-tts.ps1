# Qwen3-TTS Service Restart Script
# For Windows PowerShell

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Qwen3-TTS Service Restart" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Restarting TTS service..." -ForegroundColor Yellow

docker-compose restart tts-service

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Service restarted" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Gray
Write-Host "  View logs:      docker-compose logs -f tts-service" -ForegroundColor White
Write-Host "  Stop service:   .\stop-tts.ps1" -ForegroundColor White
Write-Host "  Check health:   curl http://localhost:8001/health" -ForegroundColor White
Write-Host ""
Write-Host "Verifying service status..." -ForegroundColor Yellow

Start-Sleep -Seconds 3

$logs = docker-compose logs --tail=20 tts-service 2>&1
if ($logs -match "Application startup complete" -or $logs -match "Uvicorn running") {
    Write-Host "✓ Service is running!" -ForegroundColor Green
} else {
    Write-Host "⚠ Service may still be starting. Check logs with: docker-compose logs -f tts-service" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
