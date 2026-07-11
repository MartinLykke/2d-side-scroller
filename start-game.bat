@echo off
REM ============================================================
REM  Ashen reigns : local launcher
REM  Starts a small web server and opens the game in Chrome.
REM ============================================================
cd /d "%~dp0"
set PY="C:\Users\marti\AppData\Local\Programs\Python\Python311\python.exe"
echo Starting local server at http://localhost:8000 ...
start "Kingdom server" /min %PY% serve.py
REM give the server a moment, then open the browser
timeout /t 1 >nul
start "" "http://localhost:8000/"
echo.
echo The game opens in your browser. Close this window to stop the server.
echo (If port 8000 is taken: change 8000 in this file to e.g. 8080.)
pause >nul
