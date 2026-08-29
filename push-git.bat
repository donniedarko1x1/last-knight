@echo off
cd /d "%~dp0"

git status
git add .
git commit -m "new changes"
git push origin main
git status

pause
