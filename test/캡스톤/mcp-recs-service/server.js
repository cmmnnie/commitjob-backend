import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import axios from 'axios';
import * as cheerio from 'cheerio';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4002;

// OpenAI 클라이언트 초기화 (API 키가 있을 때만)
let openai = null;
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  console.log('✅ OpenAI API 연결됨');
} else {
  console.log('⚠️ OpenAI API 키가 설정되지 않았습니다. Fallback 알고리즘을 사용합니다.');
}

// 캐치 서비스 연결 설정
const CATCH_SERVICE_URL = process.env.CATCH_SERVICE_URL || 'http://localhost:3000';
const DEV_MODE = process.env.DEV_MODE === 'true';

app.use(cors());
app.use(express.json());

// 건강 체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'CommitJob MCP Service with ChatGPT + Catch Integration',
    features: ['job_recommendations', 'interview_questions', 'company_reviews', 'job_tips', 'job_essays'],
    openai_enabled: !!openai,
    catch_service: CATCH_SERVICE_URL,
    dev_mode: DEV_MODE
  });
});

// 공고 추천 API (ChatGPT 기반)
app.post('/tools/rerank_jobs', async (req, res) => {
  try {
    const { user_profile, job_candidates, limit = 5 } = req.body;

    console.log('[RERANK_JOBS] ChatGPT 기반 추천 요청:', {
      user_profile: user_profile ? Object.keys(user_profile) : null,
      candidates_count: job_candidates?.length || 0,
      limit
    });

    if (!user_profile || !Array.isArray(job_candidates)) {
      return res.status(400).json({
        error: 'Invalid input: user_profile and job_candidates array required'
      });
    }

    // 캐치 데이터와 함께 개선된 추천 생성
    const recommendations = await generateEnhancedRecommendations(user_profile, job_candidates, limit);

    res.json({
      success: true,
      recommendations,
      total_candidates: job_candidates.length,
      returned_count: recommendations.length,
      powered_by: openai ? 'ChatGPT-4 + Catch Data' : 'Enhanced Algorithm + Catch Data'
    });

  } catch (error) {
    console.error('[RERANK_JOBS] Error:', error);
    res.status(500).json({ error: 'ChatGPT API 오류가 발생했습니다.' });
  }
});

// 면접 질문 생성 API (ChatGPT 기반)
app.post('/tools/generate_interview', async (req, res) => {
  try {
    const { user_profile, job_detail } = req.body;

    console.log('[GENERATE_INTERVIEW] ChatGPT 기반 면접 질문 요청:', {
      user_profile: user_profile ? Object.keys(user_profile) : null,
      job_detail: job_detail ? Object.keys(job_detail) : null
    });

    if (!user_profile || !job_detail) {
      return res.status(400).json({
        error: 'Invalid input: user_profile and job_detail required'
      });
    }

    // 캐치 데이터와 함께 개인화된 면접 질문 생성
    const questions = await generateEnhancedInterviewQuestions(user_profile, job_detail);

    res.json({
      success: true,
      questions,
      job_title: job_detail.title || 'Unknown Position',
      company: job_detail.company || 'Unknown Company',
      powered_by: openai ? 'ChatGPT-4 + Catch Data' : 'Enhanced Algorithm + Catch Data'
    });

  } catch (error) {
    console.error('[GENERATE_INTERVIEW] Error:', error);
    res.status(500).json({ error: 'ChatGPT API 오류가 발생했습니다.' });
  }
});

// 캐치 채용 기업 리뷰 수집 API
app.post('/tools/get_company_reviews', async (req, res) => {
  try {
    const { company_name } = req.body;

    if (!company_name) {
      return res.status(400).json({ error: 'company_name is required' });
    }

    console.log('[COMPANY_REVIEWS] 기업 리뷰 수집 요청:', company_name);

    const reviews = await getCatchCompanyReviews(company_name);
    const summary = await summarizeWithChatGPT(reviews, 'company_reviews');

    res.json({
      success: true,
      company_name,
      reviews,
      summary,
      source: 'catch.co.kr',
      powered_by: openai ? 'ChatGPT-4 + Catch Data' : 'Enhanced Algorithm + Catch Data'
    });

  } catch (error) {
    console.error('[COMPANY_REVIEWS] Error:', error);
    res.status(500).json({ error: '기업 리뷰 수집 중 오류가 발생했습니다.' });
  }
});

