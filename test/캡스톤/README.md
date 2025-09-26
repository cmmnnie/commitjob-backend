# 🎓 CommitJob - 졸업작품 프로젝트

> AI 기반 맞춤형 채용공고 추천 및 면접 준비 서비스

## 🚀 구현 완료된 핵심 기능

### ✅ 1. 카카오 소셜로그인
- 카카오 OAuth 2.0 완전 구현
- 로그인 URL: `/auth/kakao?origin=<프론트엔드_URL>`
- 콜백 처리: `/auth/kakao/callback`

### ✅ 2. 맞춤형 공고 추천
- AI 기반 스코어링 시스템 (100점 만점)
  - 기술 스택 매칭 (40점)
  - 경력 레벨 매칭 (20점)
  - 지역 선호도 (15점)
  - 직무 유형 (15점)
  - 급여 조건 (10점)
- API: `POST /tools/rerank_jobs`

### ✅ 3. 맞춤형 면접 질문 생성
- 사용자 프로필 기반 개인화된 면접 질문 생성
- 기술/인성/지원동기별 분류
- 난이도별 질문 제공 (쉬움/보통/어려움)
- API: `POST /tools/generate_interview`

## 🏗️ 시스템 아키텍처

```
Frontend (React) ←→ Backend (Express:4001) ←→ MCP Service (Express:4002)
                         ↓
                    MySQL Database
```

### 서버 구성
- **Main Backend** (포트 4001): 인증, 세션, API 게이트웨이
- **MCP Recommendation Service** (포트 4002): AI 추천 엔진
- **Database**: MySQL (사용자, 프로필, 채용공고, 추천 기록)

## 🛠️ 설치 및 실행

### 1. 의존성 설치

```bash
# 메인 백엔드
cd backend
npm install

# 추천 서비스
cd ../mcp-recs-service
npm install
```

### 2. 환경 설정

`backend/.env` 파일에 다음 설정:

```env
# 서버 설정
PORT=4001
HOST=127.0.0.1

# 카카오 OAuth
KAKAO_REST_API_KEY=your_kakao_api_key
KAKAO_REDIRECT_URI=your_redirect_uri

# 데이터베이스
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=your_db_user
DB_PASS=your_db_password
DB_NAME=appdb
```

### 3. 데이터베이스 설정

```bash
mysql -u root -p < backend/database-setup.sql
```

### 4. 서비스 실행

```bash
# 터미널 1: MCP 추천 서비스
cd mcp-recs-service
npm start

# 터미널 2: 메인 백엔드
cd backend
npm start
```

## 🧪 테스트

전체 시스템 테스트:

```bash
chmod +x test-recommendations.sh
./test-recommendations.sh
```

## 📊 API 문서

### 인증 API

```http
GET /auth/kakao?origin=http://localhost:5173
→ 카카오 로그인 페이지로 리디렉션

GET /auth/kakao/login-url?origin=http://localhost:5173
→ { "url": "...", "state": "..." }
```

### 추천 API

```http
POST /tools/rerank_jobs
Content-Type: application/json

{
  "user_profile": {
    "skills": ["JavaScript", "React"],
    "experience": "3년",
    "preferred_regions": ["서울"],
    "jobs": "백엔드 개발자"
  },
  "job_candidates": [...],
  "limit": 5
}
```

### 면접 API

```http
POST /tools/generate_interview
Content-Type: application/json

{
  "user_profile": {
    "skills": ["JavaScript", "React"],
    "experience": "3년"
  },
  "job_detail": {
    "title": "백엔드 개발자",
    "company": "네이버"
  }
}
```

## 🎯 테스트 결과

### 추천 시스템 테스트
- ✅ 기술 스택 매칭: JavaScript, React 매칭 시 정확한 스코어링
- ✅ 경력 매칭: 3년 경력자에게 적합한 공고 우선 추천
- ✅ 지역 매칭: 서울/경기 선호 시 해당 지역 공고 우선 추천

### 면접 시스템 테스트
- ✅ 기술별 맞춤 질문: React, Node.js 관련 구체적 질문 생성
- ✅ 경력별 질문: 3년 경력자에게 적합한 심화 질문
- ✅ 회사별 질문: 네이버 지원 시 회사별 특화 질문

### 소셜로그인 테스트
- ✅ 카카오 OAuth 플로우 완벽 구현
- ✅ 상태값(state) 검증 및 CSRF 방지
- ✅ 안전한 리디렉션 및 세션 관리

## 📁 프로젝트 구조

```
캡스톤/
├── backend/                    # 메인 백엔드 서비스
│   ├── server.js              # Express 서버
│   ├── database-setup.sql     # 데이터베이스 스키마
│   ├── package.json
│   └── .env
├── mcp-recs-service/          # AI 추천 서비스
│   ├── server.js              # 추천 엔진
│   └── package.json
├── test-recommendations.sh     # 통합 테스트 스크립트
└── README.md                  # 프로젝트 문서
```

## 🔧 핵심 알고리즘

### 추천 스코어링
```javascript
총점 = 기술매칭(40) + 경력매칭(20) + 지역매칭(15) + 직무매칭(15) + 급여매칭(10)
```

### 면접 질문 생성
1. 기본 질문 (자기소개, 지원동기)
2. 기술 스택별 심화 질문
3. 경력 수준별 맞춤 질문
4. 직무별 전문 질문
5. 마무리 질문

## 📈 성과

- **카카오 소셜로그인**: 100% 구현 완료
- **맞춤형 공고 추천**: AI 기반 스코어링 시스템 완성
- **맞춤형 면접 질문**: 개인화된 질문 생성 알고리즘 완성
- **시스템 통합**: 마이크로서비스 아키텍처 구현
- **API 문서화**: Swagger/OpenAPI 3.0 완성

---

## 💡 향후 개선 사항

1. 프론트엔드 React 앱 연동
2. 실시간 공고 크롤링 시스템
3. 기업 리뷰 및 평점 시스템
4. 면접 연습 화상통화 기능
5. 이력서 AI 분석 및 피드백

**개발 완료일**: 2025년 9월 25일
**개발자**: 캡스톤 프로젝트 팀