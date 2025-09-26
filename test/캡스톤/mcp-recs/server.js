// mcp-recs/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
//import OpenAI from "openai";
import axios from "axios";


dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 4000);

console.log("OPENAI_KEY_LOADED:", !!process.env.OPENAI_API_KEY);

/* ================== OpenAI 클라이언트 ================== */
// SDK가 env를 읽지 못하도록 강제 클리어 (API 키만 사용)
/*process.env.OPENAI_ORGANIZATION = "";
process.env.OPENAI_PROJECT = "";
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null; // 키 없으면 null → 아래 라우트에서 더미 폴백
console.log("OPENAI_CLIENT_READY:", !!openai);
console.log("OPENAI_KEY?", !!process.env.OPENAI_API_KEY);
console.log("OPENAI_ORG_ID:", process.env.OPENAI_ORG_ID);
console.log("OPENAI_PROJECT:", process.env.OPENAI_PROJECT);*/

/* ================== 개인화 보정 저장소 ================== */
// sessionId -> { skills: Map<string, number>, companies: Map<string, number> }
const userProfiles = new Map();
function ensureProfile(sessionId) {
  if (!sessionId) return null;
  if (!userProfiles.has(sessionId)) {
    userProfiles.set(sessionId, { skills: new Map(), companies: new Map() });
  }
  return userProfiles.get(sessionId);
}

/* ================== 유틸(코사인, 더미 질문) ================== */
function cosineSim(a, b) {
  const n = Math.min(a.length, b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < n; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
function dummyInterview({ user, job, company }) {
  const techStack = (job?.skills || user?.skills || []).slice(0, 3).join(", ") || "핵심 기술";
  const companyName = company?.name || job?.company || "지원 기업";
  const role = user?.role || job?.title || "지원 직무";
  const questions = [
    { q: `자기소개를 1분 이내로 해주세요.`, why: `커뮤니케이션과 핵심 요약 능력을 평가` },
    { q: `${role} 역할에 지원한 동기를 말씀해주세요.`, why: `직무 적합성과 동기 파악` },
    { q: `최근에 ${techStack} 관련해서 해결한 문제 하나를 상세히 설명해주세요.`, why: `문제해결/구현 역량 확인` },
    { q: `팀에서 갈등이 있었던 경험과 해결 과정을 설명해주세요.`, why: `협업/조율 능력 평가` },
    { q: `${companyName}의 제품/서비스 중 개선하고 싶은 점은 무엇인가요?`, why: `회사 이해도와 비판적 사고` },
  ];
  return {
    ok: true,
    tech_questions: [questions[2]],
    behavioral: [questions[0], questions[3]],
    company_specific: [questions[1], questions[4]],
    model_answers: [{ for: questions[2].q, outline: "문제상황→접근→기술선택이유→구현→테스트→회고" }],
    followups: [{ for: questions[2].q, ask: "해결 과정에서 가장 어려웠던 구체적 이슈는?" }]
  };
}

/* ================== 1) 면접 질문 생성 (OpenAI) ================== */
// 없으면 더미로 폴백. 프론트는 동일하게 사용 가능.
app.post("/tools/generate_interview", async (req, res) => {
  console.log("[IV] req in");

  const { user, job, company } = req.body || {};
  const role = user?.role || job?.title || "지원 직무";
  const skills = (job?.skills || user?.skills || []).slice(0, 8).join(", ") || "N/A";
  const companyName = company?.name || job?.company || "지원 기업";

  // 키 없으면 더미로
  if (!openai) {
    console.log("[IV] no openai → dummy");
    return res.json({ source: "dummy", ...dummyInterview({ user, job, company }) });
  }

  try {
    const prompt = `
당신은 엄격하지만 공정한 기술 면접관입니다.
아래 정보를 기반으로 질문을 만들어 주세요.

[지원 정보]
- 직무: ${role}
- 보유 기술: ${skills}
- 회사: ${companyName}

[요구 사항]
- 기술 질문 2개(각 질문에 "이유" 포함)
- 인성 질문 2개(각 질문에 "이유" 포함)
- 회사 특화 질문 1개(각 질문에 "이유" 포함)
- JSON만 반환:
{
  "tech_questions":[{"q":"...", "why":"..."}, {"q":"...", "why":"..."}],
  "behavioral":[{"q":"...", "why":"..."}, {"q":"...", "why":"..."}],
  "company_specific":[{"q":"...", "why":"..."}]
}
    `.trim();

    // ★ SDK 대신 axios 사용
    const { data: resp } = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-5 nano",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a JSON API. Return ONLY a valid JSON object that matches the schema described by the user." },
          { role: "user", content: prompt }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 25000
      }
    );

    // axios 응답에서 content 추출
    let text = (resp?.choices?.[0]?.message?.content ?? "{}").trim();
    console.log("[IV] raw len:", text.length);

    // 코드블록 마크다운 방지
    if (text.startsWith("```")) text = text.replace(/```json|```/g, "").trim();

    // 디버그 모드: 파싱 전 원문 확인
    if (String(req.query.debug) === "1") {
      console.log("[IV] debug raw:", text);
      return res.json({ ok: true, source: "gpt_raw", raw: text });
    }

    // JSON 파싱 (★ 한 번만 선언)
    const parsed = JSON.parse(text);
    console.log("[IV] parsed OK");

    return res.json({
      ok: true,
      source: "gpt",
      tech_questions: parsed.tech_questions || [],
      behavioral: parsed.behavioral || [],
      company_specific: parsed.company_specific || [],
      model_answers: [],
      followups: []
    });

  } catch (e) {
    console.error("[IV] FAIL:", e.response?.data || e.message);
    return res.json({ source: "dummy", ...dummyInterview({ user, job, company }) });
  }
});


