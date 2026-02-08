# Qwen3-TTS Service Startup Script
# For Windows PowerShell

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Qwen3-TTS Service Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Select mode:" -ForegroundColor Yellow
Write-Host "  1. GPU mode (Recommended)" -ForegroundColor Green
Write-Host "  2. CPU mode" -ForegroundColor Gray
Write-Host ""

$mode = Read-Host "Enter your choice (1-2, default: 1)"

if ([string]::IsNullOrWhiteSpace($mode)) {
    $mode = "1"
}

Write-Host ""

if ($mode -eq "2") {
    Write-Host "Starting TTS service (CPU mode)..." -ForegroundColor Yellow
    Write-Host "Note: CPU mode is slower. GPU mode is recommended for better performance." -ForegroundColor Gray
    Write-Host ""
    
    docker-compose up -d tts-service
} else {
    Write-Host "Starting TTS service (GPU mode)..." -ForegroundColor Green
    Write-Host "Note: Make sure NVIDIA Container Toolkit is installed." -ForegroundColor Gray
    Write-Host ""
    
    docker-compose up -d tts-service
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Service starting..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Gray
Write-Host "  View logs:      docker-compose logs -f tts-service" -ForegroundColor White
Write-Host "  Stop service:   docker-compose down tts-service" -ForegroundColor White
Write-Host "  Restart:        docker-compose restart tts-service" -ForegroundColor White
Write-Host "  Check health:   curl http://localhost:8001/health" -ForegroundColor White
Write-Host ""
Write-Host "Test TTS:" -ForegroundColor Gray
Write-Host "  curl -X POST http://localhost:8001/tts -H 'Content-Type: application/json' -d '{\"text\":\"你好\",\"voice\":\"Vivian\"}' --output test.mp3" -ForegroundColor White
Write-Host ""
Write-Host "Verifying GPU (if GPU mode)..." -ForegroundColor Yellow

Start-Sleep -Seconds 3

$logs = docker-compose logs --tail=20 tts-service 2>&1
if ($logs -match "CUDA available: True" -or $logs -match "device: cuda") {
    Write-Host "✓ GPU detected and being used!" -ForegroundColor Green
} elseif ($logs -match "CUDA available: False" -or $logs -match "device: cpu") {
    Write-Host "⚠ GPU not detected, using CPU mode" -ForegroundColor Yellow
    Write-Host "  Make sure NVIDIA Container Toolkit is installed:" -ForegroundColor Gray
    Write-Host "  1. Install NVIDIA Container Toolkit in WSL2" -ForegroundColor Gray
    Write-Host "  2. Run: nvidia-ctk runtime configure --runtime=docker" -ForegroundColor Gray
    Write-Host "  3. Restart Docker: sudo systemctl restart docker" -ForegroundColor Gray
} else {
    Write-Host "⚠ Unable to verify GPU status. Check logs with: docker-compose logs tts-service" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
