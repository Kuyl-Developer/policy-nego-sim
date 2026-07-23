// Letsur AI Gateway(Claude 호환) 연동 계층 — 다자 협상 대화
// ─────────────────────────────────────────────────────────────────────────
// - 라이브 모드: 브라우저에서 공식 Anthropic SDK(@anthropic-ai/sdk)를 esm.sh 로 로드하되,
//   baseURL 을 Letsur AI Gateway(https://gw.letsur.ai) 로 지정해 게이트웨이 키로 호출.
//   게이트웨이가 Anthropic Messages 포맷을 그대로 지원하므로 SDK 사용법은 동일합니다.
//   (가이드: https://platform.letsur.ai/guide)
// - 시드 모드: API 키가 없으면 손으로 작성한 시드 반응으로 '초기 1회 미리보기'만 제공.
//   실제 다중 턴 대화는 라이브 모드에서만 이어집니다.
//
// ⚠️ 브라우저에서 API 키를 직접 사용하는 것은 데모/해커톤 편의를 위한 것입니다.
//    실제 서비스에서는 키를 서버로 옮기고 프록시를 통해 호출해야 합니다.

import {
  buildChatSystemPrompt,
  buildChatUserPrompt,
  buildKbBlock,
  buildReportSystemPrompt,
  buildReportUserPrompt,
  buildRevisePrompt,
  buildReviseUserPrompt,
  REPLY_SCHEMA,
  REPORT_EVAL_SCHEMA,
  REPORT_FEEDBACK_SCHEMA,
  REPORT_IMPROVEMENTS_SCHEMA,
  REPORT_FOCUS,
} from "./prompts.js";
import { SEED_REACTIONS, adjustAcceptability } from "../data/seedReactions.js";

const SDK_URL = "https://esm.sh/@anthropic-ai/sdk@0.68.0";
// Letsur AI Gateway 엔드포인트. Anthropic SDK 는 여기에 /v1 을 자동으로 붙입니다.
const GATEWAY_BASE_URL = "https://gw.letsur.ai";
// 가이드에서 동작이 확인된 모델. 더 상위 모델(claude-opus-4-8 등)이 필요하면
// Space → AI Gateway → 카탈로그 탭에서 사용 가능한 모델 ID로 교체하세요.
// 리포트/초안 수정 속도 개선을 위해 Sonnet → Haiku 4.5로 변경.
// 주의: Haiku 4.5는 4.6 미만 모델이라 adaptive thinking 미지원 → 관련 호출에서 thinking 파라미터 생략.
// 게이트웨이 카탈로그에 Haiku가 없으면 400이 나므로, 그 경우 다시 "claude-sonnet-4-6"으로 되돌리면 된다.
export const MODEL = "claude-haiku-4-5";
// 채팅 응답도 지연에 민감해 동일하게 빠른 Haiku 4.5 사용.
export const REPLY_MODEL = "claude-haiku-4-5";
const KEY_STORAGE = "ens-sim.apiKey";

// API 키 정규화: 붙여넣기 과정에서 섞이기 쉬운 공백·개행·제로폭 문자(U+200B~200D, BOM) 제거.
// HTTP 헤더는 ISO-8859-1만 허용하므로 이런 문자가 남으면 요청 자체가 실패한다.
// (API 키에는 공백이 없으므로 모든 공백류를 제거해도 안전하다.)
export function sanitizeKey(key) {
  return String(key || "")
    .replace(/\s/g, "")
    .replace(/[​-‍﻿]/g, "");
}

// 정규화 후에도 Latin-1(0x00~0xFF) 범위를 벗어난 문자가 남았는지 검사.
// (한글·이모지 등 잘못된 내용을 붙여넣은 경우 — 이 상태로는 HTTP 헤더를 만들 수 없음)
export function keyHasInvalidChars(key) {
  return /[^\x00-\xFF]/.test(sanitizeKey(key));
}

