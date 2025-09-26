 import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Capstone Chatbot UI — Premium v3
 * - Premium palette (deep navy + champagne gold)
 * - Glass cards, softer shadows, 3xl radius
 * - Sticky header with brand lockup
 * - Avatars, timestamps, refined typography
 * - Tailwind only
 */

export default function ChatbotDemo() {
  const [messages, setMessages] = useState<Msg[]>(() => [
    botSystem("자소서/면접/채용 추천을 도와드릴게요. 자소서를 업로드하거나 빠른 액션으로 시작하세요."),
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [uploadName, setUploadName] = useState<string | null>(null);

  const quick = useMemo(
    () => [
      { icon: "🎯", label: "맞춤 공고", value: "내 프로필로 채용 추천" },
      { icon: "✍️", label: "자소서 보조", value: "이 경험으로 문단 3개 추천" },
      { icon: "🎤", label: "면접 질문", value: "백엔드 면접 질문 5개" },
    ],
    []
  );

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, isTyping]);
  function push(m: Msg) { setMessages((p) => [...p, m]); }

  function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (!content) return;
    push(userText(content));
    setInput("");
    if (/자소서|문단|경험/.test(content)) flowCoverletter();
    else if (/면접|질문/.test(content)) flowInterview();
    else flowJobs();
  }

  function flowCoverletter() {
    setIsTyping(true);
    streamText("자소서 문단을 구성 중입니다…", 14, () => {
      push(botSuggestion({
        title: "프로젝트 리드 경험",
        text: "Django 기반 API 성능 35% 개선, 코드리뷰 프로세스 도입으로 릴리즈 실패율 감소.",
        citations: [ { url: "https://example.com/jd/123", quote: "REST API 성능 최적화 우대", offset: [154,183] } ],
      }));
      setIsTyping(false);
    });
  }
  function flowInterview() {
    setIsTyping(true);
    streamText("직무 역량 기반으로 질문을 뽑는 중…", 14, () => {
      push(botQuestions([
        { q: "STAR 구조로 팀 갈등 조정 경험을 설명하세요.", refs: ["커뮤니케이션","리더십"] },
        { q: "트래픽 급증 시 API 안정성 확보 전략은?", refs: ["성능","장애 대응"] },
        { q: "MySQL 인덱스 튜닝 사례와 수치 결과?", refs: ["DB 최적화"] },
      ]));
      setIsTyping(false);
    });
  }
  function flowJobs() {
    setIsTyping(true);
    streamText("프로필과 조건에 맞는 공고를 수집하고 있어요…", 14, () => {
      push(botJobs([
        { title: "백엔드 엔지니어", company: "ABC테크", region: "서울", postedAt: "2025-08-26", matchScore: 0.84, skills: ["Java","Spring","MySQL","AWS"], sourceUrl: "https://company.example/jobs/abc", reasons: [ { type:"tech_overlap", value:["Spring","MySQL"] }, { type:"years_fit", value:"요구 1~3년, 사용자 2년" } ] },
        { title: "플랫폼 서버 개발자", company: "XYZ 금융", region: "경기", postedAt: "2025-08-25", matchScore: 0.78, skills: ["Node.js","Django","MySQL"], sourceUrl: "https://company.example/jobs/xyz", reasons: [ { type:"tech_overlap", value:["Node.js","MySQL"] } ] },
      ]));
      setIsTyping(false);
    });
  }

  function streamText(text: string, chunk: number, onDone: () => void) {
    const parts = chunkSplit(text, chunk);
    let i = 0;
    const id = setInterval(() => {
      if (i === 0) push(botText(parts[i])); else appendLastBotText(parts[i]);
      i++; if (i >= parts.length) { clearInterval(id); onDone(); }
    }, 100);
  }
  function appendLastBotText(extra: string) {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== "bot" || last.kind !== "text") return prev;
      const updated = { ...last, text: last.text + extra } as BotTextMsg;
      return [...prev.slice(0, -1), updated];
    });
  }
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setUploadName(f.name); push(userText(`자소서 업로드: ${f.name}`)); flowCoverletter();
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_70%_-10%,#eef2ff_10%,transparent),linear-gradient(to_bottom,#f9fafb,#f3f4f6)]">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/70 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <div className="font-semibold tracking-tight">캡스톤 취업 도우미</div>
            <span className="hidden sm:inline text-xs text-slate-500">Evidence‑first · Premium</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500"><StatusDot className="text-emerald-500"/> 실시간</div>
        </div>
      </div>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 grid lg:grid-cols-[260px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="rounded-3xl border border-slate-200/70 bg-white/70 backdrop-blur p-4 shadow-md">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">빠른 액션</div>
            <div className="mt-3 grid gap-2">
              {quick.map((q) => (
                <button key={q.label} onClick={() => handleSend(q.value)} className="group w-full text-left px-3 py-2 rounded-2xl border border-slate-200/70 bg-slate-50/70 hover:bg-white/80 hover:shadow-md transition">
                  <span className="mr-2">{q.icon}</span>
                  <span className="font-medium group-hover:text-[#8B6B00]">{q.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-4">
              <label className="block">
                <input type="file" className="hidden" onChange={handleFile} />
                <span className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#FFF8E6] text-[#8B6B00] hover:bg-[#FDEFC8] border border-[#F3D37A] cursor-pointer">
                  <PaperclipIcon className="w-4 h-4" /> 자소서 업로드
                </span>
              </label>
              {uploadName && <div className="mt-2 text-xs text-slate-500 truncate">{uploadName}</div>}
            </div>
          </div>
        </aside>

        {/* Chat column */}
        <section className="flex flex-col h-[calc(100dvh-110px)]">
          {messages.length <= 2 && (
            <div className="rounded-3xl border border-slate-200/70 bg-white/70 backdrop-blur p-5 shadow-md">
              <div className="flex items-start gap-3">
                <Avatar kind="bot" />
                <div>
                  <div className="font-semibold text-lg">무엇을 도와드릴까요?</div>
                  <p className="text-slate-600 text-sm">채용 추천, 자소서 문단 추천, 면접 질문 생성 중 하나로 시작할 수 있어요.</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 flex-1 overflow-y-auto pr-1">
            <div className="space-y-3">
              {messages.map((m, i) => (<ChatBubble key={i} msg={m} />))}
              {isTyping && <TypingBubble />}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Command bar */}
          <div className="mt-4">
            <div className="rounded-3xl border border-slate-200/70 bg-white/70 backdrop-blur shadow-md">
              <div className="px-3 pt-2 text-[11px] text-slate-500 flex items-center gap-2 border-b border-slate-200/60 pb-2">
                <StatusDot className="text-amber-500" /> 안전 모드 · 출처 필수 · 생성 실패 시 빈값 처리
              </div>
              <div className="p-2 flex items-center gap-2">
                <label className="cursor-pointer shrink-0">
                  <input type="file" className="hidden" onChange={handleFile} />
                  <span className="inline-flex items-center gap-2 px-2.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-sm">
                    <PaperclipIcon className="w-4 h-4" /> 파일
                  </span>
                </label>
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="메시지를 입력하거나, JD/자소서 내용을 붙여넣어 보세요…" className="flex-1 px-4 py-3 rounded-2xl bg-white/80 outline-none" />
                <button onClick={() => handleSend()} className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#0F172A] text-white hover:bg-[#0B1225] ring-1 ring-white/10">
                  <ArrowRightIcon className="w-4 h-4" /> 보내기
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

// ===== UI Pieces =====
function ChatBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[90%] md:max-w-[70%] ${isUser ? "" : "pl-1"}`}>
        <div className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
          <Avatar kind={isUser ? "user" : "bot"} />
          <div className={`rounded-3xl px-3 py-2 shadow-md border border-slate-200/70 ${isUser ? "bg-[#0F172A] text-white" : "bg-white/70 backdrop-blur text-slate-800"}`}>
            {msg.kind === "text" && <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>}
            {msg.kind === "system" && <p className="text-slate-600 text-sm">{msg.text}</p>}
            {msg.kind === "suggestion" && <SuggestionCard payload={msg.payload} />}
            {msg.kind === "joblist" && <JobList payload={msg.payload} />}
            {msg.kind === "questions" && <QuestionList payload={msg.payload} />}
          </div>
        </div>
        <div className={`mt-1 text-[11px] ${isUser ? "text-right" : "text-left"} text-slate-500`}>{timestamp()}</div>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="flex items-start gap-2">
        <Avatar kind="bot" />
        <div className="rounded-3xl px-3 py-2 border border-slate-200/70 bg-white/70 backdrop-blur shadow-md">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:120ms]" />
            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:240ms]" />
            <span className="text-xs text-slate-500 ml-2">생성 중…</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SuggestionCard({ payload }: { payload: SuggestionPayload }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-semibold">{payload.title}</div>
        <button onClick={() => setOpen((v) => !v)} className="text-xs px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200">{open ? "근거 숨기기" : "근거 보기"}</button>
      </div>
      <p className="leading-relaxed text-slate-800">{payload.text}</p>
      <div className="flex items-center gap-2">
        <button onClick={() => { navigator.clipboard.writeText(payload.text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 800); }); }} className="text-sm px-2 py-1 rounded-lg bg-[#0F172A] text-white hover:bg-[#0B1225]">복사</button>
        {copied && <span className="text-xs text-slate-500">복사됨</span>}
      </div>
      {open && (
        <div className="mt-1 border rounded-lg p-2 bg-slate-50/70">
          <div className="text-xs text-slate-500 mb-1">출처 / 근거</div>
          {payload.citations.map((c, i) => (
            <a key={i} href={c.url} target="_blank" className="block text-sm underline text-[#8B6B00]">
              “{c.quote}” <span className="text-slate-400">(offset {c.offset[0]}–{c.offset[1]})</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function JobList({ payload }: { payload: JobCardPayload[] }) {
  return (
    <div className="space-y-3">
      {payload.map((j, i) => (
        <div key={i} className="rounded-3xl border border-slate-200/70 p-4 bg-white/70 backdrop-blur shadow-md">
          <div className="flex items-center justify-between">
            <div className="font-medium">{j.title} · <span className="text-slate-600">{j.company}</span></div>
            <div className="text-sm">매칭 <span className="font-semibold">{Math.round(j.matchScore * 100)}%</span></div>
          </div>
          <div className="text-sm text-slate-600 mt-0.5">{j.region} • 게시일 {j.postedAt}</div>
          <div className="flex flex-wrap gap-1 mt-2">
            {j.skills.map((s) => (<span key={s} className="px-2 py-0.5 text-xs rounded-full bg-slate-50/80 border">{s}</span>))}
          </div>
          <div className="mt-2 text-xs text-slate-600">
            {j.reasons.map((r, idx) => (<span key={idx} className="mr-2">✓ {renderReason(r)}</span>))}
          </div>
          <div className="mt-2">
            <a href={j.sourceUrl} target="_blank" className="text-sm underline text-[#8B6B00]">원문 보기</a>
          </div>
        </div>
      ))}
    </div>
  );
}

function QuestionList({ payload }: { payload: QuestionPayload[] }) {
  return (
    <div className="space-y-2">
      {payload.map((q, i) => (
        <div key={i} className="rounded-3xl border border-slate-200/70 p-4 bg-white/70 backdrop-blur shadow-md">
          <div className="font-medium">Q{i + 1}. {q.q}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {q.refs.map((t) => (<span key={t} className="px-2 py-0.5 text-xs rounded-full bg-slate-50/80 border">{t}</span>))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Avatar({ kind }: { kind: "user" | "bot" }) {
  return (
    <div className={`w-8 h-8 rounded-full grid place-items-center shadow-md ${kind === "user" ? "bg-[#0F172A] text-white" : "bg-slate-900 text-white"}`}>
      {kind === "user" ? <UserIcon className="w-4 h-4" /> : <BotIcon className="w-4 h-4" />}
    </div>
  );
}

function Logo() {
  return (
    <div className="inline-flex items-center gap-2">
      <div className="w-6 h-6 rounded-lg bg-slate-900 grid place-items-center text-white"><BotIcon className="w-3.5 h-3.5" /></div>
      <div className="text-sm font-semibold tracking-tight">CAPSTONE</div>
      <div className="text-xs text-[#8B6B00] font-semibold">CAREER</div>
    </div>
  );
}

function StatusDot({ className = "text-emerald-500" }: { className?: string }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${className}`} />;
}

// ===== Types & helpers =====

type Role = "user" | "bot";

type Msg = BotTextMsg | BotSystemMsg | UserTextMsg | BotSuggestionMsg | BotJobListMsg | BotQuestionsMsg;

type BotTextMsg = { role: "bot"; kind: "text"; text: string };
type BotSystemMsg = { role: "bot"; kind: "system"; text: string };
type UserTextMsg = { role: "user"; kind: "text"; text: string };

type SuggestionPayload = { title: string; text: string; citations: { url: string; quote: string; offset: [number, number] }[] };

type JobCardPayload = { title: string; company: string; region: string; postedAt: string; matchScore: number; skills: string[]; sourceUrl: string; reasons: Reason[] };

type Reason = { type: "tech_overlap"; value: string[] } | { type: "years_fit"; value: string } | { type: "region"; value: string };

type QuestionPayload = { q: string; refs: string[] };

type BotSuggestionMsg = { role: "bot"; kind: "suggestion"; payload: SuggestionPayload };

type BotJobListMsg = { role: "bot"; kind: "joblist"; payload: JobCardPayload[] };

type BotQuestionsMsg = { role: "bot"; kind: "questions"; payload: QuestionPayload[] };

function botText(text: string): BotTextMsg { return { role: "bot", kind: "text", text }; }
function botSystem(text: string): BotSystemMsg { return { role: "bot", kind: "system", text }; }
function userText(text: string): UserTextMsg { return { role: "user", kind: "text", text }; }
function botSuggestion(payload: SuggestionPayload): BotSuggestionMsg { return { role: "bot", kind: "suggestion", payload }; }
function botJobs(payload: JobCardPayload[]): BotJobListMsg { return { role: "bot", kind: "joblist", payload }; }
function botQuestions(payload: QuestionPayload[]): BotQuestionsMsg { return { role: "bot", kind: "questions", payload }; }

function chunkSplit(text: string, size = 10) { const out: string[] = []; for (let i=0;i<text.length;i+=size) out.push(text.slice(i,i+size)); return out; }
function timestamp() { const d = new Date(); const h = String(d.getHours()).padStart(2,"0"); const m = String(d.getMinutes()).padStart(2,"0"); return `${h}:${m}`; }

// Inline icons (no deps)
function BotIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="7" width="18" height="12" rx="3" className="fill-white" />
      <circle cx="9" cy="13" r="1.5" className="fill-slate-900" />
      <circle cx="15" cy="13" r="1.5" className="fill-slate-900" />
      <rect x="10.5" y="2" width="3" height="5" className="fill-white" />
    </svg>
  );
}
function UserIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="8" r="4" className="fill-white" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" className="fill-white" />
    </svg>
  );
}
function PaperclipIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M8 12l6-6a4 4 0 116 6l-8 8a5 5 0 11-7-7l8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ArrowRightIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
