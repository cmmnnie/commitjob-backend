// backend/server.js
//import swaggerUi from "swagger-ui-express";
//import YAML from "yamljs";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import axios from "axios";
import multer from "multer";
import * as jose from "jose";
import crypto from "crypto";
import path from 'path';
import fs from 'fs';

// Removed: Advanced Recommendation Algorithms (replaced with GPT MCP)



dotenv.config();
const app = express();
// ✨ 안전한 포트/호스트 결정
const PORT = Number(process.env.PORT || 4001);

// 모든 네트워크 인터페이스에서 접근 가능하도록 설정 (프론트엔드 팀 접근용)
const HOST = process.env.HOST || '0.0.0.0';

// 중복 listen 방지 - 혹시 다른 곳에서 httpServer.listen을 또 호출하면 에러 띄우게
if (!app._listening) {
  const server = app.listen(PORT, HOST, () => {
    console.log(`[BOOT] Listening on http://${HOST}:${PORT} (NODE_ENV=${process.env.NODE_ENV || 'undefined'})`);
  });
  app._listening = true;

  // 프로세스 진짜로 리스닝 중인지 1초 뒤에도 로그
  setTimeout(() => {
    console.log(`[HEALTH] server.listening=${server.listening}`);
  }, 1000);
}

// --- Swagger UI ---
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
const openapi = YAML.load('./openapi.yaml');
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { explorer: true }));

/* -------------------- 기본 설정 -------------------- */
app.use(cookieParser());
app.use(express.json());

// --- 파일 업로드 (multer) ---

// 프로필 업로드용 (디스크)
const resumeDir = path.join(process.cwd(), 'uploads', 'resume');
fs.mkdirSync(resumeDir, { recursive: true });

const uploadDir = path.join(process.cwd(), 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const userId = req.body.user_id || 'unknown';
    const ext = path.extname(file.originalname || '.pdf');
    cb(null, `${userId}_${Date.now()}${ext}`);
  }
});
const uploadProfile = multer({ storage: diskStorage });

// 세션 인제스트용 (메모리)
const uploadMem = multer({ storage: multer.memoryStorage() });
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
// --- MySQL 풀 ---
import mysql from 'mysql2/promise';
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  connectionLimit: 10
});


// 프록시 환경에서 secure 쿠키 판단용
app.set("trust proxy", 1);

// 예: backend/server.js 어딘가(다른 라우트들 아래쪽이면 OK)
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Backend is healthy!' });
});


// 미들웨어들(app.use(express.json()), cors 등) 다음 줄에 추가
app.get(['/health', '/api/health', '/auth/health'], (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Backend is healthy!' });
});


// 여러 프론트 오리진 허용
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);


console.log("[CORS] Initial allowedOrigins (on startup) =", allowedOrigins); // 시작 시점에 확인
// 운영/로컬 둘 다 안전하게 기본값 보강
if (allowedOrigins.length === 0) {
  allowedOrigins.push(
    'https://commitjob.site',
    'https://www.commitjob.site',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://commitjob.site'
  );
}
// state 보관 (google/kakao 공용)
const stateStore = new Map(); // state -> origin

