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

// 헬퍼 함수: 스킬로부터 직무 유형 추론
function inferJobTypeFromSkills(skills) {
  if (!skills || skills.length === 0) return 'IT';

  const aiSkills = ['TensorFlow', 'PyTorch', 'Keras', 'OpenCV', 'scikit-learn', 'Machine Learning', 'Deep Learning', 'AI', 'Computer Vision', 'NLP', 'Natural Language Processing'];
  const dataSkills = ['Python', 'Spark', 'Hadoop', 'SQL', 'Pandas', 'R', 'Tableau', 'PowerBI', 'Elasticsearch', 'Kafka'];

  const hasAiSkills = skills.some(skill => aiSkills.includes(skill));
  const hasDataSkills = skills.some(skill => dataSkills.includes(skill));

  if (hasAiSkills) return 'AI';
  if (hasDataSkills) return '빅데이터';
  return 'IT';
}

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
import swaggerJsdoc from 'swagger-jsdoc';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CommitJob Backend API',
      version: '1.0.0',
      description: 'CommitJob 백엔드 API - 소셜 로그인, GPT MCP 기반 맞춤형 채용공고 추천 및 면접 질문 생성',
    },
    servers: [
      {
        url: 'http://172.30.1.28:4001',
        description: 'Development server (IP)',
      },
      {
        url: 'http://api.commitjob.site:4001',
        description: 'Development server (Domain)',
      },
      {
        url: 'http://localhost:4001',
        description: 'Local development',
      },
    ],
    tags: [
      {
        name: 'Job Data Collection',
        description: '캐치 기반 기업정보 및 취업 데이터 수집 API'
      }
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'app_session'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            email: { type: 'string', nullable: true, example: 'user@example.com' },
            name: { type: 'string', nullable: true, example: '홍길동' },
            picture: { type: 'string', nullable: true, example: 'https://example.com/avatar.png' },
            provider: { type: 'string', enum: ['google', 'kakao'], example: 'google' }
          }
        },
        UserProfile: {
          type: 'object',
          properties: {
            user_id: { type: 'integer', example: 1, description: '사용자 ID' },
            jobs: { type: 'string', example: '백엔드 개발자', description: '희망직무' },
            careers: { type: 'string', example: '1-3년', description: '경력' },
            regions: { type: 'string', example: '서울', description: '희망근무지역' },
            skills: { type: 'array', items: { type: 'string' }, example: ['JavaScript', 'React', 'Node.js'], description: '기술스택' },
            resume_path: { type: 'string', example: '/uploads/resume/1_20250922.pdf', description: '자기소개서 파일 경로' },
            created_at: { type: 'string', format: 'date-time', description: '생성일시' },
            updated_at: { type: 'string', format: 'date-time', description: '수정일시' }
          },
          required: ['user_id']
        },
        Ok: {
          type: 'object',
          properties: {
            ok: { type: 'boolean', example: true }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'INVALID_STATE' },
                message: { type: 'string', example: 'state mismatch' }
              }
            }
          }
        }
      }
    }
  },
  apis: ['./server.js'], // JSDoc 주석만 사용
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// JSON 스펙 제공 (캐시 방지)
app.get('/api/docs/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('ETag', Date.now().toString());
  res.send(swaggerSpec);
});

// Swagger UI 설정 (캐시 방지)
const swaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    url: `/api/docs/swagger.json?v=${Date.now()}`
  }
};

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// 코딩 테스트 API 라우터
app.use('/api/coding', codingRouter);
app.use('/api/programmers', programmersRouter);

/* -------------------- 기본 설정 -------------------- */
app.use(cookieParser());
app.use(express.json());

// --- 파일 업로드 (multer) ---

// 프로필 업로드용 (디스크)
const resumeDir = path.join(process.cwd(), 'uploads', 'resume');
fs.mkdirSync(resumeDir, { recursive: true });

const coverLetterDir = path.join(process.cwd(), 'uploads', 'cover-letters');
fs.mkdirSync(coverLetterDir, { recursive: true });

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

const coverLetterStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, coverLetterDir),
  filename: (req, file, cb) => {
    const userId = req.body.user_id || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname || '.pdf');
    cb(null, `cover_letter_${userId}_${timestamp}${ext}`);
  }
});
const uploadProfile = multer({ storage: diskStorage });
const uploadCoverLetter = multer({
  storage: coverLetterStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB 제한
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('지원하지 않는 파일 형식입니다. PDF, DOC, DOCX, TXT 파일만 업로드 가능합니다.'));
    }
  }
});

// 세션 인제스트용 (메모리)
const uploadMem = multer({ storage: multer.memoryStorage() });
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/uploads/cover-letters', express.static(path.join(process.cwd(), 'uploads', 'cover-letters')));
// --- MySQL 풀 ---
import mysql from 'mysql2/promise';
import codingRouter from './routes/coding.js';
import programmersRouter from './routes/programmers.js';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  connectionLimit: 10
});

// 코딩 테스트 라우터에서 pool 접근 가능하도록 설정
app.set('pool', pool);

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
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:4001',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://commitjob.site',
    '*'
  );
}

// Debug endpoint to check CORS configuration
app.get('/debug/cors', (req, res) => {
  res.json({
    allowedOrigins,
    envFrontendOrigin: process.env.FRONTEND_ORIGIN,
    envLength: (process.env.FRONTEND_ORIGIN || "").length
  });
});
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

    // LocalTunnel URL 허용 (*.loca.lt)
    if (origin.endsWith('.loca.lt')) {
      console.log(`[CORS Check] LocalTunnel origin "${origin}" allowed.`);
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin) || origin === null || origin === 'null') {
      console.log(`[CORS Check] Origin "${origin}" allowed (${origin === null || origin === 'null' ? 'file protocol' : 'in allowed list'}).`);
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

// Root route
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'CommitJob Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      kakao_login: '/auth/kakao/login-url',
      recommendations: '/api/main-recommendations',
      user_profile: '/api/user-profile'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/* -------------------- 임시 유저 저장소 -------------------- */

// --- DB 기반 사용자 관리 함수들 ---
async function findOrCreateUser(providerKey, email, name, picture, provider) {
  try {
    // 기존 사용자 찾기
    const [existingUsers] = await pool.execute(
      'SELECT * FROM users WHERE provider_key = ?',
      [providerKey]
    );

    if (existingUsers.length > 0) {
      // 기존 사용자 정보 업데이트
      const user = existingUsers[0];
      await pool.execute(
        'UPDATE users SET email = ?, name = ?, picture = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [email, name, picture, user.id]
      );
      return { ...user, email, name, picture };
    } else {
      // 새 사용자 생성
      const [result] = await pool.execute(
        'INSERT INTO users (provider_key, email, name, picture, provider) VALUES (?, ?, ?, ?, ?)',
        [providerKey, email, name, picture, provider]
      );
      return {
        id: result.insertId,
        provider_key: providerKey,
        email,
        name,
        picture,
        provider
      };
    }
  } catch (error) {
    console.error('[DB] Error in findOrCreateUser:', error);
    throw error;
  }
}

async function findUserById(userId) {
  try {
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );
    return users.length > 0 ? users[0] : null;
  } catch (error) {
    console.error('[DB] Error in findUserById:', error);
    throw error;
  }
}

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

    const providerKey = `google:${sub}`;
    const user = await findOrCreateUser(providerKey, email, name, picture, 'google');
    const uid = user.id;

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
  console.log('[KAKAO-AUTH] Request origin:', origin);
  console.log('[KAKAO-AUTH] Allowed origins:', allowedOrigins);

  if (!origin || (!allowedOrigins.includes(origin) && !allowedOrigins.includes('*'))) {
    console.error('[KAKAO-AUTH] Bad origin:', origin);
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

  const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
  console.log('[KAKAO-AUTH] Redirecting to:', kakaoAuthUrl);
  console.log('[KAKAO-AUTH] KAKAO_REDIRECT_URI:', process.env.KAKAO_REDIRECT_URI);

  res.redirect(kakaoAuthUrl);
});