export function getApiKey() {
  try {
    return sanitizeKey(localStorage.getItem(KEY_STORAGE) || "");
  } catch {
    return "";
  }
}

export function setApiKey(key) {
  const clean = sanitizeKey(key);
  try {
    if (clean) localStorage.setItem(KEY_STORAGE, clean);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* localStorage 불가 환경 무시 */
  }
}

export function isLiveMode() {
  return !!getApiKey();
}

let _clientPromise = null;
async function getClient(apiKey) {
  if (!_clientPromise) {
    _clientPromise = import(/* @vite-ignore */ SDK_URL)
      .then((mod) => mod.default || mod.Anthropic)
      .catch((err) => {
        _clientPromise = null;
        throw err;
      });
  }
  const Anthropic = await _clientPromise;
  return new Anthropic({ apiKey, baseURL: GATEWAY_BASE_URL, dangerouslyAllowBrowser: true });
}

// 구조화 출력은 tool use(함수 호출)로 강제한다. 모델이 자유 텍스트로 JSON 을 쓰면
// 문자열 값 안의 큰따옴표를 잘못 이스케이프해 JSON.parse 가 깨지는 사례가 잦았는데,
// tool_use 블록의 input 은 게이트웨이가 이미 파싱한 객체라 이 문제 자체가 사라진다.
// 응답에서 지정한 이름의 tool_use 입력 객체를 꺼낸다(없으면 오류).
function extractToolInput(msg, toolName) {
  const block = (msg?.content || []).find(
    (b) => b.type === "tool_use" && b.name === toolName
  );
  if (!block || !block.input || typeof block.input !== "object") {
    throw new Error("구조화 응답(tool_use)이 반환되지 않았습니다.");
  }
  return block.input;
}

function clampAcc(v, fallback = 50) {
  let acc = Number(v);
  if (!Number.isFinite(acc)) acc = fallback;
  return Math.max(0, Math.min(100, Math.round(acc)));
}

function normalizeReply(raw, persona, kbIds) {
  let stance = raw.stance;
  if (!["support", "conditional", "concern"].includes(stance)) stance = "conditional";
  const citationIds = (raw.citationIds || []).filter((id) => kbIds.includes(id));
  const concerns = Array.isArray(raw.concerns) ? raw.concerns.filter(Boolean).slice(0, 3) : [];
  return {
    personaId: persona.id,
    role: "persona",
    text: String(raw.reply || "").trim() || "(응답 없음)",
    stance,
    acceptability: clampAcc(raw.acceptability),
    citationIds,
    concerns,
    limitation: (raw.limitation || "").trim(),
    source: "live",
  };
}

// API 호출 오류 메시지를 사용자에게 보여줄 한국어 안내로 변환
function friendlyError(err, modelId = MODEL) {
  const msg = err?.message || String(err || "");
  if (/ISO-8859-1|code point|Headers/i.test(msg)) {
    return "API 키에 허용되지 않는 문자(공백·줄바꿈·한글·특수문자 등)가 섞여 있습니다. 키를 다시 복사해 붙여넣어 주세요.";
  }
  if (/401|invalid|credential|unauthor/i.test(msg)) {
    return "API 키가 올바르지 않습니다(401). Letsur AI Gateway 키를 다시 확인해 주세요.";
  }
  if (/429|quota|limit|exceed/i.test(msg)) {
    return "사용량 한도를 초과했습니다(429). 게이트웨이 사용량·한도를 확인해 주세요.";
  }
  if (/400|model|not found|bad request/i.test(msg)) {
    return `요청이 거부되었습니다(400). 모델 ID(${modelId})가 카탈로그에서 지원되는지 확인해 주세요.`;
  }
  return msg || "API 호출 실패";
}

