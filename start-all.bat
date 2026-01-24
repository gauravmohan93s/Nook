@echo off
echo Starting Nook...

start "Nook Backend" cmd /k "call start-backend.bat"
start "Nook Frontend" cmd /k "call start-frontend.bat"

echo Backend and Frontend launching in new windows...
