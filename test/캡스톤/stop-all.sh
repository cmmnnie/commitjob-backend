#!/bin/bash

echo "🛑 CommitJob Backend 서비스 종료 중..."

# PID 파일에서 프로세스 종료
if [ -d "logs" ]; then
    for pidfile in logs/*.pid; do
        if [ -f "$pidfile" ]; then
            PID=$(cat "$pidfile")
            if ps -p $PID > /dev/null; then
                echo "프로세스 $PID 종료 중..."
                kill $PID 2>/dev/null
            fi
            rm "$pidfile"
        fi
    done
fi

# 포트별로 프로세스 종료
echo "포트 사용 프로세스 정리 중..."
for port in 3000 4001 4002; do
    PID=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$PID" ]; then
        echo "포트 $port 사용 프로세스 ($PID) 종료"
        kill -9 $PID 2>/dev/null
    fi
done

# Node.js 및 Python 프로세스 정리
pkill -f "node.*server.js" 2>/dev/null
pkill -f "python.*catch_scraper.py" 2>/dev/null

echo "✅ 모든 서비스가 종료되었습니다!"
echo ""
echo "🧹 로그 파일:"
if [ -d "logs" ]; then
    ls -la logs/
else
    echo "  (로그 폴더 없음)"
fi