// 캐치 채용 합격 자소서 정보 수집 API
app.post('/tools/get_job_essays', async (req, res) => {
  try {
    const { company_name, job_position } = req.body;

    if (!company_name) {
      return res.status(400).json({ error: 'company_name is required' });
    }

    console.log('[JOB_ESSAYS] 합격 자소서 수집 요청:', { company_name, job_position });

    const essays = await getCatchJobEssays(company_name, job_position);
    const analysis = await summarizeWithChatGPT(essays, 'job_essays');

    res.json({
      success: true,
      company_name,
      job_position: job_position || 'All positions',
      essays,
      analysis,
      source: 'catch.co.kr',
      powered_by: openai ? 'ChatGPT-4 + Catch Data' : 'Enhanced Algorithm + Catch Data'
    });

  } catch (error) {
    console.error('[JOB_ESSAYS] Error:', error);
    res.status(500).json({ error: '합격 자소서 수집 중 오류가 발생했습니다.' });
  }
});

// 캐치 채용 지원 꿀팁 수집 API
app.post('/tools/get_job_tips', async (req, res) => {
  try {
    const { company_name, job_position } = req.body;

    if (!company_name) {
      return res.status(400).json({ error: 'company_name is required' });
    }

    console.log('[JOB_TIPS] 지원 꿀팁 수집 요청:', { company_name, job_position });

    const tips = await getCatchJobTips(company_name, job_position);
    const organizedTips = await organizeWithChatGPT(tips, 'job_tips');

    res.json({
      success: true,
      company_name,
      job_position: job_position || 'All positions',
      tips,
      organized_tips: organizedTips,
      source: 'catch.co.kr',
      powered_by: openai ? 'ChatGPT-4 + Catch Data' : 'Enhanced Algorithm + Catch Data'
    });

  } catch (error) {
    console.error('[JOB_TIPS] Error:', error);
    res.status(500).json({ error: '지원 꿀팁 수집 중 오류가 발생했습니다.' });
  }
});

// 캐치 데이터와 함께하는 Enhanced 추천 함수
async function generateEnhancedRecommendations(userProfile, jobCandidates, limit) {
  try {
    // 1. 기본 추천 점수 계산
    let recommendations = generateJobRecommendations(userProfile, jobCandidates, limit);

    // 2. 캐치 데이터로 추천 강화
    for (let job of recommendations) {
      try {
        // 회사별 캐치 데이터 가져오기
        const catchData = await fetchCatchCompanyData(job.company);

        if (catchData) {
          // 캐치 데이터를 바탕으로 점수 조정
          const catchScore = calculateCatchScore(catchData, userProfile);
          job.recommendation_score += catchScore;
          job.catch_data = catchData;

          // 매칭 이유에 캐치 기반 정보 추가
          if (catchScore > 0) {
            job.match_reasons.push(`기업 정보 분석 (+${catchScore}점)`);
          }
        }
      } catch (error) {
        console.error(`캐치 데이터 가져오기 실패 for ${job.company}:`, error);
      }
    }

    // 3. ChatGPT로 추가 분석 (API 키가 있을 때만)
    if (openai) {
      try {
        recommendations = await enhanceWithChatGPT(userProfile, recommendations, limit);
      } catch (error) {
        console.error('ChatGPT 분석 실패:', error);
      }
    }

    // 4. 최종 점수순 정렬
    return recommendations
      .sort((a, b) => b.recommendation_score - a.recommendation_score)
      .slice(0, limit);

  } catch (error) {
    console.error('Enhanced 추천 생성 실패:', error);
    return generateJobRecommendations(userProfile, jobCandidates, limit);
  }
}

