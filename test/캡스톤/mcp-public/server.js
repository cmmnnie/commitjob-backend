import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 4003);

/* ----------- 1) 워크넷 동기화(샘플 골격) ---------------- */
app.post("/tools/sync_worknet", async (req, res) => {
  try {
    const days = Number(req.body?.days || 7);
    const key = process.env.WORKNET_API_KEY;
    if (!key) return res.status(400).json({ error: "NO_API_KEY" });

    // TODO: 실제 엔드포인트/파라미터 맵핑
    // 예시: 최근 N일 채용 목록 페이징 루프 → 상세 → 정규화(JSON) → backend DB upsert 호출
    let inserted = 0, updated = 0, skipped = 0;

    // const listUrl = `https://apis.data.go.kr/.../getJobList?serviceKey=${key}&startDate=...`;
    // const list = await axios.get(listUrl);
    // for (const item of list.data.items) {
    //   const detail = await axios.get(`...getJobInfo?...jobId=${item.id}&serviceKey=${key}`);
    //   // normalized = normalize(detail)
    //   // await axios.post(`${process.env.BACKEND_BASE}/internal/jobs/upsert`, normalized, { headers: { 'Authorization': `Bearer ${process.env.INTERNAL_TOKEN}` } })
    //   inserted++;
    // }

    // 데모 응답
    return res.json({ ok: true, inserted, updated, skipped });
  } catch (e) {
    console.error(e?.response?.status, e?.message);
    res.status(500).json({ error: "SYNC_FAILED" });
  }
});

app.listen(PORT, () => console.log(`[mcp-public] http://localhost:${PORT}`));
