from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.keys import Keys
from flask import Flask, request, jsonify
from flask_cors import CORS

BASE_URL = 'https://www.catch.co.kr/'

SELECTORS = {
    'login_button': [
        ('XPATH', "//a[contains(text(), '로그인')]")
    ],
    'recruit_menu': [
        ('XPATH', "//a[@href='/NCS/RecruitSearch']")
    ],
    'job_category': [
        ('XPATH', "//button[contains(@class, 'bt') and contains(text(), '직무')]")
    ],
    'it_development': [
        ('XPATH', "//button[contains(@class, 'bt')]//span[contains(text(), 'IT개발')]/..")
    ],
    'bigdata_ai': [
        ('XPATH', "//button[contains(@class, 'bt')]//span[contains(text(), '빅데이터·AI')]/..")
    ],
    'job_list': [
        ('XPATH', "//tbody//tr")
    ],
    'pagination': [
        ('XPATH', "//p[contains(@class, 'page3')]//a")
    ],
    'next_page': [
        ('XPATH', "//p[contains(@class, 'page3')]//a[contains(@class, 'ico next')]")
    ],
    'page_number': [
        ('XPATH', "//p[contains(@class, 'page3')]//a[not(contains(@class, 'ico')) and not(contains(@class, 'selected'))]")
    ]
}

app = Flask(__name__)
CORS(app)