// 캐치 데이터와 함께하는 Enhanced 면접 질문 함수
async function generateEnhancedInterviewQuestions(userProfile, jobDetail) {
  try {
    // 1. 기본 면접 질문 생성
    let questions = generateInterviewQuestions(userProfile, jobDetail);

    // 2. 캐치 데이터 가져오기
    const catchData = await fetchCatchCompanyData(jobDetail.company);

    if (catchData) {
      // 캐치 데이터를 바탕으로 질문 추가
      const catchQuestions = generateCatchBasedQuestions(catchData, jobDetail);
      questions = questions.concat(catchQuestions);
    }

    // 3. ChatGPT로 추가 분석 (API 키가 있을 때만)
    if (openai) {
      try {
        questions = await enhanceQuestionsWithChatGPT(userProfile, jobDetail, questions, catchData);
      } catch (error) {
        console.error('ChatGPT 질문 분석 실패:', error);
      }
    }

    // 4. 중복 제거 및 최적화
    const uniqueQuestions = [...new Set(questions.map(q => q.question))];
    return uniqueQuestions.slice(0, 15).map((question, index) => ({
      id: index + 1,
      question,
      category: categorizeQuestion(question),
      difficulty: getQuestionDifficulty(question),
      powered_by: openai ? 'ChatGPT-4 + Catch Data' : 'Enhanced Algorithm + Catch Data'
    }));

  } catch (error) {
    console.error('Enhanced 면접 질문 생성 실패:', error);
    return generateInterviewQuestions(userProfile, jobDetail);
  }
}

// 캐치 회사 데이터 가져오기
async function fetchCatchCompanyData(companyName) {
  try {
    const response = await axios.post(`${CATCH_SERVICE_URL}/api/search-company-info`, {
      company_name: companyName
    }, {
      timeout: 5000
    });

    if (response.data && response.data.success) {
      return response.data.company_detail;
    }
    return null;
  } catch (error) {
    console.error(`캐치 데이터 가져오기 실패 (${companyName}):`, error.message);
    return null;
  }
}

// 캐치 데이터 기반 점수 계산
function calculateCatchScore(catchData, userProfile) {
  let score = 0;

  // 리뷰 점수 기반 가산점
  if (catchData.reviews && catchData.reviews.length > 0) {
    const avgRating = catchData.reviews.reduce((sum, review) => {
      const rating = parseFloat(review.rating) || 0;
      return sum + rating;
    }, 0) / catchData.reviews.length;

    if (avgRating >= 4.0) score += 5;
    else if (avgRating >= 3.5) score += 3;
    else if (avgRating >= 3.0) score += 1;
  }

  // 회사 태그 매칭
  if (catchData.tags && userProfile.preferred_company_culture) {
    const userPreferences = userProfile.preferred_company_culture.map(p => p.toLowerCase());
    const companyTags = catchData.tags.map(t => t.toLowerCase());
    const matches = userPreferences.filter(pref =>
      companyTags.some(tag => tag.includes(pref) || pref.includes(tag))
    );
    score += matches.length * 2;
  }

  // 급여 정보 매칭
  if (catchData.average_salary && userProfile.expected_salary) {
    const companySalary = parseFloat(catchData.average_salary.replace(/[^0-9]/g, '')) || 0;
    const expectedSalary = parseFloat(userProfile.expected_salary) || 0;

    if (companySalary >= expectedSalary * 0.8) score += 3;
  }

  return Math.min(score, 10); // 최대 10점
}

// 캐치 데이터 기반 추가 질문 생성
function generateCatchBasedQuestions(catchData, jobDetail) {
  const questions = [];

  // 리뷰 기반 질문
  if (catchData.reviews && catchData.reviews.length > 0) {
    const commonGoodPoints = extractCommonPoints(catchData.reviews, 'good_points');
    const commonBadPoints = extractCommonPoints(catchData.reviews, 'bad_points');

    if (commonGoodPoints.length > 0) {
      questions.push({
        question: `${jobDetail.company}의 장점으로 ${commonGoodPoints[0]}이 언급되는데, 이에 대한 본인의 생각은?`,
        category: '회사',
        difficulty: '보통'
      });
    }

    if (commonBadPoints.length > 0) {
      questions.push({
        question: `일부 직원들이 ${commonBadPoints[0]}을 아쉬워하는데, 이런 환경에서도 잘 적응할 수 있나요?`,
        category: '회사',
        difficulty: '어려움'
      });
    }
  }

  // 회사 문화 기반 질문
  if (catchData.tags && catchData.tags.length > 0) {
    questions.push({
      question: `${jobDetail.company}는 ${catchData.tags.slice(0, 2).join(', ')} 문화로 유명한데, 이런 환경을 선호하는 이유는?`,
      category: '회사',
      difficulty: '보통'
    });
  }

  return questions;
}

