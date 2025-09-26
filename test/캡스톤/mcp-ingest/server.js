import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { htmlToText } from "html-to-text";
import multer from "multer";
//import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import fs from "fs";
import path from "path";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 4001);

// 프로필 업로드용 (디스크)
const resumeDir = path.join(process.cwd(), 'uploads', 'resume');
fs.mkdirSync(resumeDir, { recursive: true });

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, resumeDir),
  filename: (req, file, cb) => {
    const userId = req.body.user_id || 'unknown';
    const ext = path.extname(file.originalname || '.pdf');
    cb(null, `${userId}_${Date.now()}${ext}`);
  },
});
const uploadProfile = multer({ storage: diskStorage });

// 세션 인제스트(데이터 수집)용 (메모리)
const uploadMem = multer({ storage: multer.memoryStorage() });

/* ---------------- 유틸: 정규화 (LLM 자리에 임시 규칙/템플릿) -------- */
// 실제론 OpenAI 등 호출. 지금은 입력 텍스트에서 매우 단순 추출/더미 매핑.
function naiveNormalize(text) {
  const t = text.slice(0, 8000); // 과도한 길이 컷
  // 더미 규칙: 제목, 회사 키워드 추출 시도
  const title = (t.match(/(백엔드|프론트엔드|데이터).*개발자/) || [])[0] || "채용 공고";
  const company = (t.match(/회사명[:\s]*([\w가-힣()·& ]{2,30})/) || [])[1] || "회사명 미상";
  return {
    title,
    company,
    region: null,
    years_min: null,
    years_max: null,
    skills: null,
    employment_type: null,
    work_mode: null,
    salary_text: null,
    posted_at: null,
    deadline: null,
    description: t.slice(0, 500)
  };
}

/* ---------------- 1) 텍스트 정규화 ---------------- */
app.post("/tools/normalize_text", async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: "NO_TEXT" });
    const normalizedJob = naiveNormalize(text);
    return res.json({ normalizedJob });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/* ---------------- 2) URL → fetch → html→text → 정규화 -------------- */
app.post("/tools/fetch_url_and_normalize", async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: "NO_URL" });

    const r = await axios.get(url, { timeout: 10000, headers: { "User-Agent": "capstone-ingest/1.0" } });
    const text = htmlToText(r.data ?? "", { wordwrap: false });
    const normalizedJob = naiveNormalize(text);

    return res.json({ normalizedJob, rawMeta: { source_url: url } });
  } catch (e) {
    console.error(e?.response?.status, e?.message);
    res.status(500).json({ error: "FETCH_OR_PARSE_FAILED" });
  }
});

/* ---------------- 3) 파일 → 텍스트 추출 → 정규화 ------------------- */
app.post("/tools/extract_file_and_normalize", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "NO_FILE" });

    const { mimetype, path: filePath, originalname } = req.file;
    let text = "";

    if (mimetype === "application/pdf") {
      //const buf = await fs.readFile(filePath);
      //const data = await pdfParse(buf);
      //text = data.text || "";
    } else if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const buf = await fs.readFile(filePath);
      const { value } = await mammoth.extractRawText({ buffer: buf });
      text = value || "";
    } else if (mimetype.startsWith("text/") || originalname.toLowerCase().endsWith(".txt")) {
      text = (await fs.readFile(filePath)).toString("utf8");
    } else if (mimetype === "text/html" || originalname.toLowerCase().endsWith(".html")) {
      const html = (await fs.readFile(filePath)).toString("utf8");
      text = htmlToText(html, { wordwrap: false });
    } else {
      return res.status(415).json({ error: "UNSUPPORTED_TYPE" });
    }

    const normalizedJob = naiveNormalize(text);
    return res.json({ normalizedJob, rawMeta: { filename: originalname } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "EXTRACT_FAILED" });
  } finally {
    // 임시 파일 정리
    if (req.file?.path) fs.unlink(req.file.path).catch(() => {});
  }
});

app.listen(PORT, () => console.log(`[mcp-ingest] http://localhost:${PORT}`));
