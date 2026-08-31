@echo off
cd /d "%~dp0"

git status
git add .
git commit -m "new changes"

git pull --rebase origin main
if errorlevel 1 (
    echo.
    echo REBASE FAILED - resolve conflicts first
    pause
    exit /b 1
)

git push origin main
git status
pause