// 공통 키워드 추출
function extractCommonPoints(reviews, field) {
  const allPoints = reviews.map(review => review[field] || '').join(' ');
  const keywords = ['성장', '워라밸', '복지', '야근', '급여', '문화', '동료', '업무'];

  return keywords.filter(keyword => allPoints.includes(keyword));
}

// ChatGPT로 추천 강화 (API 키가 있을 때만)
async function enhanceWithChatGPT(userProfile, recommendations, limit) {
  if (!openai) return recommendations;

  try {
    // ChatGPT 기존 함수 활용
    const jobCandidates = recommendations.map(rec => ({
      job_id: rec.job_id,
      title: rec.title,
      company: rec.company,
      skills: rec.skills,
      experience: rec.experience,
      location: rec.location,
      salary: rec.salary
    }));

    const chatGPTRecommendations = await generateChatGPTRecommendations(userProfile, jobCandidates, limit);

    // ChatGPT 결과와 캐치 데이터 결합
    return chatGPTRecommendations.map(chatRec => {
      const originalRec = recommendations.find(rec => rec.job_id === chatRec.job_id);
      return {
        ...originalRec,
        ...chatRec,
        recommendation_score: Math.max(originalRec?.recommendation_score || 0, chatRec.recommendation_score),
        powered_by: 'ChatGPT-4 + Catch Data'
      };
    });

  } catch (error) {
    console.error('ChatGPT 추천 강화 실패:', error);
    return recommendations;
  }
}

// ChatGPT로 질문 강화 (API 키가 있을 때만)
async function enhanceQuestionsWithChatGPT(userProfile, jobDetail, questions, catchData) {
  if (!openai) return questions;

  try {
    const chatGPTQuestions = await generateChatGPTInterviewQuestions(userProfile, jobDetail);

    // 기존 질문과 ChatGPT 질문 결합, 중복 제거
    const allQuestions = [...questions, ...chatGPTQuestions];
    const uniqueQuestions = allQuestions.filter((question, index, self) =>
      index === self.findIndex(q => q.question === question.question)
    );

    return uniqueQuestions;

  } catch (error) {
    console.error('ChatGPT 질문 강화 실패:', error);
    return questions;
  }
}

