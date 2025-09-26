# 🎨 프론트엔드 개발자를 위한 API 가이드

## 📍 API 서버 정보

```
Main Backend: http://localhost:4001
MCP Service:  http://localhost:4002
Catch Scraper: http://localhost:3000
```

## 🔗 Swagger API 문서
**http://localhost:4001/api/docs** - 모든 API 엔드포인트 확인 가능

## 🔐 인증 시스템

### 소셜 로그인 (Google & Kakao)

```javascript
// 구글 로그인
window.location.href = 'http://localhost:4001/auth/google';

// 카카오 로그인
window.location.href = 'http://localhost:4001/auth/kakao';

// 로그인 상태 확인
const checkUser = async () => {
  const response = await fetch('http://localhost:4001/auth/user', {
    credentials: 'include'
  });
  return response.json();
};

// 로그아웃
const logout = async () => {
  await fetch('http://localhost:4001/auth/logout', {
    credentials: 'include'
  });
  window.location.reload();
};
```

## 🎯 채용공고 추천 API

### 맞춤형 추천 받기

```javascript
const getRecommendations = async (userProfile, jobCandidates) => {
  const response = await fetch('http://localhost:4002/tools/rerank_jobs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_profile: userProfile,
      job_candidates: jobCandidates,
      limit: 10
    })
  });

  return response.json();
};

// 사용 예시
const userProfile = {
  user_id: "user123",
  skills: ["JavaScript", "React", "Node.js"],
  experience_years: 3,
  preferred_location: "서울",
  preferred_salary: 50000000
};

const jobCandidates = [
  {
    title: "프론트엔드 개발자",
    company: "네이버",
    location: "서울",
    salary: 55000000,
    required_skills: ["React", "TypeScript"]
  },
  {
    title: "풀스택 개발자",
    company: "카카오",
    location: "경기",
    salary: 60000000,
    required_skills: ["Node.js", "React"]
  }
];

const recommendations = await getRecommendations(userProfile, jobCandidates);
console.log(recommendations);

// 응답 형식:
// {
//   "success": true,
//   "recommendations": [
//     {
//       "title": "프론트엔드 개발자",
//       "company": "네이버",
//       "recommendation_score": 0.89,
//       "match_reasons": ["기술 스택 90% 일치", "위치 선호도 100%"]
//     }
//   ]
// }
```

## 🤔 면접 질문 생성 API

```javascript
const generateInterviewQuestions = async (userProfile, jobInfo) => {
  const response = await fetch('http://localhost:4002/tools/generate_interview', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_profile: userProfile,
      job_info: jobInfo
    })
  });

  return response.json();
};

// 사용 예시
const userProfile = {
  skills: ["JavaScript", "React"],
  experience_years: 2,
  target_position: "프론트엔드 개발자"
};

const jobInfo = {
  company: "네이버",
  position: "React 개발자",
  required_skills: ["React", "TypeScript", "Next.js"]
};

const interviewQuestions = await generateInterviewQuestions(userProfile, jobInfo);
console.log(interviewQuestions);

// 응답 형식:
// {
//   "success": true,
//   "questions": [
//     {
//       "category": "기술",
//       "question": "React의 Virtual DOM에 대해 설명해주세요.",
//       "difficulty": "중급"
//     },
//     {
//       "category": "경험",
//       "question": "지금까지의 프론트엔드 개발 경험을 말씀해주세요.",
//       "difficulty": "초급"
//     }
//   ]
// }
```

## 🏢 기업 정보 API

### 종합 채용 정보 조회

```javascript
const getCompanyInfo = async (companyName) => {
  const response = await fetch('http://localhost:4001/api/comprehensive-job-info', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      company_name: companyName
    })
  });

  return response.json();
};

// 사용 예시
const companyInfo = await getCompanyInfo("삼성전자");
console.log(companyInfo);

// 응답 형식:
// {
//   "success": true,
//   "company_name": "삼성전자",
//   "data": {
//     "company_reviews": { ... },  // 기업 리뷰
//     "job_essays": { ... },       // 합격 자소서
//     "job_tips": { ... }          // 지원 꿀팁
//   }
// }
```

### 개별 정보 조회

```javascript
// 기업 리뷰만 조회
const getCompanyReviews = async (companyName) => {
  const response = await fetch('http://localhost:4001/api/company-info', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ company_name: companyName })
  });
  return response.json();
};

// 합격 자소서만 조회
const getJobEssays = async (companyName) => {
  const response = await fetch('http://localhost:4001/api/job-essays', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ company_name: companyName })
  });
  return response.json();
};

// 지원 꿀팁만 조회
const getJobTips = async (companyName) => {
  const response = await fetch('http://localhost:4001/api/job-tips', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ company_name: companyName })
  });
  return response.json();
};
```

## 🛠️ React 통합 예제

### 1. API 클라이언트 설정

```javascript
// api.js
import axios from 'axios';

const mainAPI = axios.create({
  baseURL: 'http://localhost:4001',
  withCredentials: true
});

const mcpAPI = axios.create({
  baseURL: 'http://localhost:4002'
});

export { mainAPI, mcpAPI };
```

### 2. 커스텀 훅 예제