// 시드(오프라인) 초기 반응 → 대화 메시지 형태로 변환 (첫 라운드 미리보기용)
export function seedReplyFor(persona, draftText) {
  const base = SEED_REACTIONS[persona.id];
  return {
    personaId: persona.id,
    role: "persona",
    text: base.summary,
    stance: base.stance,
    acceptability: adjustAcceptability(base.acceptability, draftText, persona.id),
    citationIds: base.citationIds.slice(),
    concerns: base.risks.slice(0, 3),
    limitation: base.limitation || "",
    source: "seed",
  };
}

/**
 * 협상 대화에서 한 페르소나의 다음 발언 생성(라이브 전용).
 * @param {object} p
 * @param {object} p.persona
 * @param {Array}  p.kb        해당 페르소나의 지식 베이스 항목
 * @param {Array}  p.transcript [{speaker, text}] 현재까지 회의록
 * @returns {Promise<{reply, error?}>}
 */
export async function generateReply({ persona, kb, transcript }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    // 라이브 키가 없으면 대화를 이어갈 수 없음(호출부에서 사전 차단하지만 안전장치).
    return { reply: null, error: "대화형 협상은 API 키가 필요합니다." };
  }
  // 정규화로도 걷어내지 못한 비(非) Latin-1 문자가 있으면 SDK가 헤더를 만들다 예외를 던진다.
  // 실제 호출 전에 미리 걸러 명확히 안내한다.
  if (keyHasInvalidChars(apiKey)) {
    return {
      reply: null,
      error: "API 키에 허용되지 않는 문자(한글·특수문자 등)가 포함되어 있습니다. 키를 다시 복사해 붙여넣어 주세요.",
    };
  }
  try {
    const client = await getClient(apiKey);
    // tool use 로 응답 스키마를 강제. 응답은 빠른 Haiku(REPLY_MODEL) 사용 — 4.6 미만이라
    // adaptive thinking 미지원이므로 thinking 파라미터를 넣지 않는다(넣으면 400).
    // 스트리밍으로 타임아웃도 방지한다.
    //
    // 성능: KB 전문(全文)은 라운드마다 동일하므로 시스템의 '캐시 블록'으로 보낸다.
    // cache_control 을 마지막 블록에 달면 지침+정체성+KB 전체가 캐시되어, 첫 호출 이후
    // 라운드에서는 대용량 KB 를 재처리하지 않고 캐시를 재사용한다(데이터는 전량 유지).
    const msg = await client.messages
      .stream({
        model: REPLY_MODEL,
        max_tokens: 3000,
        system: [
          { type: "text", text: buildChatSystemPrompt(persona) },
          { type: "text", text: buildKbBlock(kb), cache_control: { type: "ephemeral" } },
        ],
        messages: [{ role: "user", content: buildChatUserPrompt({ persona, transcript }) }],
        tools: [{ name: "emit_reply", description: "협상 참석자의 다음 발언과 협상 상태를 반환", input_schema: REPLY_SCHEMA }],
        tool_choice: { type: "tool", name: "emit_reply" },
      })
      .finalMessage();
    const raw = extractToolInput(msg, "emit_reply");
    return { reply: normalizeReply(raw, persona, kb.map((s) => s.id)) };
  } catch (err) {
    return { reply: null, error: friendlyError(err, REPLY_MODEL) };
  }
}

function clampScore(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : fallback;
}

// 배열이어야 할 값이 문자열(JSON 직렬화)로 오면 관대하게 되살린다.
// tool use 로도 모델이 복잡한 배열을 통째로 문자열화하는 사례가 있어 최종 안전망으로 둔다.
function asArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v.trim()) {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* 파싱 실패 시 빈 배열로 처리(허위 정보 생성 금지) */
    }
  }
  return [];
}