// 기존 ChatGPT 기반 공고 추천 함수 (백업용)
async function generateChatGPTRecommendations(userProfile, jobCandidates, limit) {
  const prompt = `
당신은 전문 채용 컨설턴트입니다. 다음 사용자 프로필을 바탕으로 채용공고를 추천해주세요.

**사용자 프로필:**
- 기술 스킬: ${JSON.stringify(userProfile.skills)}
- 경력: ${userProfile.experience || '정보 없음'}
- 선호 지역: ${JSON.stringify(userProfile.preferred_regions || [])}
- 희망 직무: ${userProfile.jobs || '정보 없음'}
- 희망 연봉: ${userProfile.expected_salary || '정보 없음'}만원

**채용공고 목록:**
${jobCandidates.map((job, idx) => `
${idx + 1}. ${job.title} at ${job.company}
   - 요구 기술: ${JSON.stringify(job.skills)}
   - 경력 요건: ${job.experience}
   - 위치: ${job.location}
   - 급여: ${job.salary}
   - Job ID: ${job.job_id}
`).join('')}

각 공고에 대해 1-100점 점수를 매기고, 상위 ${limit}개를 추천해주세요.
점수 기준: 기술매칭(40점), 경력매칭(20점), 지역매칭(15점), 직무매칭(15점), 급여매칭(10점)

응답은 반드시 다음 JSON 형식으로 해주세요:
[
  {
    "job_id": "job_001",
    "recommendation_score": 85,
    "match_reasons": ["구체적인 매칭 이유들..."],
    "detailed_analysis": "상세한 분석..."
  }
]
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2000
    });

    const chatGPTResponse = completion.choices[0].message.content;
    console.log('[ChatGPT Response]:', chatGPTResponse);

    // JSON 파싱 시도
    let recommendations = [];
    try {
      const jsonMatch = chatGPTResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        recommendations = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('JSON 파싱 실패, 대체 로직 사용');
      // 파싱 실패 시 기존 로직 사용
      return generateJobRecommendations(userProfile, jobCandidates, limit);
    }

    // 원본 job 데이터와 합치기
    const enrichedRecommendations = recommendations.map(rec => {
      const originalJob = jobCandidates.find(job => job.job_id === rec.job_id);
      return {
        ...originalJob,
        ...rec,
        powered_by: openai ? 'ChatGPT-4 + Catch Data' : 'Enhanced Algorithm + Catch Data'
      };
    });

    return enrichedRecommendations.slice(0, limit);

  } catch (error) {
    console.error('ChatGPT API 오류, 대체 로직 사용:', error);
    // ChatGPT 실패 시 기존 알고리즘 사용
    return generateJobRecommendations(userProfile, jobCandidates, limit);
  }
}

// ChatGPT 기반 면접 질문 생성 함수
async function generateChatGPTInterviewQuestions(userProfile, jobDetail) {
  const prompt = `
당신은 전문 면접관입니다. 다음 정보를 바탕으로 맞춤형 면접 질문을 생성해주세요.

**지원자 프로필:**
- 기술 스킬: ${JSON.stringify(userProfile.skills)}
- 경력: ${userProfile.experience || '정보 없음'}
- 희망 직무: ${userProfile.preferred_jobs || '정보 없음'}

**채용공고 정보:**
- 회사: ${jobDetail.company}
- 직무: ${jobDetail.title}
- 요구 기술: ${JSON.stringify(jobDetail.skills || [])}
- 설명: ${jobDetail.description || ''}

10-15개의 면접 질문을 생성해주세요. 다음 카테고리를 포함해야 합니다:
1. 기본 질문 (자기소개, 지원동기)
2. 기술 관련 질문 (보유 기술 중심)
3. 경험 관련 질문 (경력에 맞는 수준)
4. 직무별 전문 질문
5. 회사별 맞춤 질문

응답은 반드시 다음 JSON 형식으로 해주세요:
[
  {
    "id": 1,
    "question": "질문 내용",
    "category": "기술|인성|지원동기|직무|회사",
    "difficulty": "쉬움|보통|어려움",
    "purpose": "이 질문의 목적"
  }
]
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 2500
    });

    const chatGPTResponse = completion.choices[0].message.content;
    console.log('[ChatGPT Interview Response]:', chatGPTResponse);

    // JSON 파싱 시도
    let questions = [];
    try {
      const jsonMatch = chatGPTResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('JSON 파싱 실패, 대체 로직 사용');
      // 파싱 실패 시 기존 로직 사용
      return generateInterviewQuestions(userProfile, jobDetail);
    }

    return questions.map(q => ({ ...q, powered_by: 'ChatGPT-4' }));

  } catch (error) {
    console.error('ChatGPT API 오류, 대체 로직 사용:', error);
    // ChatGPT 실패 시 기존 알고리즘 사용
    return generateInterviewQuestions(userProfile, jobDetail);
  }
}

