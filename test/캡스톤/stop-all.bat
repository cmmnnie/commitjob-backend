@echo off
echo 🛑 CommitJob Backend 서비스 종료 중...

REM 포트별로 프로세스 종료
echo 포트 사용 프로세스 정리 중...
for %%p in (3000 4001 4002) do (
    for /f "tokens=5" %%i in ('netstat -ano ^| findstr :%%p') do (
        echo 포트 %%p 사용 프로세스 종료 중...
        taskkill /PID %%i /F >nul 2>&1
    )
)

REM Node.js 및 Python 프로세스 정리
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1

echo ✅ 모든 서비스가 종료되었습니다!
echo.
echo 🧹 로그 파일:
if exist logs (
    dir logs
) else (
    echo   (로그 폴더 없음)
)

pause