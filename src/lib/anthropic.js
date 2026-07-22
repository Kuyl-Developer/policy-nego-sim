// Anthropic(Claude) 연동 계층
// ─────────────────────────────────────────────────────────────────────────
// - 라이브 모드: 브라우저에서 공식 SDK(@anthropic-ai/sdk)를 esm.sh 로 로드해 사용.
//   모델 기본값 claude-opus-4-8, adaptive thinking 사용.
// - 시드 모드: API 키가 없거나 호출이 실패하면 손으로 작성한 시드 반응으로 폴백.
//   → 인터넷/키 없이도 데모가 완결됨.
//
// ⚠️ 브라우저에서 API 키를 직접 사용하는 것은 데모/해커톤 편의를 위한 것입니다.
//    실제 서비스에서는 키를 서버로 옮기고 프록시를 통해 호출해야 합니다.

import { buildSystemPrompt, buildUserPrompt } from "./prompts.js";
import { SEED_REACTIONS, adjustAcceptability } from "../data/seedReactions.js";

const SDK_URL = "https://esm.sh/@anthropic-ai/sdk@0.68.0";
const MODEL = "claude-opus-4-8";
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
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

// 모델 텍스트 응답에서 JSON 객체만 안전하게 추출
function parseReactionJSON(text) {
  if (!text) throw new Error("빈 응답");
  let s = text.trim();
  // 코드펜스 제거
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  // 첫 '{' ~ 마지막 '}' 구간 추출
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("JSON 형식 아님");
  return JSON.parse(s.slice(start, end + 1));
}

function normalizeReaction(raw, persona, kbIds) {
  const validCites = (raw.citationIds || []).filter((id) => kbIds.includes(id));
  let stance = raw.stance;
  if (!["support", "conditional", "concern"].includes(stance)) stance = "conditional";
  let acc = Number(raw.acceptability);
  if (!Number.isFinite(acc)) acc = 50;
  acc = Math.max(0, Math.min(100, Math.round(acc)));
  const risks = Array.isArray(raw.risks) ? raw.risks.filter(Boolean).slice(0, 4) : [];
  return {
    personaId: persona.id,
    stance,
    acceptability: acc,
    summary: String(raw.summary || "").trim(),
    risks,
    citationIds: validCites,
    limitation: (raw.limitation || "").trim(),
    source: "live",
  };
}

function seedReactionFor(persona, draftText) {
  const base = SEED_REACTIONS[persona.id];
  return {
    personaId: persona.id,
    stance: base.stance,
    acceptability: adjustAcceptability(base.acceptability, draftText, persona.id),
    summary: base.summary,
    risks: base.risks.slice(),
    citationIds: base.citationIds.slice(),
    limitation: base.limitation || "",
    source: "seed",
  };
}

/**
 * 페르소나 반응 생성.
 * @returns {Promise<{reaction, error?}>} reaction.source 로 'live'|'seed' 구분
 */
export async function generateReaction({ persona, kb, draftText }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { reaction: seedReactionFor(persona, draftText) };
  }

  try {
    const client = await getClient(apiKey);
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      system: buildSystemPrompt(),
      messages: [
        { role: "user", content: buildUserPrompt({ persona, kb, draftText }) },
      ],
    });

    const text = (msg.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const raw = parseReactionJSON(text);
    const kbIds = kb.map((s) => s.id);
    return { reaction: normalizeReaction(raw, persona, kbIds) };
  } catch (err) {
    // 실패 시 시드로 폴백하되 오류를 함께 반환(배너로 안내)
    return {
      reaction: seedReactionFor(persona, draftText),
      error: err?.message || "API 호출 실패 — 시드 반응으로 대체했습니다.",
    };
  }
}
