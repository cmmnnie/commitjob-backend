#!/usr/bin/env node

// 전체 시스템 통합 테스트
// 모든 서비스 (Backend:4001, MCP:4002, Catch:3000)의 연동을 테스트

import axios from 'axios';
import fs from 'fs';

const MAIN_BACKEND = 'http://localhost:4001';
const MCP_SERVICE = 'http://localhost:4002';
const CATCH_SERVICE = 'http://localhost:3000';

console.log('🚀 전체 시스템 통합 테스트 시작...\n');

// 테스트 결과 저장
const results = [];

async function testService(name, url) {
  try {
    const response = await axios.get(`${url}/health`, { timeout: 5000 });
    console.log(`✅ ${name}: ${response.status} - ${JSON.stringify(response.data)}`);
    return true;
  } catch (error) {
    console.log(`❌ ${name}: ERROR - ${error.message}`);
    return false;
  }
}

async function testRecommendations() {
  console.log('\n📊 1. 맞춤형 채용공고 추천 테스트');

  const testProfile = {
    user_id: 'test_user_123',
    skills: ['JavaScript', 'Node.js', 'React'],
    experience_years: 3,
    preferred_location: '서울',
    preferred_salary: 50000000,
    education_level: '대학교 졸업'
  };

  try {
    // MCP 서비스를 통한 추천
    const mcpResponse = await axios.post(`${MCP_SERVICE}/tools/rerank_jobs`, {
      user_profile: testProfile,
      job_candidates: [
        { title: '프론트엔드 개발자', company: '네이버', location: '서울', salary: 55000000 },
        { title: '풀스택 개발자', company: '카카오', location: '경기', salary: 60000000 },
        { title: '백엔드 개발자', company: '라인', location: '서울', salary: 52000000 }
      ],
      limit: 3
    }, { timeout: 10000 });

    console.log(`✅ MCP 추천 서비스: ${mcpResponse.status}`);
    console.log('   - 추천된 채용공고:', mcpResponse.data.recommendations?.length || 0, '개');

    // 메인 백엔드를 통한 추천
    const backendResponse = await axios.post(`${MAIN_BACKEND}/api/recommendations`, testProfile, { timeout: 10000 });
    console.log(`✅ 메인 백엔드 추천: ${backendResponse.status}`);

    results.push({ test: 'job_recommendations', status: 'PASS' });
    return true;
  } catch (error) {
    console.log(`❌ 추천 테스트 실패: ${error.message}`);
    results.push({ test: 'job_recommendations', status: 'FAIL', error: error.message });
    return false;
  }
}

async function testInterviewQuestions() {
  console.log('\n🤔 2. 맞춤형 면접 질문 테스트');

  try {
    const interviewRequest = {
      user_profile: {
        skills: ['JavaScript', 'Node.js'],
        experience_years: 2,
        target_position: '웹 개발자'
      },
      job_info: {
        company: '테스트컴퍼니',
        position: '프론트엔드 개발자',
        required_skills: ['React', 'TypeScript']
      }
    };

    // MCP 서비스를 통한 면접 질문 생성
    const mcpResponse = await axios.post(`${MCP_SERVICE}/tools/generate_interview`, interviewRequest, { timeout: 15000 });
    console.log(`✅ MCP 면접 질문 서비스: ${mcpResponse.status}`);
    console.log('   - 생성된 질문 수:', mcpResponse.data.questions?.length || 0, '개');

    // 메인 백엔드를 통한 면접 질문
    const backendResponse = await axios.post(`${MAIN_BACKEND}/api/interview-questions`, interviewRequest, { timeout: 15000 });
    console.log(`✅ 메인 백엔드 면접 질문: ${backendResponse.status}`);

    results.push({ test: 'interview_questions', status: 'PASS' });
    return true;
  } catch (error) {
    console.log(`❌ 면접 질문 테스트 실패: ${error.message}`);
    results.push({ test: 'interview_questions', status: 'FAIL', error: error.message });
    return false;
  }
}

async function testCatchIntegration() {
  console.log('\n📄 3. 캐치 데이터 연동 테스트');

  const testCompany = '삼성전자';

  try {
    // 직접 캐치 스크래핑 서비스 테스트
    const catchResponse = await axios.post(`${CATCH_SERVICE}/api/search-company-info`, {
      company_name: testCompany
    }, { timeout: 20000 });

    console.log(`✅ 캐치 스크래핑 서비스: ${catchResponse.status}`);

    // MCP를 통한 캐치 데이터 접근
    const mcpCompanyResponse = await axios.post(`${MCP_SERVICE}/tools/get_company_reviews`, {
      company_name: testCompany
    }, { timeout: 15000 });

    console.log(`✅ MCP 캐치 리뷰 서비스: ${mcpCompanyResponse.status}`);

    // 메인 백엔드를 통한 캐치 데이터
    const backendCompanyResponse = await axios.post(`${MAIN_BACKEND}/api/company-info`, {
      company_name: testCompany
    }, { timeout: 15000 });

    console.log(`✅ 메인 백엔드 기업 정보: ${backendCompanyResponse.status}`);

    results.push({ test: 'catch_integration', status: 'PASS' });
    return true;
  } catch (error) {
    console.log(`❌ 캐치 연동 테스트 실패: ${error.message}`);
    results.push({ test: 'catch_integration', status: 'FAIL', error: error.message });
    return false;
  }
}