// 캐치 채용 기업 리뷰 수집 함수
async function getCatchCompanyReviews(companyName) {
  try {
    // 실제 캐치 채용 사이트는 접근이 제한될 수 있으므로 샘플 데이터 제공
    const sampleReviews = [
      {
        id: 1,
        rating: 4.2,
        title: "성장할 수 있는 환경",
        content: "기술적 도전과 성장 기회가 많은 회사입니다. 동료들과의 협업도 좋고 워라밸도 괜찮습니다.",
        pros: "성장 기회, 좋은 동료, 워라밸",
        cons: "가끔 야근, 급여 수준",
        department: "개발",
        position: "백엔드 개발자",
        experience: "3년",
        date: "2024-09-20"
      },
      {
        id: 2,
        rating: 3.8,
        title: "안정적인 회사",
        content: "대기업이라 복지는 좋지만 혁신적인 기술 도입은 느린 편입니다.",
        pros: "안정성, 복지, 네임밸류",
        cons: "보수적 문화, 느린 의사결정",
        department: "기획",
        position: "서비스 기획자",
        experience: "5년",
        date: "2024-09-15"
      }
    ];

    // TODO: 실제 웹 스크래핑 구현
    // const response = await axios.get(`https://www.catch.co.kr/Company/${companyName}/Review`, {
    //   headers: { 'User-Agent': process.env.USER_AGENT }
    // });
    // const $ = cheerio.load(response.data);
    // ... 실제 스크래핑 로직

    return sampleReviews;
  } catch (error) {
    console.error('기업 리뷰 수집 오류:', error);
    return [];
  }
}

// 캐치 채용 합격 자소서 수집 함수
async function getCatchJobEssays(companyName, jobPosition) {
  try {
    const sampleEssays = [
      {
        id: 1,
        company: companyName,
        position: jobPosition || "백엔드 개발자",
        year: 2024,
        season: "하반기",
        questions: [
          {
            question: "지원동기와 포부를 작성해주세요.",
            answer: "귀사의 혁신적인 기술과 성장 가능성을 보고 지원하게 되었습니다. 특히 클라우드 기반의 서비스 개발에 관심이 많아..."
          },
          {
            question: "본인의 강점을 구체적인 사례와 함께 설명해주세요.",
            answer: "저의 가장 큰 강점은 문제 해결 능력입니다. 이전 프로젝트에서 성능 이슈가 발생했을 때..."
          }
        ],
        tips: "구체적인 경험과 수치를 포함하여 작성하는 것이 중요합니다.",
        result: "서류 합격",
        rating: 4.5
      }
    ];

    return sampleEssays;
  } catch (error) {
    console.error('자소서 수집 오류:', error);
    return [];
  }
}

// 캐치 채용 지원 꿀팁 수집 함수
async function getCatchJobTips(companyName, jobPosition) {
  try {
    const sampleTips = [
      {
        id: 1,
        category: "서류 준비",
        title: "이력서 작성 팁",
        content: "프로젝트 경험을 구체적으로 작성하고, 사용한 기술 스택을 명시하세요.",
        author: "합격자A",
        likes: 156,
        date: "2024-09-10"
      },
      {
        id: 2,
        category: "면접 준비",
        title: "기술 면접 대비",
        content: "알고리즘 문제와 시스템 설계 문제를 충분히 연습하세요. 특히 확장성에 대한 질문이 많습니다.",
        author: "합격자B",
        likes: 243,
        date: "2024-09-05"
      },
      {
        id: 3,
        category: "회사 정보",
        title: "회사 문화",
        content: "수평적 문화를 지향하며, 자유로운 의견 제시를 선호합니다. 면접에서 적극적으로 질문하세요.",
        author: "내부직원C",
        likes: 89,
        date: "2024-08-28"
      }
    ];

    return sampleTips;
  } catch (error) {
    console.error('꿀팁 수집 오류:', error);
    return [];
  }
}

// ChatGPT로 요약/분석 함수
async function summarizeWithChatGPT(data, type) {
  const prompts = {
    company_reviews: `다음 기업 리뷰들을 분석하여 핵심 포인트를 요약해주세요:\n${JSON.stringify(data, null, 2)}`,
    job_essays: `다음 합격 자소서들을 분석하여 성공 패턴을 찾아주세요:\n${JSON.stringify(data, null, 2)}`
  };

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompts[type] }],
      temperature: 0.5,
      max_tokens: 1000
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('ChatGPT 요약 오류:', error);
    return '요약을 생성할 수 없습니다.';
  }
}