const corsOptions = {
  origin: function (origin, callback) {
    console.log(`[CORS Check] Incoming origin: "${origin}" (length: ${origin ? origin.length : 0})`);
    console.log(`[CORS Check] allowedOrigins used in callback: `, allowedOrigins);

    if (!origin) {
      console.log('[CORS Check] No origin (server-to-server or terminal test). Allowed.');
      return callback(null, true); // 서버-서버 / curl 허용
    }

    if (allowedOrigins.includes(origin)) {
      console.log(`[CORS Check] Origin "${origin}" found in allowed list. Allowed.`);
      return callback(null, true);
    }

    console.error(`[CORS Check] ERROR: Origin "${origin}" NOT found in allowed list! Disallowed.`);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 204,
};
console.log("[CORS] allowedOrigins =", allowedOrigins);
// --- CORS 미들웨어는 "반드시" 라우트보다 먼저
app.use(cors(corsOptions));
/* -------------------- 임시 유저 저장소 -------------------- */

// Removed: 고급 추천 엔진 (replaced with GPT MCP)
const memUsers = new Map(); // key: provider:sub → { id, email, name, picture }
let nextUserId = 1;

// 세션(개인화용) 저장소
const sessions = new Map(); // sessionId -> { user:{}, jobs:[], companies:[] }
const newSessionId = () => crypto.randomUUID();
const ensureSession = sid => {
  if (!sid || !sessions.has(sid)) throw new Error("NO_SESSION");
  return sessions.get(sid);
};

/* -------------------- 1) 구글 로그인 시작 ------------------ */
app.get("/auth/google", (req, res) => {
  const origin = req.query.origin?.toString();
  if (!origin || !allowedOrigins.includes(origin)) {
    return res.status(400).send("Bad origin");
  }
  const state = crypto.randomUUID();
  stateStore.set(state, origin);

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    include_granted_scopes: "true",
    state,
    prompt: "select_account",
    access_type: "offline",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

/* --------- 2) 구글 콜백: code→token, 검증, 세션 쿠키 ------- */
app.get("/auth/google/callback", async (req, res) => {
  const fallback = allowedOrigins[0] || "http://localhost:5173";
  try {
    const { code, state } = req.query;

    const origin = stateStore.get(state);
    stateStore.delete(state);
    if (!origin) return res.status(403).json({ error: "INVALID_STATE" });

    const tokenRes = await axios.post(
      "https://oauth2.googleapis.com/token",
      {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const { id_token } = tokenRes.data;

    const JWKS = jose.createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
    const { payload } = await jose.jwtVerify(id_token, JWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const email = payload.email ?? null;
    const name = payload.name ?? null;
    const picture = payload.picture ?? null;
    const sub = payload.sub;

    const key = `google:${sub}`;
    if (!memUsers.has(key)) memUsers.set(key, { id: nextUserId++, email, name, picture });
    else {
      const u = memUsers.get(key);
      u.email = email;
      u.name = name;
      u.picture = picture;
    }
    const uid = memUsers.get(key).id;

    const appJwt = await new jose.SignJWT({ uid, email, provider: "google" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));

    const isProd = process.env.NODE_ENV === "production";
    res.cookie("app_session", appJwt, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.redirect(`${origin}/auth/callback?ok=1`);
  } catch (e) {
    console.error(e.response?.data || e);
    res.redirect(`${fallback}/auth/callback?ok=0`);
  }
});

/* -------------------- 1-2) 카카오 로그인 시작 ------------------ */
app.get("/auth/kakao", (req, res) => {
  const origin = req.query.origin?.toString();
  if (!origin || !allowedOrigins.includes(origin)) {
    return res.status(400).send("Bad origin");
  }
  const state = crypto.randomUUID();
  stateStore.set(state, origin);

  const params = new URLSearchParams({
    client_id: process.env.KAKAO_REST_API_KEY,
    redirect_uri: process.env.KAKAO_REDIRECT_URI,
    response_type: "code",
    state,
    scope: "profile_nickname profile_image account_email",
  });
  res.redirect(`https://kauth.kakao.com/oauth/authorize?${params.toString()}`);
});

// 조정된 app.get("/auth/kakao/login-url") 라우트
app.get("/auth/kakao/login-url", (req, res) => {
  // 프론트엔드가 이 URL을 요청할 때 자신의 origin을 쿼리 파라미터로 전달해야 합니다.
  // 예: /auth/kakao/login-url?origin=http://localhost:5173
  const origin = req.query.origin?.toString(); 
  if (!origin || !allowedOrigins.includes(origin)) {
    return res.status(400).json({ error: "Bad origin or missing origin query parameter" }); // JSON 응답으로 변경
  }

  const state = crypto.randomUUID();
  stateStore.set(state, origin); // 생성된 state와 프론트엔드의 origin을 연결하여 저장

  const params = new URLSearchParams({
    client_id: process.env.KAKAO_REST_API_KEY,
    redirect_uri: process.env.KAKAO_REDIRECT_URI,
    response_type: "code",
    state, // 이 state 값을 카카오 인가 URL에 포함
    scope: "profile_nickname profile_image account_email",
  });
  const url = `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
  
  // 프론트엔드에 카카오 인가 URL과 함께 생성된 state 값을 반환합니다.
  res.json({ url, state }); 
});



/* --------- 2) 카카오 콜백: code→token, 사용자 조회, 세션 쿠키 ------- */
app.get("/auth/kakao/callback", async (req, res) => {
  const fallback = allowedOrigins[0] || "http://localhost:5173";
  try {
    const { code, state } = req.query;

    const origin = stateStore.get(state);
    stateStore.delete(state);
    if (!origin) return res.status(403).json({ error: "INVALID_STATE" });

    const form = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.KAKAO_REST_API_KEY,
      redirect_uri: process.env.KAKAO_REDIRECT_URI,
      code: String(code),
    });
    if (process.env.KAKAO_CLIENT_SECRET) {
      form.set("client_secret", process.env.KAKAO_CLIENT_SECRET);
    }

    const tokenRes = await axios.post(
      "https://kauth.kakao.com/oauth/token",
      form.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token } = tokenRes.data;

    const meRes = await axios.get("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const kakao = meRes.data;
    const sub = kakao.id?.toString();
    const emailRaw = kakao.kakao_account?.email ?? null;
    const email = emailRaw ?? (sub ? `kakao_${sub}@no-email.kakao` : null);
    const name = kakao.kakao_account?.profile?.nickname ?? null;
    const picture = kakao.kakao_account?.profile?.profile_image_url ?? null;

    const key = `kakao:${sub}`;
    if (!memUsers.has(key)) memUsers.set(key, { id: nextUserId++, email, name, picture });
    else {
      const u = memUsers.get(key);
      u.email = email;
      u.name = name;
      u.picture = picture;
    }
    const uid = memUsers.get(key).id;

    const appJwt = await new jose.SignJWT({ uid, email, provider: "kakao" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));

    const isProd = process.env.NODE_ENV === "production";
    res.cookie("app_session", appJwt, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.redirect(`${origin}/auth/callback?ok=1`);
  } catch (e) {
    console.error("KAKAO_AUTH_FAIL", {
      msg: e.message,
      data: e.response?.data,
      status: e.response?.status,
    });
    res.redirect(`${fallback}/auth/callback?ok=0`);
  }
});

/* ==================== 세션 공통 ==================== */
app.get("/api/me", async (req, res) => {
  try {
    const cookie = req.cookies?.app_session;
    if (!cookie) return res.status(401).json({ user: null });

    const { payload } = await jose.jwtVerify(
      cookie,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );

    let user = null;
    for (const [, v] of memUsers) if (v.id === payload.uid) user = v;
    if (!user) return res.status(401).json({ user: null });

    res.json({ user: { ...user, provider: payload.provider } });
  } catch {
    res.status(401).json({ user: null });
  }
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("app_session", { path: "/" });
  res.json({ ok: true });
});

/* ==================== 세션/프로필/인제스트 ==================== */
app.post("/session/start", (req, res) => {
  const sid = newSessionId();
  sessions.set(sid, { user: null, jobs: [], companies: [] });
  res.json({ sessionId: sid });
});

app.post('/api/profile', uploadProfile.single('resume'), async (req, res) => {
  try {
    const {
      sessionId,
      skills = [],
      years = null,
      region = null,
      role = null,
      resumeText = "",
    } = req.body || {};
    const s = ensureSession(sessionId);

    let normalizedFromResume = null;
    if (resumeText?.trim() && process.env.MCP_INGEST_BASE) {
      const { data } = await axios.post(
        `${process.env.MCP_INGEST_BASE}/tools/normalize_text`,
        { text: resumeText }
      );
      normalizedFromResume = data?.normalizedJob || null;
    }

    s.user = {
      skills,
      years,
      region,
      role,
      resumeText,
      resumeHints: normalizedFromResume
        ? {
            skills: normalizedFromResume.skills || null,
            summary: normalizedFromResume.description || null,
          }
        : null,
    };
    res.json({ ok: true, user: s.user });
  } catch (e) {
    res
      .status(400)
      .json({ error: { code: e.message || "BAD_INPUT", message: "profile set failed" } });
  }
});

app.post("/session/ingest/files", uploadMem.array("files", 10), async (req, res) => {
  try {
    const { sessionId } = req.body || {};
    const s = ensureSession(sessionId);
    if (!req.files?.length) return res.status(400).json({ error: { code: "NO_FILES" } });

    const added = [];
    for (const f of req.files) {
      // Node 18+ 글로벌 fetch/FormData/Blob 사용
      const form = new FormData();
      form.append("file", new Blob([f.buffer]), f.originalname);

      const r = await fetch(`${process.env.MCP_INGEST_BASE}/tools/extract_file_and_normalize`, {
        method: "POST",
        body: form,
      }).then(_ => _.json());

      const job = r?.normalizedJob;
      if (!job) continue;

      const isCompanyDoc = /회사 소개|기업 소개|culture|value|vision|연봉 보고서|리포트/i.test(
        (job.title || "") + " " + (job.description || "")
      );

      if (!isCompanyDoc) {
        const job_id = `${(job.company || "unknown").toLowerCase().replace(/\s+/g, "-")}_${Date.now()}`;
        const company_id = (job.company || "unknown").toLowerCase().replace(/\s+/g, "-");
        s.jobs.push({ ...job, job_id, company_id, source: "file" });
        added.push({ type: "job", job_id, title: job.title, company: job.company });
      } else {
        const company_id = (job.company || "unknown").toLowerCase().replace(/\s+/g, "-");
        s.companies.push({
          company_id,
          name: job.company || "기업",
          overview: job.description || null,
          culture: null,
          values: null,
          scores: null,
          review_highlights: null,
        });
        added.push({ type: "company", company_id, name: job.company || "기업" });
      }
    }

    res.json({ ok: true, added, counts: { jobs: s.jobs.length, companies: s.companies.length } });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: { code: "INGEST_FAILED", message: "file ingest failed" } });
  }
});

app.post("/session/ingest/url", async (req, res) => {
  try {
    const { sessionId, url } = req.body || {};
    const s = ensureSession(sessionId);
    if (!url) return res.status(400).json({ error: { code: "NO_URL" } });

    const { data } = await axios.post(
      `${process.env.MCP_INGEST_BASE}/tools/fetch_url_and_normalize`,
      { url }
    );
    const job = data?.normalizedJob;
    if (!job) return res.status(415).json({ error: { code: "PARSE_FAIL" } });

    const job_id = `${(job.company || "unknown").toLowerCase().replace(/\s+/g, "-")}_${Date.now()}`;
    const company_id = (job.company || "unknown").toLowerCase().replace(/\s+/g, "-");
    s.jobs.push({ ...job, job_id, company_id, source: "url", source_url: url });

    res.json({ ok: true, job_id, title: job.title, company: job.company });
  } catch (e) {
    res.status(500).json({ error: { code: "INGEST_URL_FAILED" } });
  }
});

/* -------------------- 맞춤 추천 -------------------- */
function skillMatchScore(userSkills, jobSkills) {
  if (!Array.isArray(userSkills) || !Array.isArray(jobSkills)) return 0;
  const set = new Set(jobSkills.map(s => String(s).toLowerCase()));
  const inter = userSkills.filter(s => set.has(String(s).toLowerCase())).length;
  return inter / Math.max(1, userSkills.length);
}
function yearsFit(userYears, min, max) {
  if (userYears == null || min == null || max == null) return 0.5;
  if (userYears < min - 1 || userYears > max + 1) return 0;
  if (userYears >= min && userYears <= max) return 1;
  return 0.5;
}
function regionFit(userRegion, jobRegion) {
  if (!userRegion || !jobRegion) return 0.5;
  return jobRegion.includes(userRegion) ? 1 : 0.5;
}

app.get("/session/recs", async (req, res) => {
  try {
    const { sessionId, top = 20 } = req.query;
    const s = ensureSession(String(sessionId));
    if (!s.user) return res.status(400).json({ error: { code: "NO_USER_PROFILE" } });
    if (!s.jobs.length) return res.json({ items: [] });

    const candidates = s.jobs
      .map(j => {
        const f_skill = skillMatchScore(s.user.skills || [], j.skills || []);
        const f_years = yearsFit(s.user.years, j.years_min, j.years_max);
        const f_region = regionFit(s.user.region, j.region);
        const f_text = 0.7; // MVP 더미
        const score_v1 = 0.4 * f_skill + 0.25 * f_text + 0.15 * f_years + 0.1 * f_region + 0.1 * 0;
        return {
          job_id: j.job_id,
          company_id: j.company_id,
          title: j.title,
          skills: j.skills || [],
          region: j.region || null,
          years_min: j.years_min ?? null,
          years_max: j.years_max ?? null,
          description: j.description || "",
          score_v1: Number(score_v1.toFixed(4)),
        };
      })
      .sort((a, b) => b.score_v1 - a.score_v1)
      .slice(0, 100);

    const { data } = await axios.post(
      `${process.env.MCP_RECS_BASE}/tools/rerank_jobs`,
      {
        sessionId: String(sessionId),
        user: { skills: s.user.skills, years: s.user.years, region: s.user.region, role: s.user.role },
        candidates,
        topK: Math.min(Number(top) || 20, 50),
      },
      { timeout: 20000 }
    );

    const ranked = (data?.ranked || []).map(r => {
      const base = candidates.find(c => c.job_id === r.job_id) || {};
      return { ...base, finalScore: r.finalScore, reason: r.reason };
    });

    res.json({ items: ranked });
  } catch (e) {
    console.error("RECS_FAILED", e.response?.data || e.message);
    res.status(500).json({ error: { code: "RECS_FAILED" } });
  }
});

/* -------------------- GPT MCP 기반 맞춤 추천 API -------------------- */
/**
 * @swagger
 * /api/advanced-recommendations:
 *   get:
 *     summary: 고급 알고리즘 기반 맞춤형 채용공고 추천
 *     tags: [Advanced Recommendations]
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: 세션 ID
 *       - in: query
 *         name: algorithm
 *         schema:
 *           type: string
 *           enum: [content, collaborative, deep, ensemble]
 *           default: ensemble
 *         description: 사용할 추천 알고리즘
 *       - in: query
 *         name: top
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 반환할 추천 개수
 *     responses:
 *       200:
 *         description: 추천 결과
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       job_id:
 *                         type: string
 *                       score:
 *                         type: number
 *                       algorithm:
 *                         type: string
 *                       explanation:
 *                         type: string
 *                 algorithm_used:
 *                   type: string
 *                 engine_stats:
 *                   type: object
 */
app.get("/api/advanced-recommendations", async (req, res) => {
  try {
    const { sessionId, top = 20, algorithm = 'ensemble' } = req.query;
    const s = ensureSession(String(sessionId));
    if (!s.user) return res.status(400).json({ error: { code: "NO_USER_PROFILE" } });
    if (!s.jobs.length) return res.json({ items: [] });

    const userId = `session_${sessionId}`;

    // 사용자 프로필을 추천 엔진에 추가
    recommendationEngine.addUserProfile(userId, {
      skills: s.user.skills || [],
      experience: s.user.experience || '',
      interests: s.user.interests || '',
      location: s.user.region || '',
      age: s.user.age || null
    });

    // 채용공고 특성을 추천 엔진에 추가
    for (const job of s.jobs) {
      recommendationEngine.addItemFeatures(job.job_id, {
        title: job.title || '',
        description: job.description || '',
        requirements: job.requirements || '',
        skills: job.skills || [],
        company: job.company || '',
        location: job.region || '',
        category: job.category || 'general'
      });
    }

    // 고급 알고리즘으로 추천 생성
    const candidateIds = s.jobs.map(j => j.job_id);
    const recommendations = await recommendationEngine.recommend(
      userId,
      candidateIds,
      Number(top),
      algorithm
    );

    // 결과를 기존 형식에 맞게 변환
    const candidates = recommendations.map(rec => {
      const job = s.jobs.find(j => j.job_id === rec.itemId);
      if (!job) return null;

      return {
        job_id: job.job_id,
        company_id: job.company_id,
        title: job.title,
        skills: job.skills || [],
        region: job.region || null,
        years_min: job.years_min ?? null,
        years_max: job.years_max ?? null,
        description: job.description || "",
        score: Number(rec.score.toFixed(4)),
        algorithm: rec.algorithm,
        explanation: recommendationEngine.explainRecommendation(rec),
        algorithm_details: rec.algorithmScores || null
      };
    }).filter(Boolean);

    res.json({
      items: candidates,
      algorithm_used: algorithm,
      total_candidates: candidateIds.length,
      engine_stats: recommendationEngine.getStatistics()
    });
  } catch (e) {
    console.error("[advanced-recommendations error]", e);
    res.status(500).json({ error: { code: "ADVANCED_RECS_FAILED" } });
  }
});

/**
 * @swagger
 * /api/train-recommendation-engine:
 *   post:
 *     summary: 추천 엔진 훈련 (관리자용)
 *     tags: [Advanced Recommendations]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               interactions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     itemId:
 *                       type: string
 *                     rating:
 *                       type: number
 *                       minimum: 1
 *                       maximum: 5
 *     responses:
 *       200:
 *         description: 훈련 완료
 */
app.post("/api/train-recommendation-engine", async (req, res) => {
  try {
    const { interactions } = req.body;

    if (!Array.isArray(interactions) || interactions.length === 0) {
      return res.status(400).json({ error: { code: "INVALID_INTERACTIONS" } });
    }

    // 상호작용 데이터 추가
    recommendationEngine.addInteractions(interactions);

    // 모델 훈련
    console.log('[추천 엔진] 훈련 시작...');
    await recommendationEngine.train();
    console.log('[추천 엔진] 훈련 완료');

    res.json({
      success: true,
      stats: recommendationEngine.getStatistics(),
      message: '추천 엔진 훈련이 완료되었습니다.'
    });
  } catch (e) {
    console.error("[train-recommendation-engine error]", e);
    res.status(500).json({ error: { code: "TRAINING_FAILED" } });
  }
});

/**
 * @swagger
 * /api/recommendation-stats:
 *   get:
 *     summary: 추천 엔진 통계 조회
 *     tags: [Advanced Recommendations]
 *     responses:
 *       200:
 *         description: 추천 엔진 통계
 */
app.get("/api/recommendation-stats", (req, res) => {
  try {
    const stats = recommendationEngine.getStatistics();
    res.json(stats);
  } catch (e) {
    console.error("[recommendation-stats error]", e);
    res.status(500).json({ error: { code: "STATS_FAILED" } });
  }
});

/* -------------------- 기업 정보 API -------------------- */
// 기업 종합 정보 API
app.post("/api/company-info", async (req, res) => {
  try {
    const { company_name } = req.body;

    if (!company_name) {
      return res.status(400).json({ error: { code: "MISSING_COMPANY_NAME" } });
    }

    console.log(`[COMPANY_INFO] Requesting info for: ${company_name}`);

    const response = await axios.post(
      `${process.env.MCP_RECS_BASE}/tools/get_company_reviews`,
      { company_name },
      { timeout: 10000 }
    );

    if (response.data && response.data.success) {
      res.json({
        success: true,
        company_name,
        data: response.data,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({ error: { code: "COMPANY_INFO_FAILED" } });
    }

  } catch (error) {
    console.error("[COMPANY_INFO] Error:", error.message);
    res.status(500).json({ error: { code: "COMPANY_INFO_FAILED" } });
  }
});

// 합격 자소서 정보 API
app.post("/api/job-essays", async (req, res) => {
  try {
    const { company_name, job_position } = req.body;

    if (!company_name) {
      return res.status(400).json({ error: { code: "MISSING_COMPANY_NAME" } });
    }

    console.log(`[JOB_ESSAYS] Requesting essays for: ${company_name} - ${job_position || 'All positions'}`);

    const response = await axios.post(
      `${process.env.MCP_RECS_BASE}/tools/get_job_essays`,
      { company_name, job_position },
      { timeout: 10000 }
    );

    if (response.data && response.data.success) {
      res.json({
        success: true,
        company_name,
        job_position: job_position || 'All positions',
        data: response.data,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({ error: { code: "JOB_ESSAYS_FAILED" } });
    }

  } catch (error) {
    console.error("[JOB_ESSAYS] Error:", error.message);
    res.status(500).json({ error: { code: "JOB_ESSAYS_FAILED" } });
  }
});

// 지원 꿀팁 정보 API
app.post("/api/job-tips", async (req, res) => {
  try {
    const { company_name, job_position } = req.body;

    if (!company_name) {
      return res.status(400).json({ error: { code: "MISSING_COMPANY_NAME" } });
    }

    console.log(`[JOB_TIPS] Requesting tips for: ${company_name} - ${job_position || 'All positions'}`);

    const response = await axios.post(
      `${process.env.MCP_RECS_BASE}/tools/get_job_tips`,
      { company_name, job_position },
      { timeout: 10000 }
    );

    if (response.data && response.data.success) {
      res.json({
        success: true,
        company_name,
        job_position: job_position || 'All positions',
        data: response.data,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({ error: { code: "JOB_TIPS_FAILED" } });
    }

  } catch (error) {
    console.error("[JOB_TIPS] Error:", error.message);
    res.status(500).json({ error: { code: "JOB_TIPS_FAILED" } });
  }
});

// 종합 취업 정보 API (기업정보 + 자소서 + 꿀팁 통합)
app.post("/api/comprehensive-job-info", async (req, res) => {
  try {
    const { company_name, job_position } = req.body;

    if (!company_name) {
      return res.status(400).json({ error: { code: "MISSING_COMPANY_NAME" } });
    }

    console.log(`[COMPREHENSIVE] Requesting comprehensive info for: ${company_name} - ${job_position || 'All positions'}`);

    // 병렬로 3개의 API 호출
    const [companyInfo, jobEssays, jobTips] = await Promise.allSettled([
      axios.post(`${process.env.MCP_RECS_BASE}/tools/get_company_reviews`, { company_name }, { timeout: 8000 }),
      axios.post(`${process.env.MCP_RECS_BASE}/tools/get_job_essays`, { company_name, job_position }, { timeout: 8000 }),
      axios.post(`${process.env.MCP_RECS_BASE}/tools/get_job_tips`, { company_name, job_position }, { timeout: 8000 })
    ]);

    const result = {
      success: true,
      company_name,
      job_position: job_position || 'All positions',
      timestamp: new Date().toISOString(),
      data: {
        company_info: companyInfo.status === 'fulfilled' && companyInfo.value.data?.success ? companyInfo.value.data : null,
        job_essays: jobEssays.status === 'fulfilled' && jobEssays.value.data?.success ? jobEssays.value.data : null,
        job_tips: jobTips.status === 'fulfilled' && jobTips.value.data?.success ? jobTips.value.data : null
      }
    };

    res.json(result);

  } catch (error) {
    console.error("[COMPREHENSIVE] Error:", error.message);
    res.status(500).json({ error: { code: "COMPREHENSIVE_INFO_FAILED" } });
  }
});

/* -------------------- 맞춤 면접 -------------------- */
/**
 * @swagger
 * /session/interview:
 *   get:
 *     summary: 회사별 맞춤 면접 질문 생성
 *     tags: [Interview Questions]
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: 세션 ID
 *       - in: query
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: 채용공고 ID
 *     responses:
 *       200:
 *         description: 맞춤 면접 질문 생성 완료
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 questions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       question:
 *                         type: string
 *                       category:
 *                         type: string
 *                       difficulty:
 *                         type: string
 *                 company_info:
 *                   type: object
 *                 job_info:
 *                   type: object
 *       400:
 *         description: 필수 파라미터 누락 또는 잘못된 요청
 *       404:
 *         description: 채용공고를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
app.get("/session/interview", async (req, res) => {
  try {
    const { sessionId, jobId } = req.query;
    const s = ensureSession(String(sessionId));
    const job = s.jobs.find(j => j.job_id === jobId);
    if (!job) return res.status(404).json({ error: { code: "JOB_NOT_FOUND" } });

    const company = s.companies.find(c => c.company_id === job.company_id) || null;

    const { data } = await axios.post(
      `${process.env.MCP_RECS_BASE}/tools/generate_interview`,
      {
        user: {
          skills: s.user?.skills,
          years: s.user?.years,
          region: s.user?.region,
          role: s.user?.role,
          resumeHints: s.user?.resumeHints,
        },
        job: {
          title: job.title,
          skills: job.skills,
          region: job.region,
          years_min: job.years_min,
          years_max: job.years_max,
          description: job.description,
        },
        company,
      },
      { timeout: 25000 }
    );

    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: { code: "INTERVIEW_FAILED" } });
  }
});

/* -------------------- 피드백(개인화) -------------------- */
app.post("/session/feedback", async (req, res) => {
  try {
    const { sessionId, type, company, skill } = req.body || {};
    ensureSession(sessionId);

    const { data } = await axios.post(`${process.env.MCP_RECS_BASE}/tools/feedback`, {
      sessionId,
      type,
      target: { company, skill },
    });
    res.json(data);
  } catch (e) {
    res.status(400).json({ error: { code: "FEEDBACK_FAILED" } });
  }
});

/* -------------------- 데모 데이터 설정 API -------------------- */
/**
 * @swagger
 * /api/setup-demo-data:
 *   post:
 *     summary: Create demo data for prototype testing
 *     tags: [Demo]
 *     responses:
 *       200:
 *         description: Demo data created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 created:
 *                   type: object
 */
app.post("/api/setup-demo-data", async (req, res) => {
  try {
    console.log('[DEMO] Setting up demo data...');

    // 데모 회사 데이터
    const demoCompanies = [
      { id: 'demo_company_1', name: '네이버', industry: 'IT', location: '서울' },
      { id: 'demo_company_2', name: '카카오', industry: 'IT', location: '서울' },
      { id: 'demo_company_3', name: '삼성전자', industry: 'IT', location: '서울' },
      { id: 'demo_company_4', name: '엔씨소프트', industry: '게임', location: '서울' },
      { id: 'demo_company_5', name: '쿠팡', industry: 'IT', location: '서울' }
    ];

    // 데모 채용공고 데이터
    const demoJobs = [
      {
        id: 'job_1',
        companyId: 'demo_company_1',
        companyName: '네이버',
        title: '백엔드 개발자',
        requiredSkills: ['Node.js', 'Express', 'MySQL', 'AWS'],
        location: '서울',
        experienceLevel: '신입',
        jobType: 'IT',
        description: 'Node.js 기반 백엔드 시스템 개발',
        salary: '3500-5000만원'
      },
      {
        id: 'job_2',
        companyId: 'demo_company_2',
        companyName: '카카오',
        title: '프론트엔드 개발자',
        requiredSkills: ['React', 'JavaScript', 'TypeScript', 'CSS'],
        location: '서울',
        experienceLevel: '신입',
        jobType: 'IT',
        description: 'React 기반 웹 프론트엔드 개발',
        salary: '3000-4500만원'
      },
      {
        id: 'job_3',
        companyId: 'demo_company_3',
        companyName: '삼성전자',
        title: '빅데이터 엔지니어',
        requiredSkills: ['Python', 'Spark', 'Hadoop', 'SQL'],
        location: '서울',
        experienceLevel: '경력 1-3년',
        jobType: '빅데이터',
        description: '대용량 데이터 처리 및 분석 시스템 구축',
        salary: '4000-6000만원'
      },
      {
        id: 'job_4',
        companyId: 'demo_company_4',
        companyName: '엔씨소프트',
        title: '게임 클라이언트 개발자',
        requiredSkills: ['C++', 'Unity', 'C#', 'DirectX'],
        location: '서울',
        experienceLevel: '신입',
        jobType: 'IT',
        description: '모바일/PC 게임 클라이언트 개발',
        salary: '3500-5500만원'
      },
      {
        id: 'job_5',
        companyId: 'demo_company_5',
        companyName: '쿠팡',
        title: '데이터 사이언티스트',
        requiredSkills: ['Python', 'TensorFlow', 'PyTorch', 'SQL'],
        location: '서울',
        experienceLevel: '경력 2-5년',
        jobType: '빅데이터',
        description: '머신러닝 모델 개발 및 데이터 분석',
        salary: '5000-8000만원'
      }
    ];

    // 데모 사용자 데이터
    const demoUsers = [
      {
        id: 'demo_user_1',
        email: 'demo1@test.com',
        name: '김개발',
        skills: ['Node.js', 'React', 'MySQL'],
        preferredLocation: '서울',
        experienceLevel: '신입',
        preferredJobType: 'IT'
      },
      {
        id: 'demo_user_2',
        email: 'demo2@test.com',
        name: '이데이터',
        skills: ['Python', 'SQL', 'TensorFlow'],
        preferredLocation: '서울',
        experienceLevel: '경력 1-3년',
        preferredJobType: '빅데이터'
      }
    ];

    // 전역 변수에 저장 (실제로는 DB에 저장해야 함)
    global.demoData = {
      companies: demoCompanies,
      jobs: demoJobs,
      users: demoUsers,
      currentUser: null
    };

    console.log('[DEMO] Demo data created successfully');
    res.json({
      success: true,
      message: 'Demo data created successfully',
      created: {
        companies: demoCompanies.length,
        jobs: demoJobs.length,
        users: demoUsers.length
      }
    });

  } catch (error) {
    console.error('[DEMO] Error setting up demo data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to setup demo data',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/demo-login:
 *   post:
 *     summary: Demo login without OAuth
 *     tags: [Demo]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 enum: [demo_user_1, demo_user_2]
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   type: object
 */
app.post("/api/demo-login", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!global.demoData) {
      return res.status(400).json({
        success: false,
        error: 'Demo data not initialized. Call /api/setup-demo-data first.'
      });
    }

    const user = global.demoData.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Demo user not found'
      });
    }

    global.demoData.currentUser = user;
    console.log(`[DEMO] User logged in: ${user.name} (${user.email})`);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        skills: user.skills,
        preferredLocation: user.preferredLocation,
        experienceLevel: user.experienceLevel,
        preferredJobType: user.preferredJobType
      }
    });

  } catch (error) {
    console.error('[DEMO] Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Demo login failed',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/demo-status:
 *   get:
 *     summary: Check demo system status
 *     tags: [Demo]
 *     responses:
 *       200:
 *         description: Demo system status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 initialized:
 *                   type: boolean
 *                 currentUser:
 *                   type: object
 *                 dataCount:
 *                   type: object
 */
app.get("/api/demo-status", (req, res) => {
  const isInitialized = !!global.demoData;

  res.json({
    initialized: isInitialized,
    currentUser: isInitialized ? global.demoData.currentUser : null,
    dataCount: isInitialized ? {
      companies: global.demoData.companies.length,
      jobs: global.demoData.jobs.length,
      users: global.demoData.users.length
    } : null
  });
});

/* -------------------- 헬스 체크 -------------------- */
app.get("/health", (req, res) => res.json({ ok: true, ts: Date.now() }));
app.get("/api/health", (req, res) => res.json({ ok: true, ts: Date.now() }));

// ==== 404 핸들러 (마지막) ====
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.originalUrl });
});


/* -------------------- 서버 시작 -------------------- */
// 변경: IPv4 로컬호스트에 확실히 바인딩
// --- listen

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[BOOT] Listening on http://127.0.0.1:${PORT} (NODE_ENV=${process.env.NODE_ENV})`);
});