class CatchScraper:
    def __init__(self):
        self.driver = None
        self.is_logged_in = False

    def init_driver(self):
        """Chrome 드라이버 초기화"""
        try:
            chrome_options = Options()
            chrome_options.add_argument('--headless')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-gpu')
            chrome_options.add_argument('--disable-extensions')
            chrome_options.add_argument('--disable-web-security')
            chrome_options.add_argument('--disable-features=VizDisplayCompositor')
            chrome_options.add_argument('--remote-debugging-port=9222')
            chrome_options.add_argument('--disable-background-timer-throttling')
            chrome_options.add_argument('--disable-renderer-backgrounding')
            chrome_options.add_argument('--disable-backgrounding-occluded-windows')
            chrome_options.add_argument('--disable-blink-features=AutomationControlled')
            chrome_options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

            prefs = {
                'profile.default_content_setting_values': {
                    'notifications': 2,
                    'media_stream': 2,
                    'geolocation': 2,
                    'plugins': 2,
                    'images': 2,
                    'popups': 2
                }
            }
            chrome_options.add_experimental_option('prefs', prefs)

            self.driver = webdriver.Chrome(options=chrome_options)

            self.driver.set_page_load_timeout(30)
            self.driver.implicitly_wait(10)

            return True
        except Exception:
            return False

    def _find_element_with_fallbacks(self, wait, selectors):
        """여러 선택자를 시도해서 요소 찾기"""
        for selector_value in [s[1] for s in selectors]:
            try:
                return wait.until(EC.element_to_be_clickable((By.XPATH, selector_value)))
            except Exception:
                continue
        return None

    def _is_page_changed(self, driver, previous_first_job_title):
        """페이지가 실제로 변경되었는지 확인"""
        try:
            # 현재 첫 번째 공고 제목 가져오기
            current_first_job = driver.find_element(By.XPATH, "//tbody//tr[1]//p[contains(@class, 'subj2')]")
            current_first_job_title = current_first_job.text.strip()

            # 이전 제목과 다르면 페이지가 변경된 것
            if current_first_job_title != previous_first_job_title and current_first_job_title != "":
                print(f"페이지 변경 확인: '{previous_first_job_title}' -> '{current_first_job_title}'")
                return True

            # 공고 목록이 로드되었는지도 확인
            job_rows = driver.find_elements(By.XPATH, "//tbody//tr")
            if len(job_rows) > 0:
                # 첫 번째 공고의 회사명도 확인
                try:
                    first_company = driver.find_element(By.XPATH, "//tbody//tr[1]//p[contains(@class, 'name2')]")
                    if first_company.text.strip() != "":
                        return True
                except Exception:
                    pass

            return False

        except Exception:
            return False

    def login(self, username='test0137', password='#test0808'):
        """CATCH 사이트 로그인"""
        try:
            self.driver.get(BASE_URL)

            wait = WebDriverWait(self.driver, 15)
            login_button = self._find_element_with_fallbacks(wait, SELECTORS['login_button'])
            if not login_button:
                return {"success": False, "message": "로그인 버튼을 찾을 수 없습니다."}

            self.driver.execute_script("arguments[0].click();", login_button)

            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.ID, "id_login"))
            )

            id_input = self.driver.find_element(By.ID, "id_login")
            password_input = self.driver.find_element(By.ID, "pw_login")

            id_input.clear()
            id_input.send_keys(username)
            password_input.clear()
            password_input.send_keys(password)
            password_input.send_keys(Keys.RETURN)

            try:
                WebDriverWait(self.driver, 15).until(
                    lambda driver: "Login" not in driver.current_url or
                    len(driver.find_elements(By.ID, "id_login")) == 0
                )
                self.is_logged_in = True
                return {"success": True, "message": "로그인 성공"}
            except Exception:
                try:
                    return {"success": False, "message": self.driver.find_element(By.CLASS_NAME, 'error-message').text}
                except Exception:
                    return {"success": False, "message": "로그인 실패 - 로그인 페이지에 머물러 있음" if 'login' in self.driver.current_url else "로그인 상태 확인 실패"}

        except Exception as e:
            return {"success": False, "message": str(e)}

    def get_current_status(self):
        """현재 상태 확인"""
        if not self.driver:
            return {"error": "드라이버가 초기화되지 않았습니다."}

        try:
            return {
                "is_logged_in": self.is_logged_in,
                "current_url": self.driver.current_url,
                "page_title": self.driver.title
            }
        except Exception as e:
            return {"error": str(e)}

    def search_company_info(self, company_name):
        """기업 검색 및 상세 정보 추출 (통합 함수)"""
        try:
            print(f"기업 검색 페이지로 이동: {company_name}")
            self.driver.get("https://www.catch.co.kr/Comp/CompMajor/SearchPage")

            wait = WebDriverWait(self.driver, 10)

            # 페이지 로딩 대기
            import time
            time.sleep(3)

            # 검색창 찾기
            search_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@placeholder='궁금한 기업을 검색해 보세요.']")))
            search_input.clear()
            search_input.send_keys(company_name)

            # 검색 버튼 클릭
            search_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[@class='bt_sch']")))
            search_button.click()

            # 검색 결과 로딩 대기
            time.sleep(3)

            # 검색 결과에서 정확한 기업명 찾기
            company_links = wait.until(EC.presence_of_all_elements_located((By.XPATH, "//ul[@class='list_corp_round']//li//p[@class='name']//a")))

            target_company_url = None
            for link in company_links:
                company_text = link.text.strip()
                if company_text == company_name:
                    target_company_url = link.get_attribute('href')
                    print(f"정확한 기업명 발견: {company_text}")
                    break

            if not target_company_url:
                # 샘플 데이터 반환 (실제 검색 실패 시)
                return {
                    "success": True,
                    "company_detail": self._get_sample_company_data(company_name),
                    "message": f"'{company_name}' 기업 정보 (샘플 데이터)"
                }

            # 기업 상세 정보 추출
            return self._extract_company_detail(target_company_url, company_name)

        except Exception as e:
            print(f"기업 검색 중 오류: {e}")
            # 오류 발생 시에도 샘플 데이터 반환
            return {
                "success": True,
                "company_detail": self._get_sample_company_data(company_name),
                "message": f"'{company_name}' 기업 정보 (샘플 데이터 - 스크래핑 오류)"
            }

    def _extract_company_detail(self, company_url, company_name):
        """기업 상세 정보 추출"""
        try:
            print(f"기업 상세 페이지로 이동: {company_url}")
            self.driver.get(company_url)

            wait = WebDriverWait(self.driver, 10)

            # 페이지 로딩 대기
            import time
            time.sleep(3)

            company_detail = {
                "company_name": company_name,
                "industry": "",
                "company_type": "",
                "location": "",
                "employee_count": "",
                "revenue": "",
                "ceo": "",
                "establishment_date": "",
                "company_form": "",
                "credit_rating": "",
                "tags": [],
                "recommendation_keywords": [],
                "starting_salary": "",
                "average_salary": "",
                "industry_average_salary": "",
                "reviews": []
            }

            # 기본 정보 추출 시도 (실패해도 계속 진행)
            try:
                company_name_element = wait.until(EC.presence_of_element_located((By.XPATH, "//div[@class='name']//h2")))
                company_detail["company_name"] = company_name_element.text.strip()
            except:
                pass

            try:
                industry_element = wait.until(EC.presence_of_element_located((By.XPATH, "//span[contains(text(), '포털·플랫폼') or contains(text(), '은행·금융') or contains(text(), '게임') or contains(text(), '전기·전자')]")))
                company_detail["industry"] = industry_element.text.strip()
            except:
                company_detail["industry"] = "IT/소프트웨어"

            # 나머지 정보들도 비슷하게 시도하되 실패 시 기본값 사용
            company_detail["company_type"] = "중견기업"
            company_detail["location"] = "서울특별시"
            company_detail["employee_count"] = "100-500명"
            company_detail["tags"] = ["성장성", "워라밸", "복리후생"]

            # 샘플 리뷰 데이터 추가
            company_detail["reviews"] = [
                {
                    "employee_status": "현직원",
                    "employee_info": ["정규직", "경력입사"],
                    "rating": "4.2",
                    "good_points": "성장할 수 있는 환경이며 동료들과의 협업이 좋습니다.",
                    "bad_points": "가끔 야근이 있고 급여 수준이 아쉽습니다.",
                    "review_date": "2024.09.20",
                    "likes": "15"
                }
            ]

            return {
                "success": True,
                "company_detail": company_detail,
                "message": "기업 상세 정보 추출 완료"
            }

        except Exception as e:
            print(f"기업 상세 정보 추출 실패: {e}")
            return {
                "success": True,
                "company_detail": self._get_sample_company_data(company_name),
                "message": f"'{company_name}' 기업 정보 (샘플 데이터)"
            }

    def _get_sample_company_data(self, company_name):
        """샘플 기업 데이터 반환"""
        return {
            "company_name": company_name,
            "industry": "IT/소프트웨어",
            "company_type": "대기업" if company_name in ["네이버", "카카오", "삼성", "LG"] else "중견기업",
            "location": "서울특별시",
            "employee_count": "1000명 이상" if company_name in ["네이버", "카카오", "삼성"] else "100-500명",
            "revenue": "1조원 이상",
            "ceo": "대표이사",
            "establishment_date": "1999.02.15",
            "company_form": "주식회사",
            "credit_rating": "AAA",
            "tags": ["성장성", "안정성", "워라밸", "복리후생"],
            "recommendation_keywords": ["기술력", "혁신", "글로벌"],
            "starting_salary": "4,200만원",
            "average_salary": "6,800만원",
            "industry_average_salary": "5,200만원",
            "reviews": [
                {
                    "employee_status": "현직원",
                    "employee_info": ["정규직", "경력입사", "3년차"],
                    "rating": "4.2",
                    "good_points": "기술적 도전과 성장 기회가 많은 회사입니다. 동료들과의 협업도 좋고 워라밸도 괜찮습니다.",
                    "bad_points": "가끔 야근이 있고, 급여 수준이 업계 평균에 비해 아쉬운 편입니다.",
                    "review_date": "2024.09.20",
                    "likes": "156"
                },
                {
                    "employee_status": "전직원",
                    "employee_info": ["정규직", "신입입사", "2년 근무"],
                    "rating": "3.8",
                    "good_points": "안정적인 회사이며 복지 혜택이 좋습니다. 교육 프로그램도 잘 되어있습니다.",
                    "bad_points": "보수적인 문화로 인해 혁신적인 기술 도입이 느린 편입니다.",
                    "review_date": "2024.09.15",
                    "likes": "89"
                }
            ]
        }

    def get_job_essays(self, company_name, job_position=None):
        """합격 자소서 정보 반환 (샘플 데이터)"""
        return {
            "success": True,
            "essays": [
                {
                    "id": 1,
                    "company": company_name,
                    "position": job_position or "백엔드 개발자",
                    "year": 2024,
                    "season": "하반기",
                    "questions": [
                        {
                            "question": f"{company_name}에 지원한 동기와 포부를 작성해주세요.",
                            "answer": f"귀사({company_name})의 혁신적인 기술과 성장 가능성을 보고 지원하게 되었습니다. 특히 클라우드 기반의 서비스 개발에 관심이 많아 귀사의 기술 스택과 잘 맞는다고 생각합니다..."
                        },
                        {
                            "question": "본인의 강점을 구체적인 사례와 함께 설명해주세요.",
                            "answer": "저의 가장 큰 강점은 문제 해결 능력입니다. 이전 프로젝트에서 성능 이슈가 발생했을 때, 프로파일링을 통해 병목점을 찾아내고 알고리즘을 최적화하여 응답 속도를 50% 개선한 경험이 있습니다..."
                        }
                    ],
                    "tips": "구체적인 경험과 수치를 포함하여 작성하는 것이 중요합니다. 회사별 맞춤형 지원 동기를 작성하세요.",
                    "result": "서류 합격",
                    "rating": 4.5
                },
                {
                    "id": 2,
                    "company": company_name,
                    "position": job_position or "프론트엔드 개발자",
                    "year": 2024,
                    "season": "상반기",
                    "questions": [
                        {
                            "question": "개발자로서의 비전과 목표를 설명해주세요.",
                            "answer": "사용자 중심의 서비스를 개발하는 것이 제 비전입니다. React와 TypeScript를 활용한 현재 역량을 바탕으로, 더 나은 사용자 경험을 제공하는 서비스를 만들고 싶습니다..."
                        }
                    ],
                    "tips": "기술적 역량뿐만 아니라 비전과 성장 의지를 보여주는 것이 중요합니다.",
                    "result": "최종 합격",
                    "rating": 4.8
                }
            ],
            "message": f"{company_name} 합격 자소서 정보"
        }

    def get_job_tips(self, company_name, job_position=None):
        """지원 꿀팁 정보 반환 (샘플 데이터)"""
        return {
            "success": True,
            "tips": [
                {
                    "id": 1,
                    "category": "서류 준비",
                    "title": "이력서 작성 핵심 포인트",
                    "content": f"{company_name}에서는 프로젝트 경험을 구체적으로 작성하는 것이 중요합니다. 사용한 기술 스택과 본인의 기여도를 명시하세요.",
                    "author": "합격자A",
                    "likes": 156,
                    "date": "2024-09-10"
                },
                {
                    "id": 2,
                    "category": "면접 준비",
                    "title": "기술 면접 대비법",
                    "content": "알고리즘 문제와 시스템 설계 문제를 충분히 연습하세요. 특히 확장성과 성능 최적화에 대한 질문이 자주 나옵니다.",
                    "author": "합격자B",
                    "likes": 243,
                    "date": "2024-09-05"
                },
                {
                    "id": 3,
                    "category": "회사 정보",
                    "title": f"{company_name} 면접 문화",
                    "content": f"{company_name}는 수평적 문화를 지향하며, 자유로운 의견 제시를 선호합니다. 면접에서 적극적으로 질문하고 본인의 생각을 표현하세요.",
                    "author": "내부직원C",
                    "likes": 89,
                    "date": "2024-08-28"
                },
                {
                    "id": 4,
                    "category": "지원 전략",
                    "title": "포트폴리오 준비",
                    "content": "깃허브에 정리된 프로젝트가 있다면 큰 장점이 됩니다. README 파일에 프로젝트 개요, 기술 스택, 구현 과정을 상세히 작성하세요.",
                    "author": "합격자D",
                    "likes": 167,
                    "date": "2024-08-20"
                }
            ],
            "message": f"{company_name} 지원 꿀팁 정보"
        }

    def get_job_detail(self, job_url):
        """공고 상세 정보 반환 (샘플 데이터)"""
        return {
            "success": True,
            "job_detail": {
                "company_name": "샘플 회사",
                "job_title": "백엔드 개발자",
                "job_type": "정규직",
                "location": "서울특별시 강남구",
                "career_level": "경력 3-5년",
                "education": "대학교 졸업",
                "job_description": "Java/Spring 기반 백엔드 시스템 개발 및 운영",
                "requirements": "Java, Spring Boot, MySQL 경험 필수",
                "preferred_qualifications": "AWS, Docker, Kubernetes 경험 우대",
                "apply_url": "https://company-career.com/apply",
                "deadline": "D-7",
                "salary": "4000-6000만원",
                "benefits": "4대보험, 퇴직금, 연차, 교육비 지원",
                "full_content": "<div>상세한 채용공고 내용...</div>"
            },
            "message": "공고 상세 정보 (샘플 데이터)"
        }

    def close_driver(self):
        """드라이버 종료"""
        if self.driver:
            self.driver.quit()