function normalizeReport(raw, personaIds) {
  const sub = raw.subscores || {};
  const subscore = (key, fallback) => ({
    score: clampScore(sub[key]?.score, fallback),
    note: String(sub[key]?.note || "").trim(),
  });
  const opinions = {};
  for (const o of asArray(raw.stakeholderOpinions)) {
    if (o?.personaId && personaIds.includes(o.personaId)) {
      opinions[o.personaId] = String(o.opinion || "").trim();
    }
  }
  // 개선 제안: 평행 배열 4개를 인덱스로 zip 해 객체로 조립(본문이 있는 항목만).
  const titles = asArray(raw.improvementTitles);
  const pIds = asArray(raw.improvementPersonaIds);
  const issues = asArray(raw.improvementIssues);
  const bodies = asArray(raw.improvementBodies);
  const improvements = bodies
    .map((body, i) => ({
      title: String(titles[i] || "").trim() || "개선 제안",
      personaId: personaIds.includes(pIds[i]) ? pIds[i] : "",
      issue: String(issues[i] || "").trim(),
      body: String(body || "").trim(),
    }))
    .filter((it) => it.body);
  return {
    overallSummary: String(raw.overallSummary || "").trim(),
    subscores: {
      persuasiveness: subscore("persuasiveness", 50),
      riskManagement: subscore("riskManagement", 50),
      clarity: subscore("clarity", 50),
      evidence: subscore("evidence", 50),
    },
    stakeholderOpinions: opinions,
    painPoints: Array.isArray(raw.painPoints) ? raw.painPoints.filter(Boolean).map(String) : [],
    strategyImprovements: improvements,
    source: "live",
  };
}

/**
 * 협상 종료 후 평가 리포트 생성(라이브 전용).
 * @param {object} p
 * @param {string} p.draftText 최초 작성한 커뮤니케이션 전략 초안
 * @param {Array}  p.personas 협상에 참여한 페르소나 목록
 * @param {object} p.reactions personaId -> {stance, acceptability, summary, risks, limitation}
 * @param {Array}  p.transcript [{speaker, text}] 전체 회의록
 * @returns {Promise<{report, error?}>}
 */
// 리포트 한 슬라이스를 tool use 로 생성한다. MODEL이 Haiku(4.6 미만)라 adaptive thinking을
// 지원하지 않으므로 thinking 파라미터는 생략한다(넣으면 400). 스트리밍으로 호출해 게이트웨이
// 타임아웃을 피하고, 출력은 tool use 로 강제해 문자열 인용부호로 인한 JSON 파싱 실패를 막는다.
async function runReportSlice({ client, baseUser, system, focus, toolName, description, schema, maxTokens }) {
  const msg = await client.messages
    .stream({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: `${baseUser}\n\n${focus}` }],
      tools: [{ name: toolName, description, input_schema: schema }],
      tool_choice: { type: "tool", name: toolName },
    })
    .finalMessage();
  return extractToolInput(msg, toolName);
}

