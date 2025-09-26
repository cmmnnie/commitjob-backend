@echo off
echo 🚀 CommitJob Backend 서비스 시작 중...

REM 기존 프로세스 종료
echo 🔍 기존 프로세스 확인 중...
for /L %%p in (3000,1,4002) do (
    for /f "tokens=5" %%i in ('netstat -ano ^| findstr :%%p') do (
        taskkill /PID %%i /F >nul 2>&1
    )
)

REM 의존성 설치
echo 📦 의존성 확인 중...
if not exist "backend\node_modules" (
    echo Backend 의존성 설치 중...
    cd backend && npm install && cd ..
)

if not exist "mcp-recs-service\node_modules" (
    echo MCP Service 의존성 설치 중...
    cd mcp-recs-service && npm install && cd ..
)

REM 로그 디렉토리 생성
if not exist logs mkdir logs

echo 🚀 서비스 시작 중...

REM 서비스 시작 (백그라운드)
start /B cmd /c "cd catch-scraper-service && python catch_scraper.py > ..\logs\catch-scraper.log 2>&1"
start /B cmd /c "cd mcp-recs-service && npm start > ..\logs\mcp-service.log 2>&1"
start /B cmd /c "cd backend && npm start > ..\logs\backend.log 2>&1"

echo ✅ 모든 서비스가 시작되었습니다!
echo.
echo 📊 접속 URL:
echo   📚 Swagger: http://localhost:4001/api/docs
echo   🔍 Health: http://localhost:4001/health
echo.
echo 🛑 종료하려면: stop-all.bat

timeout /t 5 /nobreak >nul

echo.
echo 서비스 상태 확인 중...
curl -s http://localhost:4001/health >nul 2>&1 && echo ✅ Backend: OK || echo ❌ Backend: Failed
curl -s http://localhost:4002/health >nul 2>&1 && echo ✅ MCP: OK || echo ❌ MCP: Failed
curl -s http://localhost:3000/health >nul 2>&1 && echo ✅ Catch: OK || echo ❌ Catch: Failed

pause