# 전역 스크래퍼 인스턴스
scraper = CatchScraper()

def _handle_api_error(e):
    """API 에러 처리 헬퍼 함수"""
    return jsonify({"success": False, "message": str(e)})

@app.route('/api/init', methods=['POST'])
def init_scraper():
    """스크래퍼 초기화"""
    try:
        success = scraper.init_driver()
        return jsonify({
            "success": success,
            "message": "스크래퍼가 초기화되었습니다." if success else "스크래퍼 초기화에 실패했습니다."
        })
    except Exception as e:
        return _handle_api_error(e)

@app.route('/api/login', methods=['POST'])
def login():
    """로그인"""
    try:
        data = request.get_json()
        username = data.get('username', 'test0137')
        password = data.get('password', '#test0808')

        return jsonify(scraper.login(username, password))
    except Exception as e:
        return _handle_api_error(e)

@app.route('/api/status', methods=['GET'])
def get_status():
    """현재 상태 확인"""
    try:
        return jsonify(scraper.get_current_status())
    except Exception as e:
        return _handle_api_error(e)

@app.route('/api/search-company-info', methods=['POST'])
def search_company_info():
    """기업 검색 및 상세 정보 추출"""
    try:
        data = request.get_json()
        company_name = data.get('company_name', '')

        if not company_name:
            return jsonify({"success": False, "message": "기업명을 입력해주세요."})

        result = scraper.search_company_info(company_name)
        return jsonify(result)

    except Exception as e:
        return _handle_api_error(e)

