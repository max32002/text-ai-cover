@echo off
echo.
echo ========================================
echo   Config 視覺化編輯器
echo   AI Cover Generator
echo ========================================
echo.
cd /d "%~dp0"
start "" http://localhost:3737
node editor-server.js
pause
