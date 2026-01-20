@echo off
setlocal
cd /d "%~dp0backend"
set API_BASE_URL=http://localhost:8080
set CACHE_TTL_SECONDS=3600
python -m uvicorn main:app --reload --port 8080
endlocal
