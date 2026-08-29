@echo off
cd /d "%~dp0"

git status
git add .
git commit -m "Add prologue cinematic"
git push origin main
git status

pause
