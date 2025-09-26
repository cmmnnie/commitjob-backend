FROM node:18-alpine

# Python 설치 (catch-scraper용)
RUN apk add --no-cache python3 py3-pip

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 파일 복사
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY mcp-recs-service/package*.json ./mcp-recs-service/
COPY catch-scraper-service/requirements.txt ./catch-scraper-service/

# 의존성 설치
RUN npm install
RUN cd backend && npm install
RUN cd mcp-recs-service && npm install
RUN cd catch-scraper-service && pip3 install -r requirements.txt

# 소스 코드 복사
COPY . .

# 포트 노출
EXPOSE 4001 4002 3000

# 서비스 시작
CMD ["npm", "start"]