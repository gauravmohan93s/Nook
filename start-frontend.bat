@echo off
setlocal
cd /d "%~dp0frontend"
set NEXT_PUBLIC_API_URL=http://localhost:8080
set AUTH_SECRET=6e6b8a8e8e8e8e8e8e8e8e8e8e8e8e8e
set SENTRY_SUPPRESS_TURBOPACK_WARNING=1
set NODE_PATH=%CD%\node_modules
call npm.cmd run dev
pause
endlocal
