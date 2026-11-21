@echo off
setlocal enabledelayedexpansion
title DENGUARD AI - Urban Dengue Outbreak Early Warning Platform
cd /d "%~dp0"

echo =========================================================================
echo             DENGUARD AI - PUBLIC HEALTH INTELLIGENCE PLATFORM
echo               EDU AI Engineering Hackathon 2026 Edition
echo =========================================================================
echo.

:: Detect Python executable
set "PY_CMD="
if exist ".venv\Scripts\python.exe" (
    set "PY_CMD=.venv\Scripts\python.exe"
    goto :found_python
)

where py >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set "PY_CMD=py -3"
    goto :check_venv
)

where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set "PY_CMD=python"
    goto :check_venv
)

if exist "%LOCALAPPDATA%\Python\bin\python.exe" (
    set "PY_CMD=%LOCALAPPDATA%\Python\bin\python.exe"
    goto :check_venv
)

if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    goto :check_venv
)

if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
    set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    goto :check_venv
)

if exist "%LOCALAPPDATA%\Programs\Python\Python310\python.exe" (
    set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
    goto :check_venv
)

echo [ERROR] Python was not found on your system.
echo Please install Python 3.10+ from https://www.python.org/downloads/
echo and ensure "Add python.exe to PATH" is checked.
pause
exit /b 1

:check_venv
if not exist ".venv" (
    echo [*] Creating virtual environment in .venv...
    %PY_CMD% -m venv .venv
    if %ERRORLEVEL% neq 0 (
        echo [!] Virtual environment creation failed. Running with system Python...
        goto :install_deps
    )
)

set "PY_CMD=.venv\Scripts\python.exe"

:found_python
:install_deps
echo [*] Checking dependencies...
"%PY_CMD%" -m pip install -r requirements.txt --quiet
if %ERRORLEVEL% neq 0 (
    echo [!] Warning: Dependency check returned code %ERRORLEVEL%. Attempting startup...
)

echo.
echo [*] Starting DENGUARD local server...
echo [*] Dashboard will be available at: http://127.0.0.1:5000
echo [*] Press Ctrl+C in this terminal window to stop the server.
echo.

start "" "http://127.0.0.1:5000"
"%PY_CMD%" backend\app.py

pause