export async function generateReport({ draftText, personas, reactions, transcript }) {
  const apiKey = getApiKey();
  if (!apiKey || keyHasInvalidChars(apiKey)) {
    return { report: null, error: "API 키가 없거나 올바르지 않습니다." };
  }
  try {
    const client = await getClient(apiKey);
    const system = buildReportSystemPrompt();
    const baseUser = buildReportUserPrompt({ draftText, personas, reactions, transcript });

    // 성능: 큰 리포트를 한 번에 디코딩하는 대신 3개 슬라이스로 나눠 병렬 호출한다.
    // 각 슬라이스는 전량 생성되므로 출력 데이터는 단일 호출과 동일(무손실)하고,
    // 벽시계 시간은 가장 느린 한 슬라이스 수준으로 줄어든다. 공통 컨텍스트를 동일하게 주어
    // 섹션 간 논조 일관성을 유지한다.
    const slices = [
      { key: "eval", focus: REPORT_FOCUS.eval, toolName: "emit_evaluation", description: "총평과 서브스코어를 반환", schema: REPORT_EVAL_SCHEMA, maxTokens: 3000 },
      { key: "feedback", focus: REPORT_FOCUS.feedback, toolName: "emit_feedback", description: "이해관계자별 의견과 Pain Point를 반환", schema: REPORT_FEEDBACK_SCHEMA, maxTokens: 5000 },
      { key: "improvements", focus: REPORT_FOCUS.improvements, toolName: "emit_improvements", description: "초안 개선 제안(평행 배열)을 반환", schema: REPORT_IMPROVEMENTS_SCHEMA, maxTokens: 8000 },
    ];

    // 일부 슬라이스가 일시적으로 실패해도 나머지는 살린다(allSettled). 성공한 조각만 병합하고,
    // 빠진 필드는 normalizeReport 가 안전한 기본값으로 채운다(허위 생성 없음).
    const results = await Promise.allSettled(
      slices.map((s) => runReportSlice({ client, baseUser, system, ...s }))
    );

    const merged = {};
    let firstError = null;
    results.forEach((r, i) => {
      if (r.status === "fulfilled") Object.assign(merged, r.value);
      else if (!firstError) firstError = r.reason;
      if (r.status === "rejected") console.warn(`리포트 슬라이스 실패(${slices[i].key}):`, r.reason);
    });

    // 전부 실패했을 때만 오류로 처리한다. 하나라도 성공하면 부분 리포트라도 보여준다.
    if (Object.keys(merged).length === 0) {
      return { report: null, error: friendlyError(firstError) };
    }
    return { report: normalizeReport(merged, personas.map((p) => p.id)) };
  } catch (err) {
    return { report: null, error: friendlyError(err) };
  }
}

