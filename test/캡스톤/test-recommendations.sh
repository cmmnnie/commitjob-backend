#!/bin/bash

echo "=== CommitJob API 테스트 스크립트 ==="

# 1. 건강 체크
echo "1. 서비스 건강 체크..."
echo "- 메인 백엔드 (4001):"
curl -s http://localhost:4001/api/health | jq .
echo ""

echo "- MCP 추천 서비스 (4002):"
curl -s http://localhost:4002/health | jq .
echo ""

# 2. 추천 시스템 테스트
echo "2. 맞춤형 공고 추천 테스트..."

# 테스트 데이터 준비
cat << 'EOF' > /tmp/recommendation_test.json
{
  "user_profile": {
    "skills": ["JavaScript", "React", "Node.js"],
    "experience": "3년",
    "preferred_regions": ["서울", "경기"],
    "jobs": "백엔드 개발자",
    "expected_salary": "5000"
  },
  "job_candidates": [
    {
      "job_id": "job_001",
      "title": "백엔드 개발자",
      "company": "네이버",
      "skills": ["Java", "Spring Boot", "MySQL"],
      "experience": "3-5년",
      "location": "경기 성남시",
      "salary": "5000-7000만원"
    },
    {
      "job_id": "job_002",
      "title": "프론트엔드 개발자",
      "company": "카카오",
      "skills": ["React", "JavaScript", "TypeScript"],
      "experience": "1-3년",
      "location": "제주시",
      "salary": "4000-6000만원"
    },
    {
      "job_id": "job_003",
      "title": "풀스택 개발자",
      "company": "쿠팡",
      "skills": ["Node.js", "React", "MongoDB"],
      "experience": "신입-2년",
      "location": "서울 송파구",
      "salary": "3500-5000만원"
    }
  ],
  "limit": 3
}
EOF

echo "추천 API 호출 중..."
curl -X POST http://localhost:4002/tools/rerank_jobs \
  -H "Content-Type: application/json" \
  -d @/tmp/recommendation_test.json | jq .

echo ""

# 3. 면접 질문 생성 테스트
echo "3. 맞춤형 면접 질문 테스트..."

cat << 'EOF' > /tmp/interview_test.json
{
  "user_profile": {
    "skills": ["JavaScript", "React", "Node.js"],
    "experience": "3년",
    "preferred_jobs": "백엔드 개발자"
  },
  "job_detail": {
    "title": "백엔드 개발자",
    "company": "네이버",
    "skills": ["Java", "Spring Boot", "MySQL"],
    "description": "Spring Boot를 이용한 백엔드 시스템 개발"
  }
}
EOF

echo "면접 질문 API 호출 중..."
curl -X POST http://localhost:4002/tools/generate_interview \
  -H "Content-Type: application/json" \
  -d @/tmp/interview_test.json | jq .

echo ""

# 4. 카카오 로그인 URL 테스트
echo "4. 카카오 소셜 로그인 URL 테스트..."
curl -s "http://localhost:4001/auth/kakao/login-url?origin=http://localhost:5173" | jq .

echo ""
echo "=== 테스트 완료 ==="

# 임시 파일 정리
rm -f /tmp/recommendation_test.json /tmp/interview_test.json