-- CommitJob Database Schema Setup
-- Execute this script to set up the database schema

USE appdb;

-- 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    provider_key VARCHAR(100) UNIQUE NOT NULL, -- 'google:12345' or 'kakao:67890'
    email VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    picture VARCHAR(500),
    provider ENUM('google', 'kakao') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_provider_key (provider_key),
    INDEX idx_email (email)
);

-- 사용자 프로필 테이블
CREATE TABLE IF NOT EXISTS user_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    skills JSON, -- ['JavaScript', 'React', 'Node.js']
    experience VARCHAR(50), -- '3년', '신입', '5년 이상' etc.
    preferred_regions JSON, -- ['서울', '경기', '부산']
    preferred_jobs VARCHAR(200), -- '백엔드 개발자', '풀스택 개발자'
    expected_salary DECIMAL(10,2), -- 연봉 (만원 단위)
    resume_path VARCHAR(500), -- 이력서 파일 경로
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
);

-- 회사 정보 테이블
CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id VARCHAR(100) UNIQUE NOT NULL, -- 'company_001', 'company_002'
    name VARCHAR(200) NOT NULL,
    description TEXT,
    website VARCHAR(500),
    location VARCHAR(200),
    size VARCHAR(50), -- '1-50명', '51-200명', '201-1000명' etc.
    industry VARCHAR(100),
    logo_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_company_id (company_id),
    INDEX idx_name (name)
);

-- 채용공고 테이블
CREATE TABLE IF NOT EXISTS job_postings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id VARCHAR(100) UNIQUE NOT NULL, -- 'job_001', 'job_002'
    company_id VARCHAR(100) NOT NULL,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    requirements TEXT,
    skills JSON, -- ['JavaScript', 'React', 'MySQL']
    experience_level VARCHAR(50), -- '신입', '1-3년', '3-5년', '5년 이상'
    employment_type VARCHAR(50), -- '정규직', '계약직', '인턴'
    location VARCHAR(200),
    salary VARCHAR(100), -- '3000-4000만원', '면접 후 결정' etc.
    source VARCHAR(50), -- 'file', 'url'
    source_url VARCHAR(1000),
    posted_date DATE,
    deadline_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE,
    INDEX idx_job_id (job_id),
    INDEX idx_company_id (company_id),
    INDEX idx_title (title),
    INDEX idx_location (location),
    INDEX idx_is_active (is_active),
    FULLTEXT idx_description (description, requirements)
);

-- 사용자 세션 테이블 (추천 기록용)
CREATE TABLE IF NOT EXISTS user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(100) UNIQUE NOT NULL,
    user_id INT,
    session_data JSON, -- { jobs: [], companies: [], user_profile: {} }
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 24 HOUR),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_session_id (session_id),
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at)
);

-- 추천 기록 테이블
CREATE TABLE IF NOT EXISTS recommendation_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    session_id VARCHAR(100),
    job_id VARCHAR(100),
    recommendation_score INT,
    match_reasons JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (job_id) REFERENCES job_postings(job_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_session_id (session_id),
    INDEX idx_job_id (job_id),
    INDEX idx_score (recommendation_score)
);

-- 면접 질문 기록 테이블
CREATE TABLE IF NOT EXISTS interview_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    session_id VARCHAR(100),
    job_id VARCHAR(100),
    questions JSON, -- [{ id: 1, question: "...", category: "기술", difficulty: "보통" }]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (job_id) REFERENCES job_postings(job_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_session_id (session_id),
    INDEX idx_job_id (job_id)
);

-- 샘플 데이터 삽입
INSERT IGNORE INTO companies (company_id, name, description, location, size, industry) VALUES
('company_001', '네이버', '국내 대표 IT 기업', '경기 성남시', '1000명 이상', 'IT/인터넷'),
('company_002', '카카오', '모바일 플랫폼 기업', '제주시', '1000명 이상', 'IT/인터넷'),
('company_003', '쿠팡', '이커머스 플랫폼', '서울 송파구', '1000명 이상', '이커머스'),
('company_004', '토스', '핀테크 스타트업', '서울 강남구', '501-1000명', '핀테크'),
('company_005', '배달의민족', '배달 플랫폼', '서울 송파구', '501-1000명', '플랫폼');

INSERT IGNORE INTO job_postings (job_id, company_id, title, description, skills, experience_level, employment_type, location, salary) VALUES
('job_001', 'company_001', '백엔드 개발자', 'Spring Boot를 이용한 백엔드 시스템 개발', '["Java", "Spring Boot", "MySQL", "Redis"]', '3-5년', '정규직', '경기 성남시', '5000-7000만원'),
('job_002', 'company_002', '프론트엔드 개발자', 'React를 이용한 웹 서비스 개발', '["React", "JavaScript", "TypeScript", "CSS"]', '1-3년', '정규직', '제주시', '4000-6000만원'),
('job_003', 'company_003', '풀스택 개발자', 'Node.js와 React를 이용한 풀스택 개발', '["Node.js", "React", "MongoDB", "AWS"]', '신입-2년', '정규직', '서울 송파구', '3500-5000만원'),
('job_004', 'company_004', 'DevOps 엔지니어', 'AWS 기반 인프라 구축 및 운영', '["AWS", "Docker", "Kubernetes", "Jenkins"]', '3년 이상', '정규직', '서울 강남구', '6000-8000만원'),
('job_005', 'company_005', '모바일 개발자', 'React Native를 이용한 모바일 앱 개발', '["React Native", "JavaScript", "iOS", "Android"]', '1-3년', '정규직', '서울 송파구', '4500-6500만원');

-- 인덱스 최적화를 위한 추가 설정
OPTIMIZE TABLE users;
OPTIMIZE TABLE user_profiles;
OPTIMIZE TABLE companies;
OPTIMIZE TABLE job_postings;
OPTIMIZE TABLE user_sessions;
OPTIMIZE TABLE recommendation_logs;
OPTIMIZE TABLE interview_logs;

-- 정리용 이벤트 스케줄러 (만료된 세션 정리)
-- SET GLOBAL event_scheduler = ON;
--
-- CREATE EVENT IF NOT EXISTS cleanup_expired_sessions
-- ON SCHEDULE EVERY 1 HOUR
-- DO
--   DELETE FROM user_sessions WHERE expires_at < NOW();

SELECT 'Database schema setup completed successfully!' as message;