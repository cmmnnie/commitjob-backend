#!/bin/bash

echo "🚀 CommitJob Backend 서비스 시작 중..."

# 기존 프로세스 종료
echo "🔍 기존 프로세스 확인 중..."
for port in 3000 4001 4002; do
    PID=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$PID" ]; then
        echo "⚠️  포트 $port 사용 중인 프로세스 종료"
        kill -9 $PID 2>/dev/null
    fi
done

# 의존성 설치
echo "📦 의존성 확인 중..."
if [ ! -d "backend/node_modules" ]; then
    echo "Backend 의존성 설치 중..."
    (cd backend && npm install)
fi

if [ ! -d "mcp-recs-service/node_modules" ]; then
    echo "MCP Service 의존성 설치 중..."
    (cd mcp-recs-service && npm install)
fi

# 로그 디렉토리 생성
mkdir -p logs

echo "🚀 서비스 시작 중..."

# 서비스 시작 (백그라운드)
(cd catch-scraper-service && python3 catch_scraper.py) > logs/catch-scraper.log 2>&1 &
CATCH_PID=$!

(cd mcp-recs-service && npm start) > logs/mcp-service.log 2>&1 &
MCP_PID=$!

(cd backend && npm start) > logs/backend.log 2>&1 &
BACKEND_PID=$!

# PID 저장
echo $CATCH_PID > logs/catch-scraper.pid
echo $MCP_PID > logs/mcp-service.pid
echo $BACKEND_PID > logs/backend.pid

echo "✅ 모든 서비스가 시작되었습니다!"
echo ""
echo "📊 접속 URL:"
echo "  📚 Swagger: http://localhost:4001/api/docs"
echo "  🔍 Health: http://localhost:4001/health"
echo ""
echo "🛑 종료하려면: ./stop-all.sh"

sleep 3
echo ""
echo "서비스 상태 확인 중..."

curl -s http://localhost:4001/health > /dev/null && echo "✅ Backend: OK" || echo "❌ Backend: Failed"
curl -s http://localhost:4002/health > /dev/null && echo "✅ MCP: OK" || echo "❌ MCP: Failed"
curl -s http://localhost:3000/health > /dev/null && echo "✅ Catch: OK" || echo "❌ Catch: Failed"