// ChatGPT로 팁 정리 함수
async function organizeWithChatGPT(tips, type) {
  const prompt = `다음 지원 팁들을 카테고리별로 정리하고 우선순위를 매겨주세요:\n${JSON.stringify(tips, null, 2)}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1500
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('ChatGPT 정리 오류:', error);
    return '팁을 정리할 수 없습니다.';
  }
}

// 기존 알고리즘들 (ChatGPT 실패 시 대체용)
function generateJobRecommendations(userProfile, jobCandidates, limit) {
  const scoredJobs = jobCandidates.map(job => {
    let score = 0;
    let reasons = [];

    // 기술 스택 매칭 (40점)
    const userSkills = (userProfile.skills || []).map(s => s.toLowerCase());
    const jobSkills = (job.skills || []).map(s => s.toLowerCase());
    const skillMatch = userSkills.filter(skill =>
      jobSkills.some(js => js.includes(skill) || skill.includes(js))
    );

    if (skillMatch.length > 0) {
      const skillScore = Math.min(40, (skillMatch.length / userSkills.length) * 40);
      score += skillScore;
      reasons.push(`기술 스택 ${skillMatch.length}개 매칭 (+${skillScore.toFixed(1)}점)`);
    }

    // 경력 레벨 매칭 (20점) - 기존 로직과 동일
    const userExperience = parseExperience(userProfile.experience || '0년');
    const jobExperience = parseExperienceRange(job.experience || '신입');

    if (isExperienceMatch(userExperience, jobExperience)) {
      score += 20;
      reasons.push(`경력 수준 적합 (+20점)`);
    } else if (Math.abs(userExperience - jobExperience.min) <= 1) {
      score += 10;
      reasons.push(`경력 수준 유사 (+10점)`);
    }

    return {
      ...job,
      recommendation_score: Math.round(score),
      match_reasons: reasons,
      skill_matches: skillMatch,
      powered_by: 'Fallback Algorithm'
    };
  });

  return scoredJobs
    .sort((a, b) => b.recommendation_score - a.recommendation_score)
    .slice(0, limit);
}

function generateInterviewQuestions(userProfile, jobDetail) {
  // 기존 면접 질문 생성 로직과 동일
  const questions = [
    { id: 1, question: "자기소개를 해주세요.", category: "인성", difficulty: "쉬움" },
    { id: 2, question: `${jobDetail.company}에 지원한 이유는 무엇인가요?`, category: "지원동기", difficulty: "쉬움" },
  ];

  return questions.map(q => ({ ...q, powered_by: 'Fallback Algorithm' }));
}

// 유틸리티 함수들 (기존과 동일)
function parseExperience(exp) {
  const match = exp.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

function parseExperienceRange(exp) {
  if (exp.includes('신입')) return { min: 0, max: 1 };
  if (exp.includes('1-3년') || exp.includes('1~3년')) return { min: 1, max: 3 };
  if (exp.includes('3-5년') || exp.includes('3~5년')) return { min: 3, max: 5 };
  if (exp.includes('5년 이상') || exp.includes('5+')) return { min: 5, max: 10 };

  const match = exp.match(/(\d+)/);
  const years = match ? parseInt(match[1]) : 0;
  return { min: years, max: years + 1 };
}

function isExperienceMatch(userExp, jobExpRange) {
  return userExp >= jobExpRange.min && userExp <= jobExpRange.max;
}

app.listen(PORT, () => {
  console.log(`🚀 CommitJob MCP Service with ChatGPT running on port ${PORT}`);
  console.log(`📊 Available endpoints:`);
  console.log(`   - POST /tools/rerank_jobs (ChatGPT Job Recommendations)`);
  console.log(`   - POST /tools/generate_interview (ChatGPT Interview Questions)`);
  console.log(`   - POST /tools/get_company_reviews (Catch Company Reviews)`);
  console.log(`   - POST /tools/get_job_essays (Catch Job Essays)`);
  console.log(`   - POST /tools/get_job_tips (Catch Job Tips)`);
  console.log(`   - GET /health (Health Check)`);
  console.log(`🤖 Powered by OpenAI ChatGPT-4`);
});