// 시드(오프라인) 폴백 리포트: 대화에서 파생된 reactions 만으로 구성.
// LLM 없이 draftText 의 섹션 제목을 인용해 최소한의 초안 연계를 제공한다.
export function seedReportFor({ draftText, personas, reactions }) {
  const ids = personas.map((p) => p.id).filter((id) => reactions[id]);
  const avg = (key) => (ids.length ? Math.round(ids.reduce((a, id) => a + (reactions[id]?.[key] || 0), 0) / ids.length) : 50);
  const accAvg = avg("acceptability");
  const concernCount = ids.filter((id) => reactions[id]?.stance === "concern").length;
  const limitationCount = ids.filter((id) => reactions[id]?.limitation).length;

  const sections = (draftText || "")
    .split(/\n(?=##\s)/)
    .map((s) => s.trim())
    .filter(Boolean);
  const firstSection = sections[0] ? sections[0].split("\n")[0].replace(/^##\s*/, "") : "제안 배경";

  const sorted = [...ids].sort((a, b) => (reactions[a]?.acceptability || 0) - (reactions[b]?.acceptability || 0));
  const opinions = {};
  for (const id of ids) opinions[id] = reactions[id]?.summary || "";

  const painPoints = [];
  for (const id of sorted.slice(0, 3)) {
    const r = reactions[id];
    const persona = personas.find((p) => p.id === id);
    if (r?.risks?.[0]) painPoints.push(`${persona?.name || id}: ${r.risks[0]}`);
  }
  if (!painPoints.length) painPoints.push("주요 이해관계자 우려가 낮습니다.");

  const improvements = sorted.slice(0, 4).map((id) => {
    const persona = personas.find((p) => p.id === id);
    const r = reactions[id];
    const topRisk = r?.risks?.[0] || r?.limitation || "제기된 우려";
    return {
      title: `${persona?.name || id} 대응 보완`,
      personaId: id,
      issue: topRisk,
      body: `초안의 '${firstSection}' 항목에 "${topRisk}"에 대한 구체적 대응 방안(수치·일정·재원 등)을 한 문단 추가하는 것을 검토하세요.`,
    };
  });
  if (!improvements.length) {
    improvements.push({
      title: "현행 초안 유지 가능",
      personaId: "",
      issue: "",
      body: "주요 이해관계자 우려가 낮아 현행 초안을 큰 변경 없이 유지할 수 있습니다.",
    });
  }

  return {
    overallSummary: `${ids.length}개 이해관계자 그룹의 평균 수용도는 ${accAvg}%이며, 그중 ${concernCount}곳이 우려를 유지하고 있습니다(시드 모드 요약).`,
    subscores: {
      persuasiveness: { score: accAvg, note: "이해관계자 평균 수용도를 기반으로 한 근사치입니다." },
      riskManagement: { score: clampScore(100 - concernCount * 20, 50), note: "우려(concern) 입장 이해관계자 수가 많을수록 낮아집니다." },
      clarity: { score: 60, note: "시드 모드에서는 별도로 채점하지 않아 기본값을 표시합니다." },
      evidence: { score: clampScore(100 - limitationCount * 15, 60), note: "근거 한계를 밝힌 이해관계자 수가 많을수록 낮아집니다." },
    },
    stakeholderOpinions: opinions,
    painPoints,
    strategyImprovements: improvements,
    source: "seed",
  };
}

// 모델이 규칙을 어기고 코드펜스로 감싸 보낼 때를 대비한 방어적 벗기기
function stripCodeFence(text) {
  const trimmed = String(text || "").trim();
  const m = trimmed.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  return (m ? m[1] : trimmed).trim();
}

/**
 * 리포트에서 채택한 개선 제안만 반영해 원본 전략 초안을 다시 작성(라이브 전용).
 * @param {object} p
 * @param {string} p.draftText 원본 전략 초안
 * @param {Array}  p.personas 협상에 참여한 페르소나 목록
 * @param {Array}  p.suggestions 사용자가 채택한 제안 [{text}]
 * @param {(partial:string)=>void} [p.onDelta] 스트리밍 중 누적 텍스트를 전달받는 콜백(부분 렌더용).
 *        출력 데이터를 바꾸지 않고 도착하는 대로 화면에 흘려보내기 위한 것으로, 품질에는 영향이 없다.
 * @returns {Promise<{draft, error?}>}
 */
export async function generateRevision({ draftText, personas, suggestions, onDelta }) {
  const apiKey = getApiKey();
  if (!apiKey || keyHasInvalidChars(apiKey)) {
    return { draft: null, error: "API 키가 없거나 올바르지 않습니다." };
  }
  try {
    const client = await getClient(apiKey);
    // MODEL이 Haiku(4.6 미만)라 adaptive thinking을 지원하지 않으므로 thinking 파라미터는
    // 생략한다(넣으면 400). 예산은 넉넉히 유지(이전에 4096으로 빈 응답이 나온 사례가 있었음).
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      system: buildRevisePrompt(personas),
      messages: [{ role: "user", content: buildReviseUserPrompt({ draftText, suggestions }) }],
    });
    // 텍스트가 도착하는 대로 누적 스냅샷을 콜백에 넘긴다(체감 대기 단축). 최종 결과는
    // finalMessage()로 동일하게 확정하므로 스트리밍 여부와 무관하게 출력 데이터는 같다.
    if (typeof onDelta === "function") {
      stream.on("text", (_delta, snapshot) => onDelta(snapshot));
    }
    const msg = await stream.finalMessage();
    const text = (msg?.content || []).find((b) => b.type === "text")?.text || "";
    const draft = stripCodeFence(text);
    if (!draft) return { draft: null, error: "수정된 초안이 비어 있습니다." };
    return { draft };
  } catch (err) {
    return { draft: null, error: friendlyError(err) };
  }
}

// 시드(오프라인) 폴백: API 없이, 채택한 제안 본문을 초안 끝에 그대로 덧붙인다(지어내지 않음).
export function seedReviseFor({ draftText, suggestions }) {
  const appendix = suggestions.map((s) => `- ${s.text}`).join("\n");
  return `${draftText}\n\n## 반영된 개선 제안 (시드 모드 — API 키 입력 시 실제 초안 재작성)\n${appendix}`;
}
