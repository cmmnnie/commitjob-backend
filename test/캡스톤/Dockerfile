FROM node:18-bullseye-slim

# Python 및 시스템 의존성 설치
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 파일 복사 및 설치
COPY package*.json ./
RUN npm install

COPY backend/package*.json ./backend/
RUN cd backend && npm install

COPY mcp-recs-service/package*.json ./mcp-recs-service/
RUN cd mcp-recs-service && npm install

# Python 의존성 설치 (requirements.txt가 있다면)
COPY catch-scraper-service/requirements.txt ./catch-scraper-service/
RUN cd catch-scraper-service && pip3 install -r requirements.txt

# 소스 코드 복사
COPY . .

# 포트 설정
ENV PORT=4001
EXPOSE 4001

# 백엔드만 시작 (Render에서는 단일 프로세스 권장)
CMD ["node", "backend/server.js"]