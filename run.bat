@echo off
cd /d "%~dp0"
if not exist .venv (
  py -3.12 -m venv .venv
  if errorlevel 1 (
    echo Python 3.12 was not found. Install Python 3.12 and try again.
    pause
    exit /b 1
  )
)
call .venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python app.py
pause