// 조정된 app.get("/auth/kakao/login-url") 라우트
app.get("/auth/kakao/login-url", (req, res) => {
  // 프론트엔드가 이 URL을 요청할 때 자신의 origin을 쿼리 파라미터로 전달해야 합니다.
  // 예: /auth/kakao/login-url?origin=http://localhost:5173
  const origin = req.query.origin?.toString();
  console.log('[KAKAO-LOGIN-URL] Request origin:', origin);
  console.log('[KAKAO-LOGIN-URL] Allowed origins:', allowedOrigins);

  if (!origin || (!allowedOrigins.includes(origin) && !allowedOrigins.includes('*'))) {
    console.error('[KAKAO-LOGIN-URL] Bad origin:', origin);
    console.error('[KAKAO-LOGIN-URL] allowedOrigins.includes(origin):', allowedOrigins.includes(origin));
    console.error('[KAKAO-LOGIN-URL] allowedOrigins.includes("*"):', allowedOrigins.includes('*'));
    return res.status(400).json({
      error: "Bad origin or missing origin query parameter",
      debug: {
        received_origin: origin,
        allowed_origins: allowedOrigins,
        has_wildcard: allowedOrigins.includes('*'),
        origin_in_list: allowedOrigins.includes(origin)
      }
    });
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

  console.log('[KAKAO-LOGIN-URL] Generated URL:', url);
  console.log('[KAKAO-LOGIN-URL] KAKAO_REDIRECT_URI:', process.env.KAKAO_REDIRECT_URI);
  console.log('[KAKAO-LOGIN-URL] State:', state);

  // 프론트엔드에 카카오 인가 URL과 함께 생성된 state 값을 반환합니다.
  res.json({ url, state });
});



/* --------- 2) 카카오 콜백: code→token, 사용자 조회, 세션 쿠키 ------- */
app.get("/auth/kakao/callback", async (req, res) => {
  const fallback = allowedOrigins[0] || "http://localhost:5173";
  console.log('[KAKAO-CALLBACK] Received callback');
  console.log('[KAKAO-CALLBACK] Query params:', req.query);

  try {
    const { code, state } = req.query;

    const origin = stateStore.get(state);
    console.log('[KAKAO-CALLBACK] Retrieved origin from state:', origin);
    stateStore.delete(state);

    if (!origin) {
      console.error('[KAKAO-CALLBACK] INVALID_STATE - origin not found for state:', state);
      return res.status(403).json({ error: "INVALID_STATE" });
    }

    const form = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.KAKAO_REST_API_KEY,
      redirect_uri: process.env.KAKAO_REDIRECT_URI,
      code: String(code),
    });
    if (process.env.KAKAO_CLIENT_SECRET) {
      form.set("client_secret", process.env.KAKAO_CLIENT_SECRET);
    }

    console.log('[KAKAO-CALLBACK] Requesting token from Kakao...');
    const tokenRes = await axios.post(
      "https://kauth.kakao.com/oauth/token",
      form.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token } = tokenRes.data;
    console.log('[KAKAO-CALLBACK] Access token received');

    console.log('[KAKAO-CALLBACK] Fetching user info from Kakao...');
    const meRes = await axios.get("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const kakao = meRes.data;
    console.log('[KAKAO-CALLBACK] Kakao user data:', {
      id: kakao.id,
      nickname: kakao.kakao_account?.profile?.nickname,
      has_email: !!kakao.kakao_account?.email
    });

    const sub = kakao.id?.toString();
    const emailRaw = kakao.kakao_account?.email ?? null;
    const email = emailRaw ?? (sub ? `kakao_${sub}@no-email.kakao` : null);
    const name = kakao.kakao_account?.profile?.nickname ?? null;
    const picture = kakao.kakao_account?.profile?.profile_image_url ?? null;

    const providerKey = `kakao:${sub}`;
    console.log('[KAKAO-CALLBACK] Creating/finding user with providerKey:', providerKey);

    const user = await findOrCreateUser(providerKey, email, name, picture, 'kakao');
    const uid = user.id;
    console.log('[KAKAO-CALLBACK] User ID:', uid);

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

    const redirectUrl = `${origin}/auth/callback?ok=1`;
    console.log('[KAKAO-CALLBACK] Success! Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (e) {
    console.error("[KAKAO-CALLBACK] Error:", {
      msg: e.message,
      data: e.response?.data,
      status: e.response?.status,
    });
    const redirectUrl = `${fallback}/auth/callback?ok=0`;
    console.log('[KAKAO-CALLBACK] Failed! Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  }
});

/* ==================== 세션 공통 ==================== */
/**
 * @swagger
 * /api/me:
 *   get:
 *     summary: 현재 사용자 정보 조회
 *     description: JWT 쿠키를 통해 현재 로그인된 사용자의 정보를 반환합니다.
 *     tags: [사용자 프로필]
 *     responses:
 *       200:
 *         description: 사용자 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       description: 사용자 ID
 *                     email:
 *                       type: string
 *                       description: 이메일 주소
 *                     name:
 *                       type: string
 *                       description: 사용자 이름
 *                     picture:
 *                       type: string
 *                       description: 프로필 이미지 URL
 *                     provider:
 *                       type: string
 *                       description: 로그인 제공자 (google, kakao)
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       description: 계정 생성일
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                       description: 정보 수정일
 *       401:
 *         description: 인증되지 않은 사용자
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: null
 */
app.get("/api/me", async (req, res) => {
  try {
    const cookie = req.cookies?.app_session;
    if (!cookie) return res.status(401).json({ user: null });

    const { payload } = await jose.jwtVerify(
      cookie,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );

    const user = await findUserById(payload.uid);
    if (!user) return res.status(401).json({ user: null });

    res.json({ user: { ...user, provider: payload.provider } });
  } catch {
    res.status(401).json({ user: null });
  }
});

/**
 * @swagger
 * /api/userprofile:
 *   get:
 *     summary: 사용자 프로필 조회 (별칭)
 *     description: /api/me와 동일한 기능을 제공하는 별칭 엔드포인트입니다. JWT 쿠키를 통해 현재 로그인된 사용자의 정보를 반환합니다.
 *     tags: [사용자 프로필]
 *     responses:
 *       200:
 *         description: 사용자 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       description: 사용자 ID
 *                     email:
 *                       type: string
 *                       description: 이메일 주소
 *                     name:
 *                       type: string
 *                       description: 사용자 이름
 *                     picture:
 *                       type: string
 *                       description: 프로필 이미지 URL
 *                     provider:
 *                       type: string
 *                       description: 로그인 제공자 (google, kakao)
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       description: 계정 생성일
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                       description: 정보 수정일
 *       401:
 *         description: 인증되지 않은 사용자
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: null
 */
app.get("/api/userprofile", async (req, res) => {
  try {
    const cookie = req.cookies?.app_session;
    if (!cookie) return res.status(401).json({ user: null });

    const { payload } = await jose.jwtVerify(
      cookie,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );

    const user = await findUserById(payload.uid);
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

/**
 * @swagger
 * /api/upload-cover-letter:
 *   post:
 *     summary: 자기소개서 파일 업로드
 *     description: 사용자의 자기소개서 파일을 업로드합니다. PDF, DOC, DOCX, TXT 형식을 지원합니다.
 *     tags: [사용자 프로필]
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - cover_letter
 *             properties:
 *               user_id:
 *                 type: integer
 *                 description: 사용자 ID
 *                 example: 1
 *               cover_letter:
 *                 type: string
 *                 format: binary
 *                 description: 자기소개서 파일 (PDF, DOC, DOCX, TXT)
 *               job_id:
 *                 type: string
 *                 description: 특정 채용공고 ID (선택사항)
 *                 example: "job_123"
 *               company_name:
 *                 type: string
 *                 description: 지원 회사명 (선택사항)
 *                 example: "네이버"
 *     responses:
 *       200:
 *         description: 파일 업로드 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "자기소개서가 성공적으로 업로드되었습니다."
 *                 file_path:
 *                   type: string
 *                   example: "/uploads/cover-letters/cover_letter_1_1640995200000.pdf"
 *                 file_info:
 *                   type: object
 *                   properties:
 *                     original_name:
 *                       type: string
 *                       example: "자기소개서.pdf"
 *                     file_size:
 *                       type: integer
 *                       example: 1024000
 *                     upload_date:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: 잘못된 요청 (사용자 ID 누락, 파일 누락, 지원하지 않는 파일 형식)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "MISSING_USER_ID"
 *                     message:
 *                       type: string
 *                       example: "사용자 ID가 필요합니다."
 *       404:
 *         description: 사용자를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "USER_NOT_FOUND"
 *                     message:
 *                       type: string
 *                       example: "사용자를 찾을 수 없습니다."
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "UPLOAD_FAILED"
 *                     message:
 *                       type: string
 *                       example: "파일 업로드에 실패했습니다."
 */
app.post('/api/upload-cover-letter', uploadCoverLetter.single('cover_letter'), async (req, res) => {
  try {
    const { user_id, job_id, company_name } = req.body || {};

    if (!user_id) {
      return res.status(400).json({
        error: {
          code: "MISSING_USER_ID",
          message: "사용자 ID가 필요합니다."
        }
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: {
          code: "MISSING_FILE",
          message: "자기소개서 파일이 필요합니다."
        }
      });
    }

    // 사용자 존재 확인
    const user = await findUserById(user_id);
    if (!user) {
      return res.status(404).json({
        error: {
          code: "USER_NOT_FOUND",
          message: "사용자를 찾을 수 없습니다."
        }
      });
    }

    const filePath = `/uploads/cover-letters/${req.file.filename}`;
    const uploadDate = new Date().toISOString();

    // 데이터베이스에 파일 정보 저장 (선택사항 - 현재는 파일 경로만 반환)
    // 실제 프로덕션에서는 cover_letters 테이블에 파일 정보를 저장할 수 있습니다.

    console.log(`[COVER_LETTER] File uploaded for user ${user_id}: ${req.file.filename}`);

    res.json({
      success: true,
      message: "자기소개서가 성공적으로 업로드되었습니다.",
      file_path: filePath,
      file_info: {
        original_name: req.file.originalname,
        file_size: req.file.size,
        upload_date: uploadDate,
        job_id: job_id || null,
        company_name: company_name || null
      }
    });

  } catch (error) {
    console.error('[COVER_LETTER] Upload error:', error);

    if (error.message.includes('지원하지 않는 파일 형식')) {
      return res.status(400).json({
        error: {
          code: "INVALID_FILE_TYPE",
          message: error.message
        }
      });
    }

    res.status(500).json({
      error: {
        code: "UPLOAD_FAILED",
        message: "파일 업로드에 실패했습니다."
      }
    });
  }
});
app.post("/session/start", (req, res) => {
  const sid = newSessionId();
  sessions.set(sid, { user: null, jobs: [], companies: [] });
  res.json({ sessionId: sid });
});

/**
 * @swagger
 * /api/profile:
 *   post:
 *     summary: 사용자 프로필 정보 저장/업데이트
 *     description: 사용자의 프로필 정보를 저장하거나 업데이트합니다. 이력서 파일 업로드도 함께 처리할 수 있습니다.
 *     tags: [사용자 프로필]
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *             properties:
 *               user_id:
 *                 type: integer
 *                 description: 사용자 ID
 *                 example: 1
 *               jobs:
 *                 type: string
 *                 description: 희망직무
 *                 example: "백엔드 개발자"
 *               careers:
 *                 type: string
 *                 description: 경력
 *                 example: "1-3년"
 *               regions:
 *                 type: string
 *                 description: 희망근무지역 (단일 지역, 배열로 저장됨)
 *                 example: "서울"
 *               skills:
 *                 type: string
 *                 description: 기술스택 (쉼표로 구분)
 *                 example: "Node.js, React, MySQL"
 *               resume:
 *                 type: string
 *                 format: binary
 *                 description: 이력서 파일 (선택사항)
 *     responses:
 *       201:
 *         description: 프로필 저장/업데이트 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user_id:
 *                   type: integer
 *                   example: 1
 *                 jobs:
 *                   type: string
 *                   example: "백엔드 개발자"
 *                 careers:
 *                   type: string
 *                   example: "1-3년"
 *                 regions:
 *                   type: string
 *                   example: "서울"
 *                 skills:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["Node.js", "React", "MySQL"]
 *                 resume_path:
 *                   type: string
 *                   nullable: true
 *                   example: "/uploads/resume/1_1640995200000.pdf"
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: 잘못된 요청 (사용자 ID 누락 등)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "MISSING_USER_ID"
 *                     message:
 *                       type: string
 *                       example: "profile set failed"
 *       404:
 *         description: 사용자를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "USER_NOT_FOUND"
 *                     message:
 *                       type: string
 *                       example: "User not found"
 */
app.post('/api/profile', uploadProfile.single('resume'), async (req, res) => {
  try {
    const {
      user_id,
      jobs,
      careers,
      regions,
      skills
    } = req.body || {};

    if (!user_id) {
      return res.status(400).json({ error: { code: "MISSING_USER_ID", message: "user_id is required" } });
    }

    // 사용자 존재 확인
    const user = await findUserById(user_id);
    if (!user) {
      return res.status(404).json({ error: { code: "USER_NOT_FOUND", message: "User not found" } });
    }

    // 파일 경로 처리
    let resumePath = null;
    if (req.file) {
      resumePath = `/uploads/resume/${req.file.filename}`;
    }

    // 기존 프로필 확인
    const [existingProfiles] = await pool.execute(
      'SELECT * FROM user_profiles WHERE user_id = ?',
      [user_id]
    );

    if (existingProfiles.length > 0) {
      // 프로필 업데이트
      const updateFields = [];
      const updateValues = [];

      if (jobs) {
        updateFields.push('preferred_jobs = ?');
        updateValues.push(jobs);
      }
      if (careers) {
        updateFields.push('experience = ?');
        updateValues.push(careers);
      }
      if (regions) {
        updateFields.push('preferred_regions = ?');
        updateValues.push(JSON.stringify([regions]));
      }
      if (skills) {
        updateFields.push('skills = ?');
        updateValues.push(JSON.stringify(skills.split(',').map(s => s.trim())));
      }
      if (resumePath) {
        updateFields.push('resume_path = ?');
        updateValues.push(resumePath);
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(user_id);

      await pool.execute(
        `UPDATE user_profiles SET ${updateFields.join(', ')} WHERE user_id = ?`,
        updateValues
      );
    } else {
      // 새 프로필 생성
      await pool.execute(
        'INSERT INTO user_profiles (user_id, preferred_jobs, experience, preferred_regions, skills, resume_path) VALUES (?, ?, ?, ?, ?, ?)',
        [user_id, jobs, careers, JSON.stringify([regions]), skills ? JSON.stringify(skills.split(',').map(s => s.trim())) : null, resumePath]
      );
    }

    // 업데이트된 프로필 조회
    const [profiles] = await pool.execute(
      'SELECT * FROM user_profiles WHERE user_id = ?',
      [user_id]
    );

    const profile = profiles[0];

    res.status(201).json({
      user_id: profile.user_id,
      jobs: profile.preferred_jobs,
      careers: profile.experience,
      regions: profile.preferred_regions ? JSON.parse(profile.preferred_regions)[0] : null,
      skills: profile.skills ? JSON.parse(profile.skills) : null,
      resume_path: profile.resume_path,
      created_at: profile.created_at,
      updated_at: profile.updated_at
    });
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


/**
 * @swagger
 * /api/main-recommendations:
 *   get:
 *     summary: 메인 페이지용 맞춤 IT/빅데이터 추천
 *     tags: [GPT Recommendations]
 *     parameters:
 *       - in: query
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 사용자 ID
 *       - in: query
 *         name: jobType
 *         schema:
 *           type: string
 *           enum: [IT, 빅데이터, 전체]
 *           default: 전체
 *         description: 추천할 직무 타입 (IT 10개, 빅데이터 10개)
 *     responses:
 *       200:
 *         description: 사용자 맞춤 메인 페이지 추천 결과
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 IT:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: "[필수] 채용공고 ID"
 *                       title:
 *                         type: string
 *                         description: "[필수] 채용공고 제목"
 *                       company:
 *                         type: string
 *                         description: "[필수] 회사명"
 *                       location:
 *                         type: string
 *                         description: "[필수] 근무지역"
 *                       experience:
 *                         type: string
 *                         description: "[필수] 경력요건"
 *                       skills:
 *                         type: array
 *                         items:
 *                           type: string
 *                         description: "[필수] 요구 기술스택"
 *                       salary:
 *                         type: string
 *                         description: "[선택] 연봉 정보 (있는 경우만 포함)"
 *                     required: [id, title, company, location, experience, skills]
 *                   example:
 *                     - id: "job_123"
 *                       title: "백엔드 개발자 (Node.js)"
 *                       company: "네이버"
 *                       location: ["서울"]
 *                       experience: "1-3년"
 *                       skills: ["Node.js", "Express", "MySQL"]
 *                       salary: "3000-4500만원"
 *                     - id: "job_124"
 *                       title: "풀스택 개발자"
 *                       company: "카카오"
 *                       location: "판교"
 *                       experience: "신입-2년"
 *                       skills: ["React", "Node.js", "MongoDB"]
 *                 빅데이터:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: "[필수] 채용공고 ID"
 *                       title:
 *                         type: string
 *                         description: "[필수] 채용공고 제목"
 *                       company:
 *                         type: string
 *                         description: "[필수] 회사명"
 *                       location:
 *                         type: string
 *                         description: "[필수] 근무지역"
 *                       experience:
 *                         type: string
 *                         description: "[필수] 경력요건"
 *                       skills:
 *                         type: array
 *                         items:
 *                           type: string
 *                         description: "[필수] 요구 기술스택"
 *                       salary:
 *                         type: string
 *                         description: "[선택] 연봉 정보 (있는 경우만 포함)"
 *                     required: [id, title, company, location, experience, skills]
 *                   example:
 *                     - id: "job_456"
 *                       title: "데이터 엔지니어"
 *                       company: "카카오"
 *                       location: ["서울"]
 *                       experience: "신입-2년"
 *                       skills: ["Python", "Spark", "Kafka"]
 *                       salary: "3500-5000만원"
 *                     - id: "job_457"
 *                       title: "ML 엔지니어"
 *                       company: "네이버"
 *                       location: ["서울"]
 *                       experience: "3-5년"
 *                       skills: ["Python", "TensorFlow", "Kubernetes"]
 *       500:
 *         description: 서버 오류
 */
app.get("/api/main-recommendations", async (req, res) => {
  try {
    const { user_id, jobType = '전체' } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: { code: "MISSING_USER_ID" } });
    }

    console.log(`[MAIN-RECS] Requesting GPT MCP recommendations for user ${user_id}, jobType: ${jobType}`);

    // 사용자 프로필 정보 가져오기 (데이터베이스에서)
    let userProfile = null;
    try {
      const [userProfiles] = await pool.execute(
        `SELECT up.skills, up.experience, up.preferred_regions, up.preferred_jobs, up.expected_salary,
                u.name, u.email
         FROM user_profiles up
         JOIN users u ON up.user_id = u.id
         WHERE u.id = ?`,
        [user_id]
      );

      if (userProfiles.length > 0) {
        const profile = userProfiles[0];
        userProfile = {
          name: profile.name,
          email: profile.email,
          skills: profile.skills ? (typeof profile.skills === 'string' ?
            (profile.skills.startsWith('[') ? JSON.parse(profile.skills) : profile.skills.split(',').map(s => s.trim()))
            : profile.skills) : [],
          experience: profile.experience || "신입",
          preferred_regions: profile.preferred_regions ? (typeof profile.preferred_regions === 'string' ?
            (profile.preferred_regions.startsWith('[') ? (() => {
              try {
                return JSON.parse(profile.preferred_regions);
              } catch (e) {
                return profile.preferred_regions.split(',').map(s => s.trim());
              }
            })() : profile.preferred_regions.split(',').map(s => s.trim()))
            : profile.preferred_regions) : [],
          jobs: [profile.preferred_jobs].filter(Boolean),
          expected_salary: profile.expected_salary ? `${profile.expected_salary}만원` : ""
        };
        console.log(`[MAIN-RECS] Found user profile for user ${user_id}:`, userProfile);
      } else {
        console.log(`[MAIN-RECS] No user profile found for user ${user_id}, using default`);
      }
    } catch (profileError) {
      console.error('[MAIN-RECS] Error fetching user profile:', profileError);
    }

    // GPT MCP 서비스에 추천 요청 (rerank_jobs 엔드포인트 사용)
    try {
      let allJobs = [];

      // 1단계: Catch 스크래퍼에서 실시간 공고 수집
      try {
        console.log('[MAIN-RECS] Catch 스크래퍼에서 실시간 공고 수집 중...');

        //  homepage-jobs는 자체적으로 초기화/로그인/필터링을 처리하므로 직접 호출
        console.log('[MAIN-RECS] Catch homepage-jobs API 호출 중 (자동 초기화/로그인/필터링 포함)...');

        const catchResponse = await axios.get('http://localhost:3000/api/homepage-jobs', {
          timeout: 200000 // 200초 타임아웃 (스크래핑 시간 고려)
        });

        console.log('[DEBUG] Catch response keys:', Object.keys(catchResponse.data || {}));
        console.log('[DEBUG] Has results?', !!catchResponse.data?.results);
        if (catchResponse.data?.results) {
          console.log('[DEBUG] Results keys:', Object.keys(catchResponse.data.results));
          console.log('[DEBUG] it_jobs type:', typeof catchResponse.data.results.it_jobs, 'value:', catchResponse.data.results.it_jobs);
          console.log('[DEBUG] bigdata_ai_jobs type:', typeof catchResponse.data.results.bigdata_ai_jobs, 'value:', catchResponse.data.results.bigdata_ai_jobs);
        }

        if (catchResponse.data && catchResponse.data.results) {
          // Catch 3 응답 형식: { results: { it_jobs: [], bigdata_ai_jobs: [] } }
          const itJobs = catchResponse.data.results.it_jobs || [];
          const bigdataJobs = catchResponse.data.results.bigdata_ai_jobs || [];
          const catchJobs = [...itJobs, ...bigdataJobs];

          console.log(`[MAIN-RECS] Catch에서 ${catchJobs.length}개 공고 수집 완료 (IT: ${itJobs.length}, 빅데이터/AI: ${bigdataJobs.length})`);

          if (catchJobs.length > 0) {
            // Catch 공고를 표준 형식으로 변환
            allJobs = catchJobs.map((job, index) => {
              // Catch 응답 구조: conditions, job_info, registration_info는 배열
              const conditions = job.conditions || [];
              const jobInfo = job.job_info || [];
              const registrationInfo = job.registration_info || [];

              // 경력 정보 추출 (conditions 배열에서)
              const experience = conditions.find(c => c.includes('경력') || c.includes('신입')) || "경력무관";

              // 직무 정보에서 location 추출 시도 (일반적으로 job_info에 없으므로 빈 배열)
              // 실제로는 공고 상세에서 가져와야 함
              const location = [];

              // job_info 배열을 skills로 사용 (빅데이터/AI, 네트워크/서버/보안 등)
              const skills = jobInfo;

              // jobType 결정: bigdata_ai_jobs 배열에 있으면 빅데이터/AI, it_jobs 배열에 있으면 IT
              const jobType = index < bigdataJobs.length ? '빅데이터/AI' : 'IT';

              return {
                id: job.job_id || `catch_${Date.now()}_${Math.random()}`,
                title: job.title,
                company: job.company,
                location: location,
                experience: experience,
                skills: skills,
                salary: "회사내규에 따름", // Catch는 연봉 정보를 제공하지 않음
                jobType: jobType,
                source: 'Catch 실시간',
                url: job.url // 공고 URL 추가
              };
            });
          } else {
            console.warn('[MAIN-RECS] Catch에서 공고 0개 수집됨');
            return res.status(500).json({
              error: 'Catch 스크래퍼에서 공고를 가져오지 못했습니다. Catch 서버를 확인하세요.',
              빅데이터_AI: [],
              IT: []
            });
          }
        }
      } catch (catchError) {
        console.error('[MAIN-RECS] Catch 스크래퍼 호출 실패:', catchError.message);
        return res.status(500).json({
          error: `Catch 스크래퍼 연결 실패: ${catchError.message}`,
          빅데이터_AI: [],
          IT: []
        });
      }

      console.log(`[MAIN-RECS] 총 ${allJobs.length}개 공고 준비 완료 (출처: Catch 스크래퍼)`);

      // Catch에서 공고를 가져오지 못하면 에러 반환 (DB 폴백 제거)
      if (allJobs.length === 0) {
        console.error('[MAIN-RECS] Catch 스크래퍼에서 공고를 가져오지 못했습니다');
        return res.status(500).json({
          error: 'Catch 스크래퍼에서 공고를 가져오지 못했습니다',
          빅데이터_AI: [],
          IT: []
        });
      }

      // GPT에게 전달할 공고 목록 상세 출력
      console.log('[MAIN-RECS] GPT에게 전달되는 공고 목록:');
      allJobs.slice(0, 10).forEach((job, idx) => {
        console.log(`  [${idx + 1}] ${job.company} - ${job.title} [출처: ${job.source}]`);
        console.log(`      경력: ${job.experience}, 지역: ${job.location?.join(', ')}`);
        console.log(`      스킬: ${Array.isArray(job.skills) ? job.skills.join(', ') : job.skills}`);
        console.log(`      연봉: ${job.salary}`);
      });
      if (allJobs.length > 10) {
        console.log(`  ... 외 ${allJobs.length - 10}개 공고`);
      }

      // GPT MCP에 추천 요청
      const mcpResponse = await axios.post(
        `${process.env.MCP_RECS_BASE}/tools/rerank_jobs`,
        {
          user_profile: userProfile || {
            skills: [],
            experience: "신입",
            preferred_regions: [],
            jobs: [],
            expected_salary: ""
          },
          job_candidates: allJobs.slice(0, 20).map(job => ({
            ...job,
            job_id: job.id || job.job_id  // id를 job_id로 변환
          })),
          limit: 10  // 10개의 맞춤형 추천 반환
        },
        {
          timeout: 180000,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      console.log(`[MAIN-RECS] GPT MCP response received for user ${user_id}`);

      if (mcpResponse.data && mcpResponse.data.success && mcpResponse.data.recommendations) {
        const rerankedJobs = mcpResponse.data.recommendations;

        console.log(`[MAIN-RECS] GPT reranked ${rerankedJobs.length} jobs for user ${user_id}`);

        // GPT 추천 결과를 IT, 데이터/AI로 분류 (중복 없이)
        const dataAiJobs = [];
        const itJobs = [];
        const usedJobIds = new Set();

        for (const job of rerankedJobs) {
          // 이미 사용된 job은 스킵
          if (usedJobIds.has(job.job_id)) continue;

          // 빅데이터/AI 카테고리 우선 체크
          const isDataAi = job.category === 'AI' || job.category === '빅데이터' ||
            job.jobType === 'AI' || job.jobType === '빅데이터' ||
            (job.skills && job.skills.some(skill =>
              ['TensorFlow', 'PyTorch', 'Keras', 'Machine Learning', 'Deep Learning', 'AI', 'Computer Vision', 'NLP', 'R', 'Spark', 'Kafka', 'Hadoop', 'Elasticsearch', 'Pandas'].includes(skill)
            ));

          // IT 카테고리 체크
          const isIt = job.category === 'IT' ||
            job.jobType === 'IT' ||
            (job.skills && job.skills.some(skill =>
              ['JavaScript', 'Node.js', 'React', 'Vue.js', 'Java', 'Spring', 'Django', 'Flask', 'C++', 'Unity', 'C#'].includes(skill)
            ));

          // 빅데이터/AI 우선 배정 (9개 제한)
          if (isDataAi && dataAiJobs.length < 9) {
            dataAiJobs.push(job);
            usedJobIds.add(job.job_id);
          }
          // IT만 해당되고 빅데이터/AI에 배정되지 않은 경우만 (9개 제한)
          else if (isIt && !usedJobIds.has(job.job_id) && itJobs.length < 9) {
            itJobs.push(job);
            usedJobIds.add(job.job_id);
          }

          // 두 카테고리 모두 9개씩 채워지면 종료
          if (dataAiJobs.length >= 9 && itJobs.length >= 9) break;
        }

        // 빈 배열 처리: 중복 없이 남은 job들로 채움
        const allUsedIds = new Set([...dataAiJobs.map(j => j.job_id), ...itJobs.map(j => j.job_id)]);
        const remainingJobs = rerankedJobs.filter(job => !allUsedIds.has(job.job_id));

        console.log(`[MAIN-RECS] Initial split - dataAiJobs: ${dataAiJobs.length}, itJobs: ${itJobs.length}, remaining: ${remainingJobs.length}`);

        let finalDataAiJobs = dataAiJobs;
        let finalItJobs = itJobs;

        // dataAiJobs가 5개 미만이면 남은 job에서 채우기 (최소 5개 보장)
        if (dataAiJobs.length < 5 && remainingJobs.length > 0) {
          const needed = 5 - dataAiJobs.length;
          const taken = remainingJobs.slice(0, needed);
          finalDataAiJobs = [...dataAiJobs, ...taken];
          taken.forEach(job => allUsedIds.add(job.job_id));
          console.log(`[MAIN-RECS] Filled dataAiJobs with ${taken.length} remaining jobs (total: ${finalDataAiJobs.length})`);
        }

        // itJobs가 5개 미만이면 아직 사용 안 된 job에서 채우기 (최소 5개 보장)
        if (itJobs.length < 5) {
          const stillRemaining = rerankedJobs.filter(job => !allUsedIds.has(job.job_id));
          const needed = 5 - itJobs.length;
          const taken = stillRemaining.slice(0, needed);
          finalItJobs = [...itJobs, ...taken];
          console.log(`[MAIN-RECS] Filled itJobs with ${taken.length} remaining jobs (total: ${finalItJobs.length})`);
        }

        console.log(`[MAIN-RECS] Final counts - dataAiJobs: ${finalDataAiJobs.length}, itJobs: ${finalItJobs.length}`);

        // jobType에 따라 적절한 카테고리만 반환
        console.log(`[MAIN-RECS] Filtering by jobType: "${jobType}"`);
        let response = {};
        if (jobType === '전체') {
          response = {
            "빅데이터/AI": finalDataAiJobs,
            "IT": finalItJobs
          };
        } else if (jobType === 'IT') {
          response = {
            "IT": finalItJobs
          };
        } else if (jobType === '빅데이터' || jobType === 'AI') {
          response = {
            "빅데이터/AI": finalDataAiJobs
          };
        } else {
          // 기타 직종의 경우 IT 카테고리로 처리
          response = {
            "IT": finalItJobs
          };
        }

        // 추천 이력 저장 (Catch 공고는 DB에 없으므로 개별적으로 try-catch 처리)
        const allRecommended = [...finalDataAiJobs, ...finalItJobs];
        let savedCount = 0;
        for (const job of allRecommended) {
          if (job.job_id || job.id) {
            try {
              const logQuery = `
                INSERT INTO recommendation_logs (user_id, job_id, recommendation_score, match_reasons, created_at)
                VALUES (?, ?, ?, ?, NOW())
              `;
              await pool.query(logQuery, [
                user_id,
                job.job_id || job.id,
                85, // Default score
                JSON.stringify(job.match_reasons || [])
              ]);
              savedCount++;
            } catch (jobLogError) {
              // Catch 공고는 DB에 job_postings가 없어서 foreign key 에러 발생 - 무시
              console.log(`[MAIN-RECS] Skip saving log for Catch job: ${job.job_id || job.id} (not in DB)`);
            }
          }
        }
        console.log(`[MAIN-RECS] Saved recommendation history for ${savedCount}/${allRecommended.length} jobs`)

        return res.json(response);
      }
    } catch (mcpError) {
      console.error("[MAIN-RECS] GPT MCP service error:", mcpError.response?.data || mcpError.message);
      console.log("[MAIN-RECS] Falling back to demo data");
    }

    // GPT MCP 서비스 실패 시 실제 채용공고 데이터 폴백
    const realJobData = [
      {
        id: "job_001",
        title: "백엔드 개발자",
        company: "네이버",
        location: ["경기 성남시"],
        experience: "3-5년",
        skills: ["Java", "Spring Boot", "MySQL", "Redis"],
        salary: "5000-7000만원",
        jobType: "IT",
        match_reasons: ["Spring Boot 백엔드 시스템 개발"],
        skill_matches: [],
        powered_by: "GPT-5-mini + Catch Data"
      },
      {
        id: "job_002",
        title: "프론트엔드 개발자",
        company: "카카오",
        location: ["서울 강남구"],
        experience: "1-3년",
        skills: ["React", "TypeScript", "Redux", "Webpack"],
        salary: "4000-6000만원",
        jobType: "IT",
        match_reasons: ["React 기반 웹 서비스 개발"],
        skill_matches: [],
        powered_by: "GPT-5-mini + Catch Data"
      },
      {
        id: "job_003",
        title: "데이터 엔지니어",
        company: "토스",
        location: ["서울 강남구"],
        experience: "2-4년",
        skills: ["Python", "Apache Spark", "Kafka", "AWS"],
        salary: "5500-7500만원",
        jobType: "빅데이터",
        match_reasons: ["빅데이터 파이프라인 구축"],
        skill_matches: [],
        powered_by: "GPT-5-mini + Catch Data"
      },
      {
        id: "job_004",
        title: "DevOps 엔지니어",
        company: "쿠팡",
        location: ["서울 송파구"],
        experience: "3년 이상",
        skills: ["AWS", "Docker", "Kubernetes", "Jenkins"],
        salary: "6000-8000만원",
        jobType: "IT",
        match_reasons: ["AWS 기반 인프라 구축 및 운영"],
        skill_matches: [],
        powered_by: "GPT-5-mini + Catch Data"
      },
      {
        id: "job_005",
        title: "모바일 개발자",
        company: "라인",
        location: ["서울 송파구"],
        experience: "1-3년",
        skills: ["React Native", "JavaScript", "iOS", "Android"],
        salary: "4500-6500만원",
        jobType: "IT",
        match_reasons: ["React Native 모바일 앱 개발"],
        skill_matches: [],
        powered_by: "GPT-5-mini + Catch Data"
      }
    ];

    const allJobs = realJobData;

    // jobType에 따라 분류
    let response = {};

    if (jobType === '전체') {
      // 전체일 때만 모든 카테고리 반환
      const bigDataAiJobs = allJobs.filter(job =>
        job.jobType === 'AI' || job.jobType === '빅데이터' ||
        (job.skills && job.skills.some(skill =>
          ['TensorFlow', 'PyTorch', 'Keras', 'Machine Learning', 'Deep Learning', 'AI', 'Computer Vision', 'NLP', 'Python', 'R', 'Spark', 'Kafka', 'Hadoop', 'SQL', 'MongoDB', 'Elasticsearch', 'Pandas'].includes(skill)
        ))
      ).slice(0, 5);

      const itJobs = allJobs.filter(job =>
        job.jobType === 'IT' ||
        (job.skills && job.skills.some(skill =>
          ['JavaScript', 'Node.js', 'React', 'Vue.js', 'Java', 'Spring', 'Django', 'Flask', 'C++', 'Unity', 'C#'].includes(skill)
        ))
      ).slice(0, 5);

      response = {
        "빅데이터/AI": bigDataAiJobs.length > 0 ? bigDataAiJobs : allJobs.slice(0, 5),
        "IT": itJobs.length > 0 ? itJobs : allJobs.slice(0, 5)
      };
    } else if (jobType === 'IT') {
      // IT만 선택했을 때는 IT 카테고리만 반환
      const itJobs = allJobs.filter(job =>
        job.jobType === 'IT' ||
        (job.skills && job.skills.some(skill =>
          ['JavaScript', 'Node.js', 'React', 'Vue.js', 'Java', 'Spring', 'Django', 'Flask', 'C++', 'Unity', 'C#'].includes(skill)
        ))
      ).slice(0, 5);

      response = {
        "IT": itJobs.length > 0 ? itJobs : allJobs.filter(job => job.jobType === 'IT').slice(0, 5)
      };
    } else if (jobType === '빅데이터' || jobType === 'AI') {
      // 빅데이터/AI만 선택했을 때는 해당 카테고리만 반환
      const bigDataAiJobs = allJobs.filter(job =>
        job.jobType === 'AI' || job.jobType === '빅데이터' ||
        (job.skills && job.skills.some(skill =>
          ['TensorFlow', 'PyTorch', 'Keras', 'Machine Learning', 'Deep Learning', 'AI', 'Computer Vision', 'NLP', 'Python', 'R', 'Spark', 'Kafka', 'Hadoop', 'SQL', 'MongoDB', 'Elasticsearch', 'Pandas'].includes(skill)
        ))
      ).slice(0, 5);

      response = {
        "빅데이터/AI": bigDataAiJobs.length > 0 ? bigDataAiJobs : allJobs.filter(job => job.jobType === '빅데이터').slice(0, 5)
      };
    } else {
      // 기타 직종의 경우 관련 jobs 반환
      const filteredJobs = allJobs.filter(job => job.jobType === jobType).slice(0, 5);
      response = {
        [jobType]: filteredJobs.length > 0 ? filteredJobs : allJobs.slice(0, 5)
      };
    }

    res.json(response);

  } catch (e) {
    console.error("[MAIN-RECS] Error:", e.response?.data || e.message);
    res.status(500).json({ error: { code: "MAIN_RECS_FAILED" } });
  }
});

/* -------------------- 기업 정보 API -------------------- */
/**
 * @swagger
 * /api/search-company-info:
 *   post:
 *     summary: 기업 종합 정보 조회
 *     description: 회사명을 받아 해당 기업의 종합 정보를 조회합니다. (Catch 3 API 연동)
 *     tags: [Job Data Collection]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - company_name
 *             properties:
 *               company_name:
 *                 type: string
 *                 description: 조회할 기업명
 *                 example: "삼성전자"
 *     responses:
 *       200:
 *         description: 기업 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 company_name:
 *                   type: string
 *                   example: "삼성전자"
 *                 data:
 *                   type: object
 *                   description: 기업 정보 데이터
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     company_name:
 *                       type: string
 *                       example: "삼성전자"
 *                     reviews:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: number
 *                             example: 1
 *                           rating:
 *                             type: number
 *                             format: float
 *                             example: 4.2
 *                           title:
 *                             type: string
 *                             example: "성장할 수 있는 환경"
 *                           content:
 *                             type: string
 *                             example: "기술적 도전과 성장 기회가 많은 회사입니다."
 *                           pros:
 *                             type: string
 *                             example: "성장 기회, 좋은 동료, 워라밸"
 *                           cons:
 *                             type: string
 *                             example: "가끔 야근, 급여 수준"
 *                           department:
 *                             type: string
 *                             example: "개발"
 *                           position:
 *                             type: string
 *                             example: "백엔드 개발자"
 *                           experience:
 *                             type: string
 *                             example: "3년"
 *                           date:
 *                             type: string
 *                             example: "2024-09-20"
 *                     summary:
 *                       type: string
 *                       example: "요약을 생성할 수 없습니다."
 *                     source:
 *                       type: string
 *                       example: "catch.co.kr"
 *                     powered_by:
 *                       type: string
 *                       example: "ChatGPT-4 + Catch Data"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-01T12:00:00.000Z"
 *       400:
 *         description: 잘못된 요청 (회사명 누락)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "MISSING_COMPANY_NAME"
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "COMPANY_INFO_FAILED"
 */
// 기업 종합 정보 API
app.post("/api/search-company-info", async (req, res) => {
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

/**
 * @swagger
 * /api/job-essays:
 *   post:
 *     summary: 합격 자소서 정보 조회
 *     description: 회사명과 직무를 받아 해당 기업의 합격 자소서 정보를 조회합니다.
 *     tags: [Job Data Collection]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - company_name
 *             properties:
 *               company_name:
 *                 type: string
 *                 description: 조회할 기업명
 *                 example: "삼성전자"
 *               job_position:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 조회할 직무 목록 (선택사항)
 *                 example: ["소프트웨어 엔지니어", "데이터 사이언티스트"]
 *     responses:
 *       200:
 *         description: 자소서 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 company_name:
 *                   type: string
 *                   example: "삼성전자"
 *                 job_position:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["소프트웨어 엔지니어", "데이터 사이언티스트"]
 *                 data:
 *                   type: object
 *                   description: 자소서 정보 데이터
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-01T12:00:00.000Z"
 *       400:
 *         description: 잘못된 요청 (회사명 누락)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "MISSING_COMPANY_NAME"
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "JOB_ESSAYS_FAILED"
 */
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
        job_position: job_position ? (Array.isArray(job_position) ? job_position : [job_position]) : ['All positions'],
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

/**
 * @swagger
 * /api/job-tips:
 *   post:
 *     summary: 지원 꿀팁 정보 조회
 *     description: 회사명과 직무를 받아 해당 기업의 지원 꿀팁 정보를 조회합니다.
 *     tags: [Job Data Collection]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - company_name
 *             properties:
 *               company_name:
 *                 type: string
 *                 description: 조회할 기업명
 *                 example: "삼성전자"
 *               job_position:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 조회할 직무 목록 (선택사항)
 *                 example: ["소프트웨어 엔지니어", "데이터 사이언티스트"]
 *     responses:
 *       200:
 *         description: 지원 꿀팁 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 company_name:
 *                   type: string
 *                   example: "삼성전자"
 *                 job_position:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["소프트웨어 엔지니어", "데이터 사이언티스트"]
 *                 data:
 *                   type: object
 *                   description: 지원 꿀팁 정보 데이터
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-01T12:00:00.000Z"
 *       400:
 *         description: 잘못된 요청 (회사명 누락)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "MISSING_COMPANY_NAME"
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "JOB_TIPS_FAILED"
 */
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
        job_position: job_position ? (Array.isArray(job_position) ? job_position : [job_position]) : ['All positions'],
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

/**
 * @swagger
 * /api/comprehensive-job-info:
 *   post:
 *     summary: 종합 취업 정보 조회
 *     description: 회사명과 직무를 받아 기업 정보, 합격 자소서, 지원 꿀팁을 통합하여 조회합니다.
 *     tags: [Job Data Collection]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - company_name
 *             properties:
 *               company_name:
 *                 type: string
 *                 description: 조회할 기업명
 *                 example: "삼성전자"
 *               job_position:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 조회할 직무 목록 (선택사항)
 *                 example: ["소프트웨어 엔지니어", "데이터 사이언티스트"]
 *     responses:
 *       200:
 *         description: 종합 취업 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 company_name:
 *                   type: string
 *                   example: "삼성전자"
 *                 job_position:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["소프트웨어 엔지니어", "데이터 사이언티스트"]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-01T12:00:00.000Z"
 *                 data:
 *                   type: object
 *                   properties:
 *                     company_info:
 *                       type: object
 *                       description: 기업 정보 데이터 (null일 수 있음)
 *                     job_essays:
 *                       type: object
 *                       description: 합격 자소서 데이터 (null일 수 있음)
 *                     job_tips:
 *                       type: object
 *                       description: 지원 꿀팁 데이터 (null일 수 있음)
 *       400:
 *         description: 잘못된 요청 (회사명 누락)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "MISSING_COMPANY_NAME"
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "COMPREHENSIVE_INFO_FAILED"
 */
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
      job_position: job_position ? (Array.isArray(job_position) ? job_position : [job_position]) : ['All positions'],
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

/* -------------------- GPT MCP 기반 맞춤 면접 -------------------- */
/**
 * @swagger
 * /session/interview:
 *   get:
 *     summary: GPT MCP 기반 회사별 맞춤 면접 질문 생성
 *     tags: [Interview]
 *     parameters:
 *       - in: query
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 사용자 ID
 *       - in: query
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: 채용공고 ID
 *       - in: query
 *         name: questionCount
 *         schema:
 *           type: integer
 *           default: 8
 *         description: 생성할 질문 개수
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *           enum: [beginner, intermediate, advanced, mixed]
 *           default: mixed
 *         description: 면접 난이도 레벨
 *     responses:
 *       200:
 *         description: GPT 기반 맞춤 면접 질문 생성 완료
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
 *                       id:
 *                         type: integer
 *                       question:
 *                         type: string
 *                       category:
 *                         type: string
 *                       difficulty:
 *                         type: string
 *                       expected_answer_points:
 *                         type: array
 *                         items:
 *                           type: string
 *                       tips:
 *                         type: string
 *                 interview_strategy:
 *                   type: object
 *                   properties:
 *                     company_focus:
 *                       type: string
 *                     key_preparation_areas:
 *                       type: array
 *                       items:
 *                         type: string
 *                     personalization_insights:
 *                       type: string
 *                 job_match_analysis:
 *                   type: object
 *                   properties:
 *                     strength_areas:
 *                       type: array
 *                       items:
 *                         type: string
 *                     growth_opportunities:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: 필수 파라미터 누락 또는 잘못된 요청
 *       404:
 *         description: 채용공고를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
app.get("/session/interview", async (req, res) => {
  try {
    const { user_id, job_id, questionCount = 8, difficulty = 'mixed' } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: { code: "MISSING_USER_ID" } });
    }

    if (!job_id) {
      return res.status(400).json({ error: { code: "MISSING_JOB_ID" } });
    }

    console.log(`[GPT-INTERVIEW] 사용자 ${user_id}를 위한 채용공고 ${job_id} 면접 질문 생성 시작`);

    // 1. 사용자 프로필 정보 조회
    const [userRows] = await pool.execute(
      'SELECT id, name, email, provider FROM users WHERE id = ?',
      [user_id]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: { code: "USER_NOT_FOUND" } });
    }

    const userData = userRows[0];

    // 2. 사용자 프로필 상세 정보 조회
    const [profileRows] = await pool.execute(
      'SELECT skills, experience, preferred_regions, preferred_jobs, expected_salary FROM user_profiles WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      [user_id]
    );

    let userProfile = {
      skills: [],
      experience: "신입",
      preferred_regions: ["서울"],
      jobs: ["IT"],
      expected_salary: "3500만원"
    };

    if (profileRows.length > 0) {
      const profile = profileRows[0];
      userProfile = {
        skills: profile.skills ? JSON.parse(profile.skills) : [],
        experience: profile.experience || "신입",
        preferred_regions: profile.preferred_regions ? JSON.parse(profile.preferred_regions) : ["서울"],
        jobs: [profile.preferred_jobs || "IT"],
        expected_salary: profile.expected_salary ? `${profile.expected_salary}만원` : "3500만원"
      };
    }

    console.log(`[GPT-INTERVIEW] 사용자 프로필:`, userProfile);

    // 3. 채용공고 정보 조회 (DB에서)
    const [jobRows] = await pool.execute(
      `SELECT jp.job_id, jp.title, c.name as company_name, jp.skills, jp.experience_level,
              jp.location, jp.salary, jp.description, jp.requirements
       FROM job_postings jp
       JOIN companies c ON jp.company_id = c.company_id
       WHERE jp.job_id = ? AND jp.is_active = TRUE`,
      [job_id]
    );

    let jobDetail;

    if (jobRows.length > 0) {
      const job = jobRows[0];
      jobDetail = {
        id: job.job_id,
        title: job.title,
        company: job.company_name,
        skills: job.skills ? JSON.parse(job.skills) : [],
        location: [job.location || "서울"],
        experience: job.experience_level || "신입",
        salary: job.salary || "면접 후 결정",
        description: job.description || "",
        requirements: job.requirements || ""
      };
    } else {
      // DB에 없으면 데모 데이터에서 찾기
      if (!global.demoData || !global.demoData.jobs) {
        return res.status(404).json({ error: { code: "JOB_NOT_FOUND" } });
      }

      const demoJob = global.demoData.jobs.find(j => j.id === job_id);
      if (!demoJob) {
        return res.status(404).json({ error: { code: "JOB_NOT_FOUND" } });
      }

      jobDetail = {
        id: demoJob.id,
        title: demoJob.title,
        company: demoJob.companyName,
        skills: demoJob.requiredSkills || [],
        location: demoJob.location || ["서울"],
        experience: demoJob.experienceLevel || "신입",
        salary: demoJob.salary || "면접 후 결정",
        description: demoJob.description || "",
        requirements: demoJob.requirements || ""
      };
    }

    console.log(`[GPT-INTERVIEW] 채용공고 정보:`, {
      title: jobDetail.title,
      company: jobDetail.company,
      skills: jobDetail.skills
    });

    // 4. MCP 서비스를 통한 개인화된 면접 질문 생성
    console.log(`[GPT-INTERVIEW] MCP 서비스 호출 중... (${process.env.MCP_RECS_BASE})`);

    const mcpResponse = await axios.post(
      `${process.env.MCP_RECS_BASE}/tools/generate_interview`,
      {
        user_profile: userProfile,
        job_detail: jobDetail,
        question_count: Math.min(Number(questionCount) || 5, 10),
        difficulty: difficulty
      },
      {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`[GPT-INTERVIEW] MCP 응답 상태:`, mcpResponse.status);
    console.log(`[GPT-INTERVIEW] MCP 응답 데이터:`, mcpResponse.data);

    const responseData = mcpResponse.data;

    // 5. 응답 처리
    if (responseData?.questions && Array.isArray(responseData.questions)) {
      // 면접 로그 저장
      try {
        await pool.execute(
          'INSERT INTO interview_logs (user_id, job_id, questions, created_at) VALUES (?, ?, ?, NOW())',
          [user_id, job_id, JSON.stringify(responseData.questions)]
        );
        console.log(`[GPT-INTERVIEW] 면접 로그 저장 완료`);
      } catch (logError) {
        console.error(`[GPT-INTERVIEW] 면접 로그 저장 실패:`, logError);
      }

      res.json({
        success: true,
        job_title: jobDetail.title,
        company: jobDetail.company,
        questions: responseData.questions,
        total_questions: responseData.questions.length,
        powered_by: responseData.powered_by || "ChatGPT-4 + MCP Service",
        user_profile: {
          name: userData.name,
          skills: userProfile.skills,
          experience: userProfile.experience
        },
        generated_at: new Date().toISOString()
      });
    } else {
      console.error('[GPT-INTERVIEW] MCP 응답에 질문 데이터가 없음:', responseData);
      res.status(500).json({
        error: {
          code: "INTERVIEW_NO_QUESTIONS",
          message: "면접 질문 생성에 실패했습니다. MCP 서비스에서 유효한 질문을 받지 못했습니다."
        }
      });
    }

  } catch (error) {
    console.error("[GPT-INTERVIEW] 면접 질문 생성 실패:", error);

    if (error.code === 'ECONNREFUSED') {
      res.status(503).json({
        error: {
          code: "MCP_SERVICE_UNAVAILABLE",
          message: "MCP 서비스에 연결할 수 없습니다. 서비스가 실행 중인지 확인해주세요."
        }
      });
    } else if (error.response) {
      console.error("[GPT-INTERVIEW] MCP 서비스 응답 오류:", error.response.status, error.response.data);
      res.status(500).json({
        error: {
          code: "MCP_SERVICE_ERROR",
          message: `MCP 서비스 오류: ${error.response.status}`
        }
      });
    } else {
      res.status(500).json({
        error: {
          code: "GPT_INTERVIEW_FAILED",
          message: "면접 질문 생성 중 오류가 발생했습니다."
        }
      });
    }
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

    // 랜덤 데이터 생성을 위한 헬퍼 함수들
    const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const getRandomElements = (arr, count) => {
      const shuffled = [...arr].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count);
    };

    // 랜덤 데이터 풀
    const namePool = [
      '김개발', '이데이터', '박프론트', '최백엔드', '정풀스택', '한AI',
      '송클라우드', '윤모바일', '장게임', '임보안', '신네트워크', '조블록체인',
      '강머신러닝', '오데브옵스', '허웹개발', '남앱개발', '전시스템', '곽UI'
    ];

    const skillPools = {
      IT: [
        ['JavaScript', 'React', 'Node.js', 'MongoDB'],
        ['TypeScript', 'Vue.js', 'Express', 'PostgreSQL'],
        ['Python', 'Django', 'FastAPI', 'Redis'],
        ['Java', 'Spring Boot', 'MySQL', 'Docker'],
        ['C#', '.NET', 'SQL Server', 'Azure'],
        ['PHP', 'Laravel', 'MySQL', 'AWS'],
        ['Go', 'Gin', 'PostgreSQL', 'Kubernetes'],
        ['Ruby', 'Rails', 'MongoDB', 'Heroku']
      ],
      빅데이터: [
        ['Python', 'Pandas', 'NumPy', 'Jupyter'],
        ['R', 'Spark', 'Hadoop', 'Kafka'],
        ['Scala', 'Spark', 'Elasticsearch', 'Kibana'],
        ['Python', 'TensorFlow', 'PyTorch', 'Scikit-learn'],
        ['SQL', 'BigQuery', 'Redshift', 'Snowflake'],
        ['Python', 'Apache Airflow', 'Kafka', 'Docker']
      ],
      게임: [
        ['Unity', 'C#', 'Photon', 'PlayFab'],
        ['Unreal Engine', 'C++', 'Blueprint', 'Steam'],
        ['Cocos2d', 'JavaScript', 'WebGL', 'Node.js'],
        ['Godot', 'GDScript', 'C#', 'OpenGL']
      ],
      모바일: [
        ['React Native', 'JavaScript', 'Firebase', 'Redux'],
        ['Flutter', 'Dart', 'Firebase', 'GetX'],
        ['Swift', 'iOS', 'Core Data', 'SwiftUI'],
        ['Kotlin', 'Android', 'Room', 'Jetpack Compose'],
        ['Xamarin', 'C#', 'MVVM', 'SQLite']
      ]
    };

    const experienceLevels = ['신입', '경력 1-2년', '경력 1-3년', '경력 2-4년', '경력 3-5년', '경력 5년 이상'];
    const jobTypes = ['IT', '빅데이터', '게임', '모바일'];
    const locations = [['서울'], ['경기'], ['부산'], ['대구'], ['서울', '경기'], ['서울', '부산']];

    // 데모 회사 데이터 (고정)
    const demoCompanies = [
      { id: 'demo_company_1', name: '네이버', industry: 'IT', location: '서울' },
      { id: 'demo_company_2', name: '카카오', industry: 'IT', location: '서울' },
      { id: 'demo_company_3', name: '삼성전자', industry: 'IT', location: '서울' },
      { id: 'demo_company_4', name: '엔씨소프트', industry: '게임', location: '서울' },
      { id: 'demo_company_5', name: '쿠팡', industry: 'IT', location: '서울' }
    ];

    // 랜덤 채용공고 데이터 생성
    const jobTitles = {
      IT: ['백엔드 개발자', '프론트엔드 개발자', '풀스택 개발자', '웹 개발자', 'API 개발자'],
      빅데이터: ['데이터 엔지니어', '데이터 사이언티스트', '빅데이터 개발자', 'ML 엔지니어'],
      게임: ['게임 클라이언트 개발자', '게임 서버 개발자', '게임 기획자', 'Unity 개발자'],
      모바일: ['안드로이드 개발자', 'iOS 개발자', '모바일 앱 개발자', 'React Native 개발자']
    };

    const salaryRanges = [
      '3000-4500만원', '3500-5000만원', '4000-6000만원', '4500-6500만원',
      '5000-7000만원', '5500-8000만원', '6000-9000만원'
    ];

    const demoJobs = [];
    for (let i = 1; i <= 5; i++) {
      const jobType = getRandomElement(jobTypes);
      const company = demoCompanies[i - 1];
      const skills = getRandomElement(skillPools[jobType] || skillPools.IT);

      demoJobs.push({
        id: `job_${i}`,
        companyId: company.id,
        companyName: company.name,
        title: getRandomElement(jobTitles[jobType] || jobTitles.IT),
        requiredSkills: skills,
        location: getRandomElement(locations),
        experienceLevel: getRandomElement(experienceLevels),
        jobType: jobType,
        description: `${jobType} 분야 ${skills.join(', ')} 기술을 활용한 개발`,
        salary: getRandomElement(salaryRanges)
      });
    }

    // 랜덤 사용자 데이터 생성 (매번 다른 데이터)
    const generateRandomUser = (index) => {
      const jobType = getRandomElement(jobTypes);
      const skills = getRandomElement(skillPools[jobType] || skillPools.IT);
      const name = getRandomElement(namePool);
      const email = `demo${index}@test.com`;
      const experience = getRandomElement(experienceLevels);
      const location = getRandomElement(locations);

      return {
        id: `demo_user_${index}`,
        email: email,
        name: name,
        skills: skills,
        preferredLocation: location,
        experienceLevel: experience,
        preferredJobType: jobType
      };
    };

    const demoUsers = [
      generateRandomUser(1),
      generateRandomUser(2)
    ];

    // 실제 데이터베이스에 사용자 데이터 저장
    console.log('[DEMO] Inserting users into database...');
    let actualUsersCreated = 0;

    for (const user of demoUsers) {
      try {
        // 소셜 로그인 사용자로 저장
        const providerKey = `demo:${user.id}`;

        // users 테이블에 삽입 (중복 시 무시)
        await pool.execute(
          'INSERT IGNORE INTO users (provider_key, email, name, picture, provider) VALUES (?, ?, ?, ?, ?)',
          [providerKey, user.email, user.name, null, 'kakao']
        );

        // 삽입된 사용자 조회
        const [userResult] = await pool.execute(
          'SELECT id FROM users WHERE provider_key = ?',
          [providerKey]
        );

        if (userResult.length > 0) {
          const userId = userResult[0].id;

          // user_profiles 테이블에 프로필 삽입 (중복 시 업데이트)
          await pool.execute(`
            INSERT INTO user_profiles (user_id, skills, experience, preferred_regions, preferred_jobs, expected_salary)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            skills = VALUES(skills),
            experience = VALUES(experience),
            preferred_regions = VALUES(preferred_regions),
            preferred_jobs = VALUES(preferred_jobs),
            expected_salary = VALUES(expected_salary)
          `, [
            userId,
            JSON.stringify(user.skills),
            user.experienceLevel,
            JSON.stringify(user.preferredLocation),
            user.preferredJobType,
            user.preferredJobType === 'IT' ? 4500 : 5500 // 예상 연봉 (만원)
          ]);

          actualUsersCreated++;
          console.log(`[DEMO] Created user: ${user.name} (ID: ${userId})`);
        }
      } catch (error) {
        console.error(`[DEMO] Error creating user ${user.name}:`, error);
      }
    }

    // 전역 변수에도 저장 (기존 호환성 유지)
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
        users: actualUsersCreated
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


/* -------------------- 서버 시작 -------------------- */
/**
 * @swagger
 * /api/cover-letter/upload:
 *   post:
 *     summary: 자기소개서 파일 업로드
 *     description: 사용자의 자기소개서 파일을 업로드합니다.
 *     tags: [Cover Letter]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - cover_letter
 *             properties:
 *               user_id:
 *                 type: integer
 *                 description: 사용자 ID
 *                 example: 1
 *               cover_letter:
 *                 type: string
 *                 format: binary
 *                 description: 자기소개서 파일 (PDF, DOC, DOCX, TXT)
 *     responses:
 *       201:
 *         description: 자기소개서 업로드 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "자기소개서가 성공적으로 업로드되었습니다"
 *                 file_path:
 *                   type: string
 *                   example: "/uploads/cover_letter/cover_letter_1_1640995200000.pdf"
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "사용자 ID와 파일이 필요합니다"
 *       413:
 *         description: 파일 크기 초과
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "파일 크기가 10MB를 초과할 수 없습니다"
 */
app.post('/api/cover-letter/upload', uploadCoverLetter.single('cover_letter'), async (req, res) => {
  try {
    const { user_id } = req.body;
    const file = req.file;

    if (!user_id || !file) {
      return res.status(400).json({
        error: '사용자 ID와 파일이 필요합니다'
      });
    }

    const filePath = `/uploads/cover_letter/${file.filename}`;

    res.status(201).json({
      success: true,
      message: '자기소개서가 성공적으로 업로드되었습니다',
      file_path: filePath
    });

  } catch (error) {
    console.error('Cover letter upload error:', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: '파일 크기가 10MB를 초과할 수 없습니다'
      });
    }
    res.status(500).json({
      error: '자기소개서 업로드 중 오류가 발생했습니다'
    });
  }
});

/**
 * @swagger
 * /api/cover-letter/download/{filename}:
 *   get:
 *     summary: 자기소개서 파일 다운로드
 *     description: 업로드된 자기소개서 파일을 다운로드합니다.
 *     tags: [Cover Letter]
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: 다운로드할 파일명
 *         example: cover_letter_1_1640995200000.pdf
 *     responses:
 *       200:
 *         description: 파일 다운로드 성공
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: 파일을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "파일을 찾을 수 없습니다"
 */
app.get('/api/cover-letter/download/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(uploadDir, 'cover_letter', filename);

    if (fs.existsSync(filepath)) {
      res.download(filepath);
    } else {
      res.status(404).json({
        error: '파일을 찾을 수 없습니다'
      });
    }
  } catch (error) {
    console.error('Cover letter download error:', error);
    res.status(500).json({
      error: '파일 다운로드 중 오류가 발생했습니다'
    });
  }
});

/**
 * @swagger
 * /api/cover-letter/list/{user_id}:
 *   get:
 *     summary: 사용자 자기소개서 파일 목록 조회
 *     description: 특정 사용자가 업로드한 자기소개서 파일 목록을 조회합니다.
 *     tags: [Cover Letter]
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 사용자 ID
 *         example: 1
 *     responses:
 *       200:
 *         description: 파일 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 files:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       filename:
 *                         type: string
 *                         example: cover_letter_1_1640995200000.pdf
 *                       upload_time:
 *                         type: string
 *                         format: date-time
 *                         example: "2021-12-31T12:00:00.000Z"
 *                       size:
 *                         type: integer
 *                         example: 1048576
 *       404:
 *         description: 파일을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 files:
 *                   type: array
 *                   items: {}
 *                   example: []
 */
app.get('/api/cover-letter/list/:user_id', (req, res) => {
  try {
    const userId = req.params.user_id;
    const coverLetterDir = path.join(uploadDir, 'cover_letter');

    if (!fs.existsSync(coverLetterDir)) {
      return res.json({ success: true, files: [] });
    }

    const files = fs.readdirSync(coverLetterDir)
      .filter(filename => filename.startsWith(`cover_letter_${userId}_`))
      .map(filename => {
        const filepath = path.join(coverLetterDir, filename);
        const stats = fs.statSync(filepath);

        return {
          filename,
          upload_time: stats.mtime.toISOString(),
          size: stats.size
        };
      })
      .sort((a, b) => new Date(b.upload_time) - new Date(a.upload_time));

    res.json({
      success: true,
      files
    });

  } catch (error) {
    console.error('Cover letter list error:', error);
    res.status(500).json({
      error: '파일 목록 조회 중 오류가 발생했습니다'
    });
  }
});

// 사용자별 이전 추천 공고 조회 API
/**
 * @swagger
 * /api/user-recommendation-history:
 *   get:
 *     summary: 사용자별 이전 추천 공고 조회
 *     description: 특정 사용자의 이전 채용공고 추천 이력을 조회합니다
 *     tags: [Interview Preparation]
 *     parameters:
 *       - in: query
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 사용자 ID
 *         example: "1"
 *     responses:
 *       200:
 *         description: 추천 이력 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 history:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       job_id:
 *                         type: string
 *                         example: "job_001"
 *                       title:
 *                         type: string
 *                         example: "백엔드 개발자"
 *                       company:
 *                         type: string
 *                         example: "네이버"
 *                       recommendation_date:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T10:30:00Z"
 */
app.get('/api/user-recommendation-history', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        error: '사용자 ID가 필요합니다'
      });
    }

    console.log(`[REC-HISTORY] Fetching recommendation history for user ${user_id}`);

    // DB에서 사용자 추천 이력 조회
    const historyQuery = `
      SELECT DISTINCT
        rl.job_id,
        jp.title,
        c.name as company,
        rl.created_at as recommendation_date,
        rl.match_reasons
      FROM recommendation_logs rl
      LEFT JOIN job_postings jp ON rl.job_id = jp.job_id
      LEFT JOIN companies c ON jp.company_id = c.company_id
      WHERE rl.user_id = ?
      ORDER BY rl.created_at DESC
      LIMIT 20
    `;

    const rows = await dbQuery(historyQuery, [user_id]);

    if (rows.length === 0) {
      // 추천 이력이 없으면 샘플 데이터 제공
      const sampleHistory = [
        {
          job_id: "job_001",
          title: "백엔드 개발자",
          company: "네이버",
          recommendation_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          match_reasons: ["Spring Boot 경험 일치", "신입 포지션"]
        },
        {
          job_id: "job_002",
          title: "프론트엔드 개발자",
          company: "카카오",
          recommendation_date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          match_reasons: ["React 스킬 매칭", "경력 수준 적합"]
        },
        {
          job_id: "job_003",
          title: "풀스택 개발자",
          company: "쿠팡",
          recommendation_date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
          match_reasons: ["Node.js 경험", "지역 매칭"]
        }
      ];

      return res.json({
        success: true,
        history: sampleHistory,
        message: "이전 추천 이력이 없어 샘플 데이터를 제공합니다"
      });
    }

    // 실제 추천 이력 반환
    const history = rows.map(row => ({
      job_id: row.job_id,
      title: row.title || '채용공고 정보 없음',
      company: row.company || '회사 정보 없음',
      recommendation_date: row.recommendation_date,
      match_reasons: row.match_reasons ? JSON.parse(row.match_reasons) : []
    }));

    res.json({
      success: true,
      history
    });

  } catch (error) {
    console.error('[REC-HISTORY] Error fetching recommendation history:', error);
    res.status(500).json({
      error: '추천 이력 조회 중 오류가 발생했습니다'
    });
  }
});

// 간단한 테스트 엔드포인트
app.get('/api/test-new-endpoint', (req, res) => {
  res.json({ message: '새로운 엔드포인트가 작동하고 있습니다!', timestamp: new Date().toISOString() });
});

// 면접 질문 생성 API 개선 (선택된 공고 기반)
/**
 * @swagger
 * /api/interview-questions:
 *   post:
 *     summary: 선택된 채용공고 기반 맞춤 면접 질문 생성
 *     description: 사용자가 선택한 채용공고를 기반으로 GPT MCP를 통해 맞춤형 면접 질문을 생성합니다
 *     tags: [Interview Preparation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - job_id
 *             properties:
 *               user_id:
 *                 type: string
 *                 description: 사용자 ID
 *                 example: "1"
 *               job_id:
 *                 type: string
 *                 description: 선택된 채용공고 ID
 *                 example: "job_001"
 *     responses:
 *       200:
 *         description: 면접 질문 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 job_title:
 *                   type: string
 *                   example: "백엔드 개발자"
 *                 company:
 *                   type: string
 *                   example: "네이버"
 *                 questions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: number
 *                         example: 1
 *                       question:
 *                         type: string
 *                         example: "Spring Boot를 이용한 개발 경험에 대해 설명해주세요"
 *                       category:
 *                         type: string
 *                         example: "기술 역량"
 *                       difficulty:
 *                         type: string
 *                         example: "보통"
 *                 powered_by:
 *                   type: string
 *                   example: "ChatGPT-4 + Catch Data"
 */
app.post('/api/interview-questions', async (req, res) => {
  try {
    const { user_id, job_id, custom_company, custom_position, user_profile, additional_preferences } = req.body;

    if (!user_id || (!job_id && !custom_company)) {
      return res.status(400).json({
        error: '사용자 ID와 (채용공고 ID 또는 회사명)이 필요합니다'
      });
    }

    console.log(`[INTERVIEW-QUESTIONS] Generating questions for user ${user_id}, job ${job_id || 'custom'}, company: ${custom_company || 'from DB'}`);

    // 사용자 입력 조건 DB 저장 (custom_company 입력의 경우)
    if (custom_company && user_profile) {
      try {
        // user_interview_conditions 테이블 생성 (없는 경우)
        await pool.execute(`
          CREATE TABLE IF NOT EXISTS user_interview_conditions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            session_id VARCHAR(100),
            preferred_job VARCHAR(200),
            company_size VARCHAR(50),
            industry VARCHAR(200),
            additional_skills JSON,
            custom_company VARCHAR(200),
            custom_position VARCHAR(200),
            input_source VARCHAR(50) DEFAULT 'interview_form',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
            INDEX idx_user_id (user_id),
            INDEX idx_session_id (session_id),
            INDEX idx_created_at (created_at),
            INDEX idx_input_source (input_source)
          );
        `);

        const sessionId = `session_${Date.now()}_${user_id}`;
        const additionalSkillsJson = user_profile?.skills && Array.isArray(user_profile.skills)
          ? JSON.stringify(user_profile.skills)
          : null;

        await pool.execute(`
          INSERT INTO user_interview_conditions
          (user_id, session_id, preferred_job, custom_company, custom_position, additional_skills, input_source)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          user_id,
          sessionId,
          user_profile?.position || custom_position || null,
          custom_company,
          custom_position,
          additionalSkillsJson,
          'direct_interview_input'
        ]);

        console.log(`[INTERVIEW-QUESTIONS] Saved user conditions to DB for user ${user_id}, session ${sessionId}, company: ${custom_company}`);
      } catch (saveError) {
        console.error('[INTERVIEW-QUESTIONS] Failed to save user conditions:', saveError);
      }
    }

    let jobInfo = null;

    if (custom_company) {
      // 사용자 입력 기반 맞춤형 면접 질문
      let finalPosition = custom_position || '일반';
      if (additional_preferences?.preferred_job && additional_preferences.preferred_job.trim() !== '') {
        finalPosition = additional_preferences.preferred_job;
        console.log(`[INTERVIEW-QUESTIONS] Overriding position with additional_preferences.preferred_job: ${finalPosition}`);
      }

      // Catch 스크래퍼에서 회사 정보 + 리뷰 가져오기
      let companyInfo = null;
      try {
        console.log(`[INTERVIEW-QUESTIONS] Catch에서 ${custom_company} 회사 정보 조회 중...`);

        // Catch 스크래퍼 초기화 및 로그인
        try {
          await axios.post('http://localhost:3000/api/init', {}, { timeout: 5000 });
          console.log('[INTERVIEW-QUESTIONS] Catch 스크래퍼 초기화 완료');
        } catch (initErr) {
          console.log('[INTERVIEW-QUESTIONS] Catch 초기화 생략 (이미 초기화됨 또는 타임아웃)');
        }

        try {
          await axios.post('http://localhost:3000/api/login', {
            username: 'test0137',
            password: '#test0808'
          }, { timeout: 5000 });
          console.log('[INTERVIEW-QUESTIONS] Catch 로그인 완료');
        } catch (loginErr) {
          console.log('[INTERVIEW-QUESTIONS] Catch 로그인 생략 (이미 로그인됨 또는 타임아웃)');
        }

        const catchCompanyResponse = await axios.post('http://localhost:3000/api/search-company-info', {
          company_name: custom_company
        }, { timeout: 120000 }); // 120초 타임아웃

        if (catchCompanyResponse.data) {
          companyInfo = catchCompanyResponse.data;
          console.log(`[INTERVIEW-QUESTIONS] Catch에서 회사 정보 수집 완료:`, {
            hasReviews: !!companyInfo.reviews,
            reviewCount: companyInfo.reviews?.length || 0,
            hasInfo: !!companyInfo.company_info
          });
        }
      } catch (catchError) {
        console.warn(`[INTERVIEW-QUESTIONS] Catch 회사 정보 조회 실패:`, catchError.message);
      }

      jobInfo = {
        title: finalPosition,
        company_name: custom_company,
        company_description: companyInfo?.company_info?.description || `${custom_company}에서 일하는 것에 대한 정보`,
        company_reviews: companyInfo?.reviews?.slice(0, 5) || [], // 최대 5개 리뷰
        company_culture: companyInfo?.company_info?.culture || null,
        skills: user_profile?.skills || [],
        experience_level: user_profile?.experience || '신입-경력',
        employment_type: '정규직',
        location: user_profile?.preferred_regions?.[0] || '미정',
        source: 'user_input'
      };
      console.log(`[INTERVIEW-QUESTIONS] Using custom company input: ${custom_company} - ${finalPosition}`);
      console.log(`[INTERVIEW-QUESTIONS] User profile provided:`, user_profile);
    } else {
      // 기존 채용공고 기반 면접 질문
      const jobQuery = `
        SELECT jp.*, c.name as company_name, c.description as company_description
        FROM job_postings jp
        LEFT JOIN companies c ON jp.company_id = c.company_id
        WHERE jp.job_id = ?
      `;

      const [jobRows] = await pool.execute(jobQuery, [job_id]);

      if (jobRows.length === 0) {
        return res.status(404).json({
          error: '해당 채용공고를 찾을 수 없습니다'
        });
      }

      jobInfo = jobRows[0];

      // Catch 스크래퍼에서 회사 정보 + 리뷰 추가 수집
      if (jobInfo.company_name) {
        try {
          console.log(`[INTERVIEW-QUESTIONS] Catch에서 ${jobInfo.company_name} 추가 정보 조회 중...`);

          // Catch 스크래퍼 초기화 및 로그인
          try {
            await axios.post('http://localhost:3000/api/init', {}, { timeout: 5000 });
            console.log('[INTERVIEW-QUESTIONS] Catch 스크래퍼 초기화 완료');
          } catch (initErr) {
            console.log('[INTERVIEW-QUESTIONS] Catch 초기화 생략 (이미 초기화됨 또는 타임아웃)');
          }

          try {
            await axios.post('http://localhost:3000/api/login', {
              username: 'test0137',
              password: '#test0808'
            }, { timeout: 5000 });
            console.log('[INTERVIEW-QUESTIONS] Catch 로그인 완료');
          } catch (loginErr) {
            console.log('[INTERVIEW-QUESTIONS] Catch 로그인 생략 (이미 로그인됨 또는 타임아웃)');
          }

          const catchCompanyResponse = await axios.post('http://localhost:3000/api/search-company-info', {
            company_name: jobInfo.company_name
          }, { timeout: 120000 }); // 120초 타임아웃

          if (catchCompanyResponse.data) {
            const companyInfo = catchCompanyResponse.data;
            jobInfo.company_reviews = companyInfo.reviews?.slice(0, 5) || [];
            jobInfo.company_culture = companyInfo.company_info?.culture || null;
            console.log(`[INTERVIEW-QUESTIONS] Catch 추가 정보 수집 완료 (리뷰 ${jobInfo.company_reviews.length}개)`);
          }
        } catch (catchError) {
          console.warn(`[INTERVIEW-QUESTIONS] Catch 추가 정보 조회 실패:`, catchError.message);
          jobInfo.company_reviews = [];
          jobInfo.company_culture = null;
        }
      }
    }

    // 사용자 프로필 조회
    const userQuery = `
      SELECT up.*, u.name as user_name
      FROM user_profiles up
      LEFT JOIN users u ON up.user_id = u.id
      WHERE up.user_id = ?
    `;

    const [userRows] = await pool.execute(userQuery, [user_id]);
    const userProfile = userRows.length > 0 ? userRows[0] : null;

    // GPT MCP 서비스를 통한 면접 질문 생성
    try {
      // 사용자 프로필 데이터 결정 (입력받은 데이터 우선, 없으면 DB에서)
      let finalUserProfile;

      if (user_profile && custom_company) {
        // 사용자가 직접 입력한 프로필 데이터 사용
        finalUserProfile = {
          name: '사용자',
          skills: user_profile.skills || [],
          experience: user_profile.experience || '신입',
          preferred_jobs: user_profile.position || '개발자',
          preferred_regions: user_profile.preferred_regions || [],
          expected_salary: user_profile.expected_salary || ''
        };
        console.log(`[INTERVIEW-QUESTIONS] Using input user profile:`, finalUserProfile);
      } else if (userProfile) {
        // 데이터베이스에서 가져온 기존 프로필 사용
        // skills 파싱: JSON 배열이면 JSON.parse, 콤마 구분 문자열이면 split
        let parsedSkills = [];
        if (userProfile.skills) {
          if (Array.isArray(userProfile.skills)) {
            // 이미 배열이면 그대로 사용
            parsedSkills = userProfile.skills;
          } else if (typeof userProfile.skills === 'string') {
            try {
              // JSON 문자열 파싱 시도
              parsedSkills = JSON.parse(userProfile.skills);
            } catch (e) {
              // JSON 파싱 실패 시 콤마로 구분된 문자열로 처리
              parsedSkills = userProfile.skills.split(',').map(s => s.trim());
            }
          }
        }

        // preferred_regions 파싱
        let parsedRegions = [];
        if (userProfile.preferred_regions) {
          if (Array.isArray(userProfile.preferred_regions)) {
            parsedRegions = userProfile.preferred_regions;
          } else if (typeof userProfile.preferred_regions === 'string') {
            try {
              parsedRegions = JSON.parse(userProfile.preferred_regions);
            } catch (e) {
              parsedRegions = userProfile.preferred_regions.split(',').map(s => s.trim());
            }
          }
        }

        finalUserProfile = {
          name: userProfile.user_name || '사용자',
          skills: parsedSkills,
          experience: userProfile.experience || '신입',
          preferred_jobs: userProfile.preferred_jobs || '',
          preferred_regions: parsedRegions,
          expected_salary: userProfile.expected_salary || ''
        };
        console.log(`[INTERVIEW-QUESTIONS] Using DB user profile:`, finalUserProfile);
      } else {
        // 기본 프로필 사용
        finalUserProfile = {
          name: '사용자',
          skills: ['JavaScript', 'Node.js'],
          experience: '신입',
          preferred_jobs: '개발자',
          preferred_regions: ['서울'],
          expected_salary: ''
        };
        console.log(`[INTERVIEW-QUESTIONS] Using default user profile:`, finalUserProfile);
      }

      // job skills 파싱
      let parsedJobSkills = [];
      if (jobInfo.skills) {
        if (Array.isArray(jobInfo.skills)) {
          parsedJobSkills = jobInfo.skills;
        } else if (typeof jobInfo.skills === 'string') {
          try {
            parsedJobSkills = JSON.parse(jobInfo.skills);
          } catch (e) {
            parsedJobSkills = jobInfo.skills.split(',').map(s => s.trim());
          }
        }
      }

      // 직무명 확장 (약어 → 전체 명칭)
      const expandJobTitle = (title) => {
        if (!title) return title;
        const titleLower = title.toLowerCase().trim();
        const expansions = {
          '프론트': '프론트엔드 개발자',
          '백엔드': '백엔드 개발자',
          '백': '백엔드 개발자',
          '풀스택': '풀스택 개발자',
          '데이터': '데이터 엔지니어',
          'ai': 'AI 엔지니어',
          'ml': '머신러닝 엔지니어',
          '게임': '게임 개발자',
          'devops': 'DevOps 엔지니어'
        };

        for (const [abbr, full] of Object.entries(expansions)) {
          if (titleLower === abbr || titleLower === abbr.toLowerCase()) {
            return full;
          }
        }
        return title;
      };

      const expandedTitle = expandJobTitle(jobInfo.title);
      console.log(`[INTERVIEW-QUESTIONS] Job title expanded: "${jobInfo.title}" → "${expandedTitle}"`);

      const mcpPayload = {
        action: 'generate_interview_questions',
        user_profile: finalUserProfile,
        job_info: {
          title: expandedTitle,
          company: jobInfo.company_name,
          description: jobInfo.description || '',
          requirements: jobInfo.requirements || '',
          skills: parsedJobSkills,
          experience_level: jobInfo.experience_level || ''
        }
      };

      console.log(`[INTERVIEW-QUESTIONS] Calling MCP service for job ${job_id || `custom_${custom_company}`}`);

      const mcpResponse = await axios.post(`${process.env.MCP_RECS_BASE}/tools/generate_interview`, {
        user_profile: mcpPayload.user_profile,
        job_detail: mcpPayload.job_info
      }, {
        timeout: 180000,
        headers: { 'Content-Type': 'application/json' }
      });

      if (mcpResponse.data && mcpResponse.data.questions) {
        // 면접 질문 기록 저장 (job_id가 있을 때만)
        if (job_id) {
          const logQuery = `
            INSERT INTO interview_logs (user_id, job_id, questions, created_at)
            VALUES (?, ?, ?, NOW())
          `;

          await pool.execute(logQuery, [user_id, job_id, JSON.stringify(mcpResponse.data.questions)]);
        }

        return res.json({
          success: true,
          job_title: jobInfo.title,
          company: jobInfo.company_name,
          questions: mcpResponse.data.questions,
          total_questions: mcpResponse.data.questions.length,
          powered_by: "GPT-5-mini + Catch Data",
          generated_at: new Date().toISOString()
        });
      }
    } catch (mcpError) {
      console.error('[INTERVIEW-QUESTIONS] MCP service error:', mcpError.message);
    }

    // MCP 서비스 실패 시 폴백 질문 생성
    const fallbackQuestions = [
      {
        id: 1,
        question: "자기소개를 해주세요.",
        category: "인성",
        difficulty: "쉬움"
      },
      {
        id: 2,
        question: `${jobInfo.company_name}에 지원한 이유는 무엇인가요?`,
        category: "지원동기",
        difficulty: "쉬움"
      },
      {
        id: 3,
        question: `${jobInfo.title} 포지션에서 가장 중요하다고 생각하는 역량은 무엇인가요?`,
        category: "직무 이해",
        difficulty: "보통"
      },
      {
        id: 4,
        question: "최근에 진행한 프로젝트나 학습한 기술에 대해 설명해주세요.",
        category: "기술 역량",
        difficulty: "보통"
      },
      {
        id: 5,
        question: "어려운 문제를 해결한 경험이 있다면 공유해주세요.",
        category: "문제해결",
        difficulty: "어려움"
      }
    ];

    // 폴백 질문 기록 저장 (job_id가 있을 때만)
    if (job_id) {
      const logQuery = `
        INSERT INTO interview_logs (user_id, job_id, questions, created_at)
        VALUES (?, ?, ?, NOW())
      `;

      await pool.execute(logQuery, [user_id, job_id, JSON.stringify(fallbackQuestions)]);
    }

    res.json({
      success: true,
      job_title: jobInfo.title,
      company: jobInfo.company_name,
      questions: fallbackQuestions,
      total_questions: fallbackQuestions.length,
      powered_by: "Fallback Algorithm",
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('[INTERVIEW-QUESTIONS] Error generating questions:', error);
    res.status(500).json({
      error: '면접 질문 생성 중 오류가 발생했습니다'
    });
  }
});

/* ==================== 회사 추천 API ==================== */
/**
 * @swagger
 * /api/company-recommendations:
 *   post:
 *     summary: 사용자 프로필 기반 회사 추천
 *     description: 사용자의 기본 프로필과 추가 조건을 바탕으로 적합한 회사들을 추천합니다.
 *     tags: [면접 준비]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user_id:
 *                 type: integer
 *                 description: 사용자 ID
 *               additional_preferences:
 *                 type: object
 *                 properties:
 *                   preferred_job:
 *                     type: string
 *                     description: 희망 직종
 *                   company_size:
 *                     type: string
 *                     description: 회사 규모 선호도
 *                   industry:
 *                     type: string
 *                     description: 관심 산업/분야
 *                   additional_skills:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: 추가 기술/스킬
 *             required:
 *               - user_id
 *     responses:
 *       200:
 *         description: 회사 추천 성공
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 오류
 */
app.post('/api/company-recommendations', async (req, res) => {
  try {
    const { user_id, additional_preferences } = req.body;

    if (!user_id) {
      return res.status(400).json({
        error: '사용자 ID가 필요합니다'
      });
    }

    console.log(`[COMPANY-RECOMMENDATIONS] Generating recommendations for user ${user_id}`);

    // 새 테이블 존재 확인 및 생성
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS user_interview_conditions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT,
          session_id VARCHAR(100),
          preferred_job VARCHAR(200),
          company_size VARCHAR(50),
          industry VARCHAR(200),
          additional_skills JSON,
          custom_company VARCHAR(200),
          custom_position VARCHAR(200),
          input_source VARCHAR(50) DEFAULT 'interview_form',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
          INDEX idx_user_id (user_id),
          INDEX idx_session_id (session_id),
          INDEX idx_created_at (created_at),
          INDEX idx_input_source (input_source)
        )
      `);
    } catch (tableError) {
      console.warn('[DB] user_interview_conditions table already exists or creation failed:', tableError.message);
    }

    // 사용자 입력 조건을 DB에 저장
    try {
      const sessionId = `session_${Date.now()}_${user_id}`;
      const additionalSkillsJson = additional_preferences?.additional_skills && Array.isArray(additional_preferences.additional_skills)
        ? JSON.stringify(additional_preferences.additional_skills)
        : null;

      await pool.execute(`
        INSERT INTO user_interview_conditions
        (user_id, session_id, preferred_job, company_size, industry, additional_skills, input_source)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        user_id,
        sessionId,
        additional_preferences?.preferred_job || null,
        additional_preferences?.company_size || null,
        additional_preferences?.industry || null,
        additionalSkillsJson,
        'interview_form'
      ]);

      console.log(`[COMPANY-RECOMMENDATIONS] Saved user conditions to DB for user ${user_id}, session ${sessionId}`);
    } catch (saveError) {
      console.error('[COMPANY-RECOMMENDATIONS] Failed to save user conditions:', saveError);
    }

    // 사용자 프로필 조회
    const userQuery = `
      SELECT up.*, u.name as user_name
      FROM user_profiles up
      LEFT JOIN users u ON up.user_id = u.id
      WHERE up.user_id = ?
    `;

    const [userRows] = await pool.execute(userQuery, [user_id]);
    const userProfile = userRows.length > 0 ? userRows[0] : null;

    // 샘플 회사 추천 (추가정보에 따라 필터링)
    let allCompanies = [
      {
        name: "네이버",
        description: "국내 최대 포털 및 IT 서비스 기업",
        industry: "IT/소프트웨어",
        size: "대기업",
        location: "경기 성남",
        position: "프론트엔드 개발자"
      },
      {
        name: "카카오",
        description: "모바일 플랫폼 및 메신저 서비스 기업",
        industry: "IT/소프트웨어",
        size: "대기업",
        location: "제주",
        position: "프론트엔드 개발자"
      },
      {
        name: "라인",
        description: "글로벌 메신저 및 콘텐츠 플랫폼",
        industry: "IT/소프트웨어",
        size: "대기업",
        location: "경기 성남",
        position: "프론트엔드 개발자"
      },
      {
        name: "쿠팡",
        description: "이커머스 및 물류 서비스 기업",
        industry: "이커머스",
        size: "대기업",
        location: "서울 송파",
        position: "프론트엔드 개발자"
      },
      {
        name: "LG전자",
        description: "글로벌 가전 및 IT 기업",
        industry: "IT/전자",
        size: "대기업",
        location: "서울",
        position: "프론트엔드 개발자"
      },
      {
        name: "토스",
        description: "모바일 금융 서비스 핀테크 기업",
        industry: "핀테크",
        size: "중견기업",
        location: "서울 강남",
        position: "백엔드 개발자"
      },
      {
        name: "배달의민족",
        description: "국내 1위 음식 배달 플랫폼",
        industry: "플랫폼/O2O",
        size: "중견기업",
        location: "서울 송파",
        position: "풀스택 개발자"
      },
      {
        name: "삼성전자",
        description: "글로벌 전자기기 제조 기업",
        industry: "IT/전자",
        size: "대기업",
        location: "서울",
        position: "프론트엔드 개발자"
      },
      {
        name: "KB국민은행",
        description: "국내 1위 은행 금융 서비스",
        industry: "핀테크",
        size: "대기업",
        location: "서울",
        position: "백엔드 개발자"
      },
      {
        name: "신한은행",
        description: "금융 디지털 혁신 선도 은행",
        industry: "핀테크",
        size: "대기업",
        location: "서울",
        position: "백엔드 개발자"
      },
      {
        name: "케이뱅크",
        description: "인터넷 전문 은행",
        industry: "핀테크",
        size: "중견기업",
        location: "서울",
        position: "백엔드 개발자"
      },
      {
        name: "당근마켓",
        description: "지역 기반 중고거래 플랫폼",
        industry: "플랫폼/O2O",
        size: "중소기업",
        location: "서울",
        position: "백엔드 개발자"
      },
      {
        name: "직방",
        description: "부동산 중개 플랫폼",
        industry: "프롭테크",
        size: "중소기업",
        location: "서울",
        position: "프론트엔드 개발자"
      },
      {
        name: "야놀자",
        description: "숙박 및 레저 예약 플랫폼",
        industry: "여행/레저",
        size: "중견기업",
        location: "서울",
        position: "풀스택 개발자"
      },
      {
        name: "컬리",
        description: "신선식품 새벽배송 서비스",
        industry: "이커머스",
        size: "중소기업",
        location: "서울",
        position: "백엔드 개발자"
      },
      {
        name: "넥슨",
        description: "온라인 게임 개발 및 서비스",
        industry: "게임",
        size: "대기업",
        location: "경기 성남",
        position: "게임 서버 개발자"
      },
      {
        name: "크래프톤",
        description: "글로벌 게임 개발사",
        industry: "게임",
        size: "대기업",
        location: "경기 성남",
        position: "게임 개발자"
      },
      {
        name: "SK텔레콤",
        description: "국내 최대 통신사 및 AI 기업",
        industry: "통신/AI",
        size: "대기업",
        location: "서울",
        position: "데이터 분석가"
      },
      {
        name: "현대자동차",
        description: "글로벌 자동차 제조 및 모빌리티 기업",
        industry: "자동차/모빌리티",
        size: "대기업",
        location: "서울",
        position: "소프트웨어 엔지니어"
      },
      {
        name: "왓챠",
        description: "OTT 플랫폼 서비스",
        industry: "콘텐츠/미디어",
        size: "중소기업",
        location: "서울",
        position: "프론트엔드 개발자"
      },
      {
        name: "뱅크샐러드",
        description: "개인 금융 관리 핀테크",
        industry: "핀테크",
        size: "중소기업",
        location: "서울 강남",
        position: "데이터 엔지니어"
      },
      {
        name: "무신사",
        description: "패션 이커머스 플랫폼",
        industry: "이커머스",
        size: "중견기업",
        location: "서울",
        position: "풀스택 개발자"
      },
      {
        name: "하이퍼커넥트",
        description: "소셜 디스커버리 앱 개발사",
        industry: "IT/소프트웨어",
        size: "중견기업",
        location: "서울",
        position: "머신러닝 엔지니어"
      },
      {
        name: "두나무",
        description: "업비트 운영 암호화폐 거래소",
        industry: "핀테크",
        size: "중견기업",
        location: "서울 강남",
        position: "백엔드 개발자"
      },
      {
        name: "마켓컬리",
        description: "신선식품 새벽배송 이커머스",
        industry: "이커머스",
        size: "중견기업",
        location: "서울",
        position: "데이터 사이언티스트"
      },
      {
        name: "우아한형제들",
        description: "배달의민족 운영사",
        industry: "플랫폼/O2O",
        size: "중견기업",
        location: "서울 송파",
        position: "DevOps 엔지니어"
      },
      {
        name: "NHN",
        description: "게임 및 IT 서비스 기업",
        industry: "IT/게임",
        size: "대기업",
        location: "경기 성남",
        position: "시스템 엔지니어"
      },
      {
        name: "스마일게이트",
        description: "크로스파이어 개발사",
        industry: "게임",
        size: "대기업",
        location: "경기 성남",
        position: "게임 클라이언트 개발자"
      },
      {
        name: "엔씨소프트",
        description: "리니지 개발사",
        industry: "게임",
        size: "대기업",
        location: "경기 성남",
        position: "게임 서버 개발자"
      },
      {
        name: "쏘카",
        description: "카셰어링 플랫폼",
        industry: "모빌리티",
        size: "중소기업",
        location: "서울",
        position: "풀스택 개발자"
      }
    ];

    // 사용자 선택 조건에 맞게 필터링
    console.log(`[COMPANY-RECOMMENDATIONS] Received additional_preferences:`, JSON.stringify(additional_preferences));
    let filteredCompanies = allCompanies;
    const appliedFilters = [];

    // 산업 필터링
    if (additional_preferences?.industry && additional_preferences.industry.trim() !== '') {
      const industryKeyword = additional_preferences.industry.toLowerCase();
      filteredCompanies = filteredCompanies.filter(company =>
        company.industry.toLowerCase().includes(industryKeyword)
      );
      appliedFilters.push(`산업: ${additional_preferences.industry}`);
      console.log(`[COMPANY-RECOMMENDATIONS] 산업 필터링 (${additional_preferences.industry}): ${filteredCompanies.length}개`);
    }

    // 기업 규모 필터링
    if (additional_preferences?.company_size && additional_preferences.company_size.trim() !== '') {
      const sizeKeyword = additional_preferences.company_size;
      filteredCompanies = filteredCompanies.filter(company =>
        company.size === sizeKeyword
      );
      appliedFilters.push(`규모: ${additional_preferences.company_size}`);
      console.log(`[COMPANY-RECOMMENDATIONS] 규모 필터링 (${additional_preferences.company_size}): ${filteredCompanies.length}개`);
    }

    // 희망 직무 필터링
    if (additional_preferences?.preferred_job && additional_preferences.preferred_job.trim() !== '') {
      const jobKeyword = additional_preferences.preferred_job.toLowerCase();
      filteredCompanies = filteredCompanies.filter(company => {
        const position = company.position.toLowerCase();
        const description = company.description.toLowerCase();

        // "프론트엔드", "백엔드", "풀스택", "게임" 등의 키워드 매칭
        return position.includes(jobKeyword) || description.includes(jobKeyword);
      });
      appliedFilters.push(`직무: ${additional_preferences.preferred_job}`);
      console.log(`[COMPANY-RECOMMENDATIONS] 직무 필터링 (${additional_preferences.preferred_job}): ${filteredCompanies.length}개`);
    }

    // 추가 기술/스킬 필터링 (설명에 키워드가 포함되어 있으면 우선순위)
    if (additional_preferences?.additional_skills && Array.isArray(additional_preferences.additional_skills) && additional_preferences.additional_skills.length > 0) {
      const skills = additional_preferences.additional_skills.map(s => s.toLowerCase());

      // 스킬이 있는 회사에 가중치 부여 (완전 필터링하지 않고 우선순위만)
      filteredCompanies = filteredCompanies.map(company => {
        const matchCount = skills.filter(skill =>
          company.description.toLowerCase().includes(skill) ||
          company.industry.toLowerCase().includes(skill)
        ).length;
        return { ...company, skillMatchScore: matchCount };
      }).sort((a, b) => b.skillMatchScore - a.skillMatchScore);

      appliedFilters.push(`기술: ${additional_preferences.additional_skills.join(', ')}`);
      console.log(`[COMPANY-RECOMMENDATIONS] 기술 스킬 우선순위 정렬 완료`);
    }

    // 필터링 결과만 반환 (추가 회사 채우지 않음)
    console.log(`[COMPANY-RECOMMENDATIONS] 최종 결과: ${filteredCompanies.length}개`);

    // skillMatchScore 제거 (응답에서 제외)
    const cleanedCompanies = filteredCompanies.map(({ skillMatchScore, ...company }) => company);

    return res.json({
      success: true,
      companies: cleanedCompanies,
      filters_applied: appliedFilters,
      filter_details: {
        industry: additional_preferences?.industry || '없음',
        company_size: additional_preferences?.company_size || '없음',
        preferred_job: additional_preferences?.preferred_job || '없음',
        additional_skills: additional_preferences?.additional_skills || []
      },
      total_filtered: cleanedCompanies.length,
      powered_by: "Sample Data (MCP Fallback)",
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('[COMPANY-RECOMMENDATIONS] Failed:', error);
    return res.status(500).json({
      error: '회사 추천에 실패했습니다'
    });
  }
});

/**
 * @swagger
 * /api/user-data/{user_id}:
 *   get:
 *     summary: 사용자 데이터베이스 저장 정보 조회
 *     description: 로그인된 사용자의 데이터베이스 저장 정보를 상세히 조회합니다
 *     tags:
 *       - 사용자 데이터 디버깅
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 사용자 ID
 *     responses:
 *       200:
 *         description: 사용자 데이터 조회 성공
 *       404:
 *         description: 사용자를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
app.get('/api/user-data/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;

    console.log(`[USER-DATA] 사용자 ID ${user_id}의 DB 저장 정보 조회 중...`);

    // 사용자 기본 정보 조회
    const userQuery = `
      SELECT
        id,
        provider_key,
        email,
        name,
        picture,
        provider,
        created_at,
        updated_at
      FROM users
      WHERE id = ?
    `;

    const [userResult] = await pool.execute(userQuery, [user_id]);

    if (userResult.length === 0) {
      return res.status(404).json({
        error: '사용자를 찾을 수 없습니다',
        user_id: user_id
      });
    }

    const userData = userResult[0];

    // 사용자 프로필 정보 조회
    const profileQuery = `
      SELECT
        id,
        user_id,
        skills,
        experience,
        preferred_regions,
        preferred_jobs,
        expected_salary,
        resume_path,
        created_at,
        updated_at
      FROM user_profiles
      WHERE user_id = ?
    `;

    const [profileResult] = await pool.execute(profileQuery, [user_id]);

    // JSON 필드 파싱 (안전한 파싱)
    let profileData = null;
    if (profileResult.length > 0) {
      profileData = profileResult[0];

      // skills 필드 파싱
      if (profileData.skills) {
        try {
          profileData.skills_parsed = JSON.parse(profileData.skills);
        } catch (e) {
          profileData.skills_parsed = profileData.skills;
          profileData.skills_parse_error = e.message;
        }
      }

      // preferred_regions 필드 파싱
      if (profileData.preferred_regions) {
        try {
          if (typeof profileData.preferred_regions === 'string') {
            if (profileData.preferred_regions.startsWith('[')) {
              profileData.preferred_regions_parsed = JSON.parse(profileData.preferred_regions);
            } else {
              profileData.preferred_regions_parsed = profileData.preferred_regions.split(',').map(s => s.trim());
            }
          } else {
            profileData.preferred_regions_parsed = profileData.preferred_regions;
          }
        } catch (e) {
          profileData.preferred_regions_parsed = profileData.preferred_regions;
          profileData.preferred_regions_parse_error = e.message;
        }
      }
    }

    // 최근 추천 로그 조회 (최근 5개)
    const recommendationQuery = `
      SELECT
        id,
        job_id,
        recommendation_score,
        match_reasons,
        created_at
      FROM recommendation_logs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 5
    `;

    const [recommendationResult] = await pool.execute(recommendationQuery, [user_id]);

    // 최근 면접 질문 로그 조회 (최근 3개)
    const interviewQuery = `
      SELECT
        id,
        job_id,
        questions,
        created_at
      FROM interview_logs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 3
    `;

    const [interviewResult] = await pool.execute(interviewQuery, [user_id]);

    const response = {
      success: true,
      user_id: parseInt(user_id),
      data: {
        // 사용자 기본 정보
        user_info: {
          raw_data: userData,
          data_types: {
            id: typeof userData.id,
            provider_key: typeof userData.provider_key,
            email: typeof userData.email,
            name: typeof userData.name,
            picture: typeof userData.picture,
            provider: typeof userData.provider,
            created_at: typeof userData.created_at,
            updated_at: typeof userData.updated_at
          }
        },

        // 사용자 프로필 정보
        profile_info: profileData ? {
          raw_data: profileData,
          data_types: {
            skills: typeof profileData.skills,
            experience: typeof profileData.experience,
            preferred_regions: typeof profileData.preferred_regions,
            preferred_jobs: typeof profileData.preferred_jobs,
            expected_salary: typeof profileData.expected_salary,
            resume_path: typeof profileData.resume_path
          },
          parsed_data: {
            skills: profileData.skills_parsed,
            preferred_regions: profileData.preferred_regions_parsed
          },
          parsing_info: {
            skills_original: profileData.skills,
            preferred_regions_original: profileData.preferred_regions,
            skills_parse_error: profileData.skills_parse_error,
            preferred_regions_parse_error: profileData.preferred_regions_parse_error
          }
        } : null,

        // 최근 활동 로그
        recent_activity: {
          recommendations: recommendationResult,
          interviews: interviewResult
        },

        // 데이터 요약
        summary: {
          has_profile: profileData !== null,
          profile_completeness: profileData ? {
            has_skills: !!profileData.skills,
            has_experience: !!profileData.experience,
            has_preferred_regions: !!profileData.preferred_regions,
            has_preferred_jobs: !!profileData.preferred_jobs,
            has_expected_salary: !!profileData.expected_salary,
            has_resume: !!profileData.resume_path
          } : null,
          total_recommendations: recommendationResult.length,
          total_interviews: interviewResult.length
        }
      },
      debug_info: {
        database_connection: 'MySQL pool',
        query_timestamp: new Date().toISOString(),
        queries_executed: [
          'users 테이블 조회',
          'user_profiles 테이블 조회',
          'recommendation_logs 테이블 조회',
          'interview_logs 테이블 조회'
        ]
      }
    };

    console.log(`[USER-DATA] 사용자 ID ${user_id} 데이터 조회 완료:`, {
      has_user: !!userData,
      has_profile: !!profileData,
      recommendations_count: recommendationResult.length,
      interviews_count: interviewResult.length
    });

    return res.json(response);

  } catch (error) {
    console.error('[USER-DATA] 사용자 데이터 조회 실패:', error);
    return res.status(500).json({
      error: '사용자 데이터 조회에 실패했습니다',
      error_details: error.message
    });
  }
});

// 🔄 동적 사용자 데이터 로테이션 엔드포인트 (테스트용)
app.post('/api/rotate-user-data', async (req, res) => {
  try {
    console.log('[ROTATE] 사용자 데이터 로테이션 시작');

    // 다양한 테스트 프로필 데이터
    const testProfiles = [
      {
        name: '김신입', email: 'test1@example.com', provider: 'google',
        skills: ['JavaScript', 'React', 'Node.js'], experience: '신입',
        preferred_regions: ['서울'], preferred_jobs: 'IT', expected_salary: 3500
      },
      {
        name: '이경력', email: 'test2@example.com', provider: 'kakao',
        skills: ['Python', 'Django', 'PostgreSQL'], experience: '경력 3-5년',
        preferred_regions: ['경기'], preferred_jobs: 'IT', expected_salary: 6000
      },
      {
        name: '박시니어', email: 'test3@example.com', provider: 'google',
        skills: ['Java', 'Spring Boot', 'AWS', 'Docker'], experience: '경력 5년 이상',
        preferred_regions: ['서울', '경기'], preferred_jobs: 'IT', expected_salary: 8000
      },
      {
        name: '최데이터', email: 'test4@example.com', provider: 'kakao',
        skills: ['Python', 'TensorFlow', 'SQL', 'Spark'], experience: '경력 1-3년',
        preferred_regions: ['서울'], preferred_jobs: '빅데이터', expected_salary: 5500
      },
      {
        name: '정프론트', email: 'test5@example.com', provider: 'google',
        skills: ['TypeScript', 'Vue.js', 'CSS', 'Figma'], experience: '경력 1-3년',
        preferred_regions: ['서울'], preferred_jobs: 'IT', expected_salary: 4500
      },
      {
        name: '강풀스택', email: 'test6@example.com', provider: 'kakao',
        skills: ['React', 'Node.js', 'MongoDB', 'AWS'], experience: '경력 3-5년',
        preferred_regions: ['부산'], preferred_jobs: 'IT', expected_salary: 5800
      },
      {
        name: '윤모바일', email: 'test7@example.com', provider: 'google',
        skills: ['Swift', 'Kotlin', 'React Native', 'Firebase'], experience: '경력 1-3년',
        preferred_regions: ['서울'], preferred_jobs: 'IT', expected_salary: 5200
      },
      {
        name: '조인프라', email: 'test8@example.com', provider: 'kakao',
        skills: ['Kubernetes', 'Terraform', 'Jenkins', 'Linux'], experience: '경력 5년 이상',
        preferred_regions: ['서울'], preferred_jobs: 'IT', expected_salary: 7500
      }
    ];

    // 현재 시간 기반으로 프로필 선택 (매번 다른 프로필 사용)
    const profileIndex = Math.floor(Date.now() / 10000) % testProfiles.length;
    const selectedProfile = testProfiles[profileIndex];

    // 사용자 ID 1, 2의 기본 정보 업데이트
    const userIds = [1, 2];
    const updatedUsers = [];

    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      const profile = testProfiles[(profileIndex + i) % testProfiles.length];

      // 사용자 기본 정보 업데이트
      await pool.execute(
        `UPDATE users SET name = ?, email = ?, provider = ?, updated_at = NOW() WHERE id = ?`,
        [profile.name, profile.email, profile.provider, userId]
      );

      // 기존 프로필 삭제 (중복 제거)
      await pool.execute(
        `DELETE FROM user_profiles WHERE user_id = ?`,
        [userId]
      );

      // 새 프로필 추가
      await pool.execute(
        `INSERT INTO user_profiles (user_id, skills, experience, preferred_regions, preferred_jobs, expected_salary, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          userId,
          JSON.stringify(profile.skills),
          profile.experience,
          JSON.stringify(profile.preferred_regions),
          profile.preferred_jobs,
          profile.expected_salary
        ]
      );

      updatedUsers.push({
        id: userId,
        ...profile
      });
    }

    console.log(`[ROTATE] 데이터 로테이션 완료. 선택된 프로필 인덱스: ${profileIndex}`);

    res.json({
      success: true,
      message: '사용자 데이터가 성공적으로 로테이션되었습니다',
      rotation_info: {
        profile_index: profileIndex,
        total_profiles: testProfiles.length,
        rotation_method: '시간 기반 자동 로테이션'
      },
      updated_users: updatedUsers,
      next_rotation_in: `약 ${10 - (Math.floor(Date.now() / 1000) % 10)}초 후`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ROTATE] 데이터 로테이션 실패:', error);
    res.status(500).json({
      success: false,
      error: '데이터 로테이션에 실패했습니다',
      error_details: error.message
    });
  }
});

// 🔄 수동 프로필 선택 엔드포인트
app.post('/api/set-test-profile/:profileIndex', async (req, res) => {
  try {
    const { profileIndex } = req.params;
    const index = parseInt(profileIndex);

    // 테스트 프로필 데이터 (위와 동일)
    const testProfiles = [
      {
        name: '김신입', email: 'test1@example.com', provider: 'google',
        skills: ['JavaScript', 'React', 'Node.js'], experience: '신입',
        preferred_regions: ['서울'], preferred_jobs: 'IT', expected_salary: 3500
      },
      {
        name: '이경력', email: 'test2@example.com', provider: 'kakao',
        skills: ['Python', 'Django', 'PostgreSQL'], experience: '경력 3-5년',
        preferred_regions: ['경기'], preferred_jobs: 'IT', expected_salary: 6000
      },
      {
        name: '박시니어', email: 'test3@example.com', provider: 'google',
        skills: ['Java', 'Spring Boot', 'AWS', 'Docker'], experience: '경력 5년 이상',
        preferred_regions: ['서울', '경기'], preferred_jobs: 'IT', expected_salary: 8000
      },
      {
        name: '최데이터', email: 'test4@example.com', provider: 'kakao',
        skills: ['Python', 'TensorFlow', 'SQL', 'Spark'], experience: '경력 1-3년',
        preferred_regions: ['서울'], preferred_jobs: '빅데이터', expected_salary: 5500
      },
      {
        name: '정프론트', email: 'test5@example.com', provider: 'google',
        skills: ['TypeScript', 'Vue.js', 'CSS', 'Figma'], experience: '경력 1-3년',
        preferred_regions: ['서울'], preferred_jobs: 'IT', expected_salary: 4500
      },
      {
        name: '강풀스택', email: 'test6@example.com', provider: 'kakao',
        skills: ['React', 'Node.js', 'MongoDB', 'AWS'], experience: '경력 3-5년',
        preferred_regions: ['부산'], preferred_jobs: 'IT', expected_salary: 5800
      },
      {
        name: '윤모바일', email: 'test7@example.com', provider: 'google',
        skills: ['Swift', 'Kotlin', 'React Native', 'Firebase'], experience: '경력 1-3년',
        preferred_regions: ['서울'], preferred_jobs: 'IT', expected_salary: 5200
      },
      {
        name: '조인프라', email: 'test8@example.com', provider: 'kakao',
        skills: ['Kubernetes', 'Terraform', 'Jenkins', 'Linux'], experience: '경력 5년 이상',
        preferred_regions: ['서울'], preferred_jobs: 'IT', expected_salary: 7500
      }
    ];

    if (index < 0 || index >= testProfiles.length) {
      return res.status(400).json({
        success: false,
        error: `프로필 인덱스는 0-${testProfiles.length - 1} 범위여야 합니다`
      });
    }

    const selectedProfile = testProfiles[index];

    // 사용자 ID 1에만 적용
    await pool.execute(
      `UPDATE users SET name = ?, email = ?, provider = ?, updated_at = NOW() WHERE id = 1`,
      [selectedProfile.name, selectedProfile.email, selectedProfile.provider]
    );

    // 기존 프로필 삭제
    await pool.execute(`DELETE FROM user_profiles WHERE user_id = 1`);

    // 새 프로필 추가
    await pool.execute(
      `INSERT INTO user_profiles (user_id, skills, experience, preferred_regions, preferred_jobs, expected_salary, created_at, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        JSON.stringify(selectedProfile.skills),
        selectedProfile.experience,
        JSON.stringify(selectedProfile.preferred_regions),
        selectedProfile.preferred_jobs,
        selectedProfile.expected_salary
      ]
    );

    console.log(`[SET-PROFILE] 사용자 1에 프로필 ${index} (${selectedProfile.name}) 적용 완료`);

    res.json({
      success: true,
      message: `프로필 ${index}가 사용자 1에 적용되었습니다`,
      applied_profile: {
        index: index,
        ...selectedProfile
      },
      available_profiles: testProfiles.map((p, i) => ({
        index: i,
        name: p.name,
        skills: p.skills,
        experience: p.experience,
        job_type: p.preferred_jobs
      }))
    });

  } catch (error) {
    console.error('[SET-PROFILE] 프로필 설정 실패:', error);
    res.status(500).json({
      success: false,
      error: '프로필 설정에 실패했습니다',
      error_details: error.message
    });
  }
});

// 테스트 엔드포인트
app.get('/api/test-endpoint', (req, res) => {
  res.json({ message: 'Endpoint registered successfully!' });
});

// ==== 404 핸들러 (마지막) ====
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.originalUrl });
});

// Export for Vercel Serverless Functions
export default app;

// 변경: IPv4 로컬호스트에 확실히 바인딩
// --- listen (이미 위에서 조건부로 실행됨)
