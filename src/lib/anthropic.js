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

import { buildChatSystemPrompt, buildChatUserPrompt } from "./prompts.js";
import { SEED_REACTIONS, adjustAcceptability } from "../data/seedReactions.js";

const SDK_URL = "https://esm.sh/@anthropic-ai/sdk@0.68.0";
// Letsur AI Gateway 엔드포인트. Anthropic SDK 는 여기에 /v1 을 자동으로 붙입니다.
const GATEWAY_BASE_URL = "https://gw.letsur.ai";
// 가이드에서 동작이 확인된 모델. 더 상위 모델(claude-opus-4-8 등)이 필요하면
// Space → AI Gateway → 카탈로그 탭에서 사용 가능한 모델 ID로 교체하세요.
export const MODEL = "claude-sonnet-4-6";
const KEY_STORAGE = "ens-sim.apiKey";

export function getApiKey() {
  try {
    return localStorage.getItem(KEY_STORAGE) || "";
  } catch {
    return "";
  }
}

export function setApiKey(key) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
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

// 모델 텍스트 응답에서 JSON 객체만 안전하게 추출
function parseJSON(text) {
  if (!text) throw new Error("빈 응답");
  let s = text.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("JSON 형식 아님");
  return JSON.parse(s.slice(start, end + 1));
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
  try {
    const client = await getClient(apiKey);
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      system: buildChatSystemPrompt(persona),
      messages: [{ role: "user", content: buildChatUserPrompt({ persona, kb, transcript }) }],
    });
    const text = (msg.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const raw = parseJSON(text);
    return { reply: normalizeReply(raw, persona, kb.map((s) => s.id)) };
  } catch (err) {
    return { reply: null, error: err?.message || "API 호출 실패" };
  }
}
