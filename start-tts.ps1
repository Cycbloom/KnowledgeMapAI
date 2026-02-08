# Qwen3-TTS Service Startup Script
# For Windows PowerShell

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Qwen3-TTS Service Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Please select startup mode:" -ForegroundColor Yellow
Write-Host "  1. CPU Mode (Default, compatible)" -ForegroundColor White
Write-Host "  2. GPU Mode (Requires NVIDIA GPU, faster)" -ForegroundColor Green
Write-Host ""

$choice = Read-Host "Please enter option (1-2): "

if ($choice -eq "1") {
    Write-Host ""
    Write-Host "Starting CPU mode..." -ForegroundColor Yellow
    docker-compose up -d tts-service
} elseif ($choice -eq "2") {
    Write-Host ""
    Write-Host "Starting GPU mode..." -ForegroundColor Green
    Write-Host "Note: Ensure NVIDIA drivers and Docker GPU support are installed" -ForegroundColor Yellow
    docker-compose -f docker-compose.gpu.yml up -d tts-service
} else {
    Write-Host ""
    Write-Host "Invalid option, using default CPU mode..." -ForegroundColor Red
    docker-compose up -d tts-service
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Service starting..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "View logs: docker-compose logs -f tts-service" -ForegroundColor Gray
Write-Host "Stop service: docker-compose down tts-service" -ForegroundColor Gray
Write-Host "Restart service: docker-compose restart tts-service" -ForegroundColor Gray
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")