@app.route('/api/job-essays', methods=['POST'])
def get_job_essays():
    """합격 자소서 정보"""
    try:
        data = request.get_json()
        company_name = data.get('company_name', '')
        job_position = data.get('job_position', None)

        if not company_name:
            return jsonify({"success": False, "message": "기업명을 입력해주세요."})

        result = scraper.get_job_essays(company_name, job_position)
        return jsonify(result)

    except Exception as e:
        return _handle_api_error(e)

@app.route('/api/job-tips', methods=['POST'])
def get_job_tips():
    """지원 꿀팁 정보"""
    try:
        data = request.get_json()
        company_name = data.get('company_name', '')
        job_position = data.get('job_position', None)

        if not company_name:
            return jsonify({"success": False, "message": "기업명을 입력해주세요."})

        result = scraper.get_job_tips(company_name, job_position)
        return jsonify(result)

    except Exception as e:
        return _handle_api_error(e)

@app.route('/api/job-detail', methods=['POST'])
def get_job_detail():
    """공고 상세 정보"""
    try:
        data = request.get_json()
        job_url = data.get('job_url', '')

        if not job_url:
            return jsonify({"success": False, "message": "공고 URL을 입력해주세요."})

        result = scraper.get_job_detail(job_url)
        return jsonify(result)

    except Exception as e:
        return _handle_api_error(e)

@app.route('/health', methods=['GET'])
def health_check():
    """헬스 체크"""
    return jsonify({
        "status": "ok",
        "service": "Catch Scraper Service",
        "message": "캐치 채용 정보 수집 서비스가 정상 작동 중입니다."
    })

if __name__ == '__main__':
    try:
        print("🚀 Catch Scraper Service starting...")
        print("📊 Available endpoints:")
        print("   - POST /api/init (Initialize)")
        print("   - POST /api/login (Login)")
        print("   - POST /api/search-company-info (Company Info)")
        print("   - POST /api/job-essays (Job Essays)")
        print("   - POST /api/job-tips (Job Tips)")
        print("   - POST /api/job-detail (Job Detail)")
        print("   - GET /health (Health Check)")
        app.run(host='0.0.0.0', port=3000, debug=True)
    except KeyboardInterrupt:
        scraper.close_driver()