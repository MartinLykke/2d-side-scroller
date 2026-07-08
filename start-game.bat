@echo off
REM ============================================================
REM  Ashen reigns : local launcher
REM  Starts a small web server and opens the game in Chrome.
REM ============================================================
cd /d "%~dp0"
set PY="C:\Users\marti\AppData\Local\Programs\Python\Python311\python.exe"
echo Starter lokal server paa http://localhost:8000 ...
start "Kingdom server" /min %PY% serve.py
REM give the server a moment, then open the browser
timeout /t 1 >nul
start "" "http://localhost:8000/"
echo.
echo Spillet aabnes i din browser. Luk dette vindue for at stoppe serveren.
echo (Hvis port 8000 er optaget: aendr 8000 her i filen til fx 8080.)
pause >nul
