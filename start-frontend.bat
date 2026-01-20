@echo off
setlocal
cd /d "%~dp0frontend"
set NEXT_PUBLIC_API_URL=http://localhost:8080
npm run dev
endlocal