```javascript
// hooks/useRecommendations.js
import { useState, useEffect } from 'react';
import { mcpAPI } from '../api';

export const useRecommendations = (userProfile, jobCandidates) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getRecommendations = async () => {
    if (!userProfile || !jobCandidates.length) return;

    setLoading(true);
    try {
      const response = await mcpAPI.post('/tools/rerank_jobs', {
        user_profile: userProfile,
        job_candidates: jobCandidates,
        limit: 10
      });
      setRecommendations(response.data.recommendations);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getRecommendations();
  }, [userProfile, jobCandidates]);

  return { recommendations, loading, error, refresh: getRecommendations };
};
```

### 3. 로그인 컴포넌트

```javascript
// components/LoginButtons.jsx
import React from 'react';

const LoginButtons = () => {
  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:4001/auth/google';
  };

  const handleKakaoLogin = () => {
    window.location.href = 'http://localhost:4001/auth/kakao';
  };

  return (
    <div className="login-buttons">
      <button
        onClick={handleGoogleLogin}
        className="btn btn-google"
      >
        구글로 로그인
      </button>
      <button
        onClick={handleKakaoLogin}
        className="btn btn-kakao"
      >
        카카오로 로그인
      </button>
    </div>
  );
};

export default LoginButtons;
```

### 4. 추천 컴포넌트

```javascript
// components/JobRecommendations.jsx
import React from 'react';
import { useRecommendations } from '../hooks/useRecommendations';

const JobRecommendations = ({ userProfile, jobCandidates }) => {
  const { recommendations, loading, error } = useRecommendations(userProfile, jobCandidates);

  if (loading) return <div>추천 분석 중...</div>;
  if (error) return <div>오류: {error}</div>;

  return (
    <div className="job-recommendations">
      <h2>맞춤형 채용공고 추천</h2>
      {recommendations.map((job, index) => (
        <div key={index} className="job-card">
          <h3>{job.title}</h3>
          <p>{job.company}</p>
          <div className="score">
            추천 점수: {Math.round(job.recommendation_score * 100)}점
          </div>
          <div className="reasons">
            {job.match_reasons?.map((reason, i) => (
              <span key={i} className="reason-tag">{reason}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default JobRecommendations;
```

## 🌐 CORS 설정 확인

프론트엔드 개발 시 허용된 Origin들:
- http://localhost:3000 (Create React App)
- http://localhost:5173 (Vite)
- http://localhost:5174 (Vite alternative)
- https://commitjob.site (배포 도메인)

다른 포트를 사용하는 경우 백엔드 개발자에게 CORS 설정 추가 요청하세요.

## ⚡ 성능 최적화 팁

### 1. API 요청 최적화

```javascript
// 디바운싱을 통한 검색 최적화
import { debounce } from 'lodash';

const debouncedSearch = debounce(async (searchTerm) => {
  const results = await getCompanyInfo(searchTerm);
  setSearchResults(results);
}, 500);
```

### 2. 캐싱 전략

```javascript
// React Query를 사용한 캐싱
import { useQuery } from 'react-query';

const useCompanyData = (companyName) => {
  return useQuery(
    ['company', companyName],
    () => getCompanyInfo(companyName),
    {
      staleTime: 5 * 60 * 1000, // 5분간 캐시
      cacheTime: 10 * 60 * 1000, // 10분간 메모리 보관
      enabled: !!companyName
    }
  );
};
```

## 🚨 에러 처리

### API 에러 처리 패턴

```javascript
const handleAPIError = (error) => {
  if (error.response) {
    // 서버에서 응답을 받았지만 에러 상태
    console.error('API Error:', error.response.data);
    return error.response.data.message || '서버 오류가 발생했습니다.';
  } else if (error.request) {
    // 요청은 보냈지만 응답을 받지 못함
    console.error('Network Error:', error.request);
    return '네트워크 연결을 확인해주세요.';
  } else {
    // 요청 설정 중 오류 발생
    console.error('Request Setup Error:', error.message);
    return '요청 처리 중 오류가 발생했습니다.';
  }
};

// 사용 예시
try {
  const recommendations = await getRecommendations(userProfile, jobCandidates);
} catch (error) {
  const errorMessage = handleAPIError(error);
  setError(errorMessage);
}
```

## 📱 상태 관리 예제 (Redux Toolkit)

```javascript
// store/slices/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { mainAPI } from '../api';

// 비동기 액션
export const checkAuthStatus = createAsyncThunk(
  'auth/checkStatus',
  async () => {
    const response = await mainAPI.get('/auth/user');
    return response.data;
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null
  },
  reducers: {
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkAuthStatus.pending, (state) => {
        state.loading = true;
      })
      .addCase(checkAuthStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.isAuthenticated = !!action.payload.user;
      })
      .addCase(checkAuthStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
        state.isAuthenticated = false;
      });
  }
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;
```

---

## 📞 문의 및 지원

**API 문제 발생 시:**
1. 먼저 Swagger 문서 확인: http://localhost:4001/api/docs
2. 서버 상태 확인: Health Check 엔드포인트 호출
3. 콘솔 에러 로그 확인 및 백엔드 팀에 전달

**개발 완료되었습니다! 프론트엔드 개발 시작하세요! 🚀**