/* ================== 2) 임베딩 생성 ================== */
// 지금은 더미 → 추후 OpenAI Embeddings로 교체 가능
// 모델 예: text-embedding-3-small (저비용)
app.post("/tools/embed_text", async (req, res) => {
  const { text, hint } = req.body || {};
  if (!text) return res.status(400).json({ error: "NO_TEXT" });

  // 키 없으면 더미 벡터
  if (!openai) {
    const vec = new Array(64).fill(0).map((_, i) => ((text.charCodeAt(i % text.length) || 0) % 31) / 31);
    return res.json({ vector: vec, hint: hint || null, model: "dummy" });
  }

  try {
    const resp = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text
    });
    return res.json({ vector: resp.data[0].embedding, hint: hint || null, model: "text-embedding-3-small" });
  } catch (e) {
    console.error("EMBED_FAILED", e.response?.data || e.message);
    // 폴백: 더미
    const vec = new Array(64).fill(0).map((_, i) => ((text.charCodeAt(i % text.length) || 0) % 31) / 31);
    return res.json({ vector: vec, hint: hint || null, model: "dummy" });
  }
});

/* ================== 3) 피드백(개인화 보정 저장) ================== */
// body: { sessionId, type: "save"|"hide"|"like", target: { skill?, company? } }
app.post("/tools/feedback", (req, res) => {
  const { sessionId, type, target } = req.body || {};
  if (!sessionId || !type || !target) {
    return res.status(400).json({ error: "MISSING_FIELDS" });
  }
  const profile = ensureProfile(sessionId);
  if (!profile) return res.status(400).json({ error: "NO_SESSION" });

  if (type === "save" || type === "like") {
    if (target.skill) {
      const key = String(target.skill).toLowerCase();
      const prev = profile.skills.get(key) || 0;
      profile.skills.set(key, Math.min(prev + 0.05, 0.5)); // 상한 0.5
    }
    if (target.company) {
      const prev = profile.companies.get(target.company) || 0;
      profile.companies.set(target.company, Math.min(prev + 0.05, 0.5));
    }
  } else if (type === "hide") {
    if (target.company) {
      const prev = profile.companies.get(target.company) || 0;
      profile.companies.set(target.company, Math.max(prev - 0.05, -0.5)); // 하한 -0.5
    }
  }

  return res.json({
    ok: true,
    boosts: {
      skills: Object.fromEntries(profile.skills),
      companies: Object.fromEntries(profile.companies),
    }
  });
});

/* ================== 4) 재랭크(보정 반영) ================== */
// body: { user, candidates: [{ job_id, company_id, skills[], score_v1, region, years_* }], topK, sessionId }
app.post("/tools/rerank_jobs", (req, res) => {
  const { user, candidates = [], topK = 20, sessionId } = req.body || {};
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return res.status(400).json({ error: "NO_CANDIDATES" });
  }

  const profile = sessionId ? ensureProfile(sessionId) : null;

  // 보정치 계산
  function boostFor(candidate) {
    let b = 0;
    if (!profile) return b;

    // 회사 보정
    if (candidate.company_id && profile.companies.has(candidate.company_id)) {
      b += profile.companies.get(candidate.company_id);
    }
    // 스킬 보정 (가장 큰 스킬 보정 하나만 반영: 단순 MVP)
    if (Array.isArray(candidate.skills)) {
      let best = 0;
      for (const s of candidate.skills) {
        const v = profile.skills.get(String(s).toLowerCase()) || 0;
        if (v > best) best = v;
      }
      b += best;
    }
    return b;
  }

  const ranked = candidates
    .map(c => {
      const b = boostFor(c);
      const finalScore = Number((c.score_v1 + b).toFixed(4));
      const reason = [
        (b > 0 ? "개인화 보정 +" + b.toFixed(2) : null),
        (c.skills?.length ? `스킬: ${c.skills.slice(0,3).join(", ")}` : null),
        (c.region ? `지역: ${c.region}` : null),
      ].filter(Boolean).join(" · ");
      return { job_id: c.job_id, finalScore, reason };
    })
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, Math.min(topK, candidates.length));

  return res.json({ ranked });
});

app.get("/health", (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

app.get("/_diag", (req, res) => {
  res.json({
    openaiReady: !!openai,
    hasKey: !!process.env.OPENAI_API_KEY,
    org: process.env.OPENAI_ORGANIZATION || null,
    project: process.env.OPENAI_PROJECT || null,
  });
});

/* ================== 서버 시작 ================== */
app.listen(PORT, () => {
  console.log(`mcp-recs on http://localhost:${PORT}`);
});
