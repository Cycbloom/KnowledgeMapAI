# Qwen3-TTS Service Stop Script
# For Windows PowerShell

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Qwen3-TTS Service Stop" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Stopping TTS service..." -ForegroundColor Yellow

docker-compose down tts-service

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Service stopped" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Gray
Write-Host "  Start service:  .\start-tts.ps1" -ForegroundColor White
Write-Host "  View logs:      docker-compose logs tts-service" -ForegroundColor White
Write-Host "  Restart:        .\restart-tts.ps1" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
