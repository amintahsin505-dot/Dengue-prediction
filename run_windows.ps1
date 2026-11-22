# DENGUARD AI - PowerShell Launcher Script
# EDU AI Engineering Hackathon 2026 Edition

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "            DENGUARD AI - PUBLIC HEALTH INTELLIGENCE PLATFORM           " -ForegroundColor Cyan
Write-Host "              EDU AI Engineering Hackathon 2026 Edition                 " -ForegroundColor White
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host ""

$pythonCmd = $null

if (Test-Path ".venv\Scripts\python.exe") {
    $pythonCmd = (Resolve-Path ".venv\Scripts\python.exe").Path
} else {
    $candidates = @(
        "py",
        "python",
        "$env:LOCALAPPDATA\Python\bin\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python310\python.exe"
    )

    foreach ($cand in $candidates) {
        try {
            $cmd = Get-Command $cand -ErrorAction SilentlyContinue
            if ($cmd) {
                $pythonCmd = $cmd.Source
                break
            }
            if (Test-Path $cand) {
                $pythonCmd = $cand
                break
            }
        } catch {}
    }

    if (-not $pythonCmd) {
        Write-Error "Python 3.10+ was not found. Please install Python from https://www.python.org/downloads/"
        exit 1
    }

    if (-not (Test-Path ".venv")) {
        Write-Host "[*] Creating virtual environment (.venv)..." -ForegroundColor Yellow
        & $pythonCmd -m venv .venv
    }

    if (Test-Path ".venv\Scripts\python.exe") {
        $pythonCmd = (Resolve-Path ".venv\Scripts\python.exe").Path
    }
}

Write-Host "[*] Installing/verifying requirements..." -ForegroundColor Yellow
& $pythonCmd -m pip install -r requirements.txt --quiet

Write-Host ""
Write-Host "[*] Launching DENGUARD Local Web Server on http://127.0.0.1:5000..." -ForegroundColor Green
Start-Process "http://127.0.0.1:5000"
& $pythonCmd "backend\app.py"