async function testSocialLogin() {
  console.log('\n🔐 4. 소셜 로그인 엔드포인트 테스트');

  try {
    // Google OAuth 엔드포인트 확인
    const googleAuthResponse = await axios.get(`${MAIN_BACKEND}/auth/google`, {
      maxRedirects: 0,
      validateStatus: function (status) {
        return status >= 200 && status < 400; // 리다이렉트 허용
      }
    });

    console.log(`✅ Google 소셜 로그인 엔드포인트: ${googleAuthResponse.status}`);

    // Kakao OAuth 엔드포인트 확인
    const kakaoAuthResponse = await axios.get(`${MAIN_BACKEND}/auth/kakao`, {
      maxRedirects: 0,
      validateStatus: function (status) {
        return status >= 200 && status < 400;
      }
    });

    console.log(`✅ Kakao 소셜 로그인 엔드포인트: ${kakaoAuthResponse.status}`);

    results.push({ test: 'social_login', status: 'PASS' });
    return true;
  } catch (error) {
    console.log(`❌ 소셜 로그인 테스트 실패: ${error.message}`);
    results.push({ test: 'social_login', status: 'FAIL', error: error.message });
    return false;
  }
}

async function testComprehensiveJobInfo() {
  console.log('\n📋 5. 종합 채용 정보 테스트');

  const testCompany = '카카오';

  try {
    // 종합 정보 API 테스트
    const comprehensiveResponse = await axios.post(`${MAIN_BACKEND}/api/comprehensive-job-info`, {
      company_name: testCompany
    }, { timeout: 30000 });

    console.log(`✅ 종합 채용 정보 API: ${comprehensiveResponse.status}`);
    console.log('   - 응답 데이터 구조:', Object.keys(comprehensiveResponse.data).join(', '));

    results.push({ test: 'comprehensive_job_info', status: 'PASS' });
    return true;
  } catch (error) {
    console.log(`❌ 종합 채용 정보 테스트 실패: ${error.message}`);
    results.push({ test: 'comprehensive_job_info', status: 'FAIL', error: error.message });
    return false;
  }
}

// 메인 테스트 실행
async function runIntegrationTests() {
  console.log('═══════════════════════════════════════');
  console.log('🔍 서비스 상태 확인');
  console.log('═══════════════════════════════════════');

  const mainBackendStatus = await testService('Main Backend (4001)', MAIN_BACKEND);
  const mcpServiceStatus = await testService('MCP Service (4002)', MCP_SERVICE);
  const catchServiceStatus = await testService('Catch Service (3000)', CATCH_SERVICE);

  if (!mainBackendStatus || !mcpServiceStatus || !catchServiceStatus) {
    console.log('\n❌ 일부 서비스가 실행되지 않았습니다. 테스트를 중단합니다.');
    process.exit(1);
  }

  console.log('\n═══════════════════════════════════════');
  console.log('🧪 기능 테스트 실행');
  console.log('═══════════════════════════════════════');

  await testRecommendations();
  await testInterviewQuestions();
  await testCatchIntegration();
  await testSocialLogin();
  await testComprehensiveJobInfo();

  console.log('\n═══════════════════════════════════════');
  console.log('📊 테스트 결과 요약');
  console.log('═══════════════════════════════════════');

  const passedTests = results.filter(r => r.status === 'PASS').length;
  const failedTests = results.filter(r => r.status === 'FAIL').length;
  const totalTests = results.length;

  console.log(`총 테스트: ${totalTests}개`);
  console.log(`통과: ${passedTests}개 ✅`);
  console.log(`실패: ${failedTests}개 ❌`);
  console.log(`성공률: ${Math.round((passedTests / totalTests) * 100)}%`);

  if (failedTests > 0) {
    console.log('\n실패한 테스트:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.test}: ${r.error}`);
    });
  }

  // 결과를 파일로 저장
  fs.writeFileSync('./test-results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    total: totalTests,
    passed: passedTests,
    failed: failedTests,
    success_rate: Math.round((passedTests / totalTests) * 100),
    details: results
  }, null, 2));

  console.log('\n📁 테스트 결과가 test-results.json에 저장되었습니다.');

  if (failedTests === 0) {
    console.log('\n🎉 모든 테스트가 성공적으로 완료되었습니다!');
    console.log('졸업작품 시스템이 정상적으로 동작하고 있습니다.');
  } else {
    console.log('\n⚠️  일부 테스트가 실패했습니다. 로그를 확인해 주세요.');
  }
}

// 테스트 실행
runIntegrationTests().catch(error => {
  console.error('❌ 테스트 실행 중 오류 발생:', error.message);
  process.exit(1);
});