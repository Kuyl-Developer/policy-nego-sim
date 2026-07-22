// 화면 전환 및 다자 협상(라운드테이블) 실행 액션

import { getState, setState, nextId, resetNegotiation } from "./lib/store.js";
import { PERSONA_BY_ID } from "./data/personas.js";
import { KB_BY_PERSONA } from "./data/knowledgeBase.js";
import { generateReply, seedReplyFor, generateReport, seedReportFor, isLiveMode } from "./lib/anthropic.js";
import { deriveReactions } from "./lib/reactions.js";

export function togglePersona(id) {
  const { selectedIds } = getState();
  const next = selectedIds.includes(id)
    ? selectedIds.filter((x) => x !== id)
    : [...selectedIds, id];
  setState({ selectedIds: next });
}

export function setDraft(text) {
  // 리렌더 없이 상태만 갱신(텍스트 입력 중 커서 유지)
  getState().draftText = text;
}

export function setChatInput(text) {
  // 입력창 임시 값(리렌더 없이 유지)
  getState().chatInput = text;
}

export function goToSelect() {
  setState({ screen: "select", notice: "" });
}

export function goToReport() {
  setState({ screen: "report" });
  ensureReport();
}

// 리포트가 아직 없으면 생성(라이브면 LLM 1회 호출, 아니면 시드 폴백). 이미 있으면 스킵.
export async function ensureReport() {
  const st = getState();
  if (st.report || st.reportLoading) return;

  const { selectedIds, messages, acceptability, draftText } = st;
  const reactions = deriveReactions(messages, acceptability);
  const ids = selectedIds.filter((id) => reactions[id]);
  const personas = ids.map((id) => PERSONA_BY_ID[id]);

  if (!personas.length) return;

  if (!isLiveMode()) {
    setState({ report: seedReportFor({ draftText, personas, reactions }) });
    return;
  }

  setState({ reportLoading: true });
  const transcript = buildTranscript();
  const { report, error } = await generateReport({ draftText, personas, reactions, transcript });
  setState({
    reportLoading: false,
    report: report || seedReportFor({ draftText, personas, reactions }),
    notice: error ? `⚠️ 리포트 생성 실패 — 시드 데이터로 대체했습니다. (${error})` : getState().notice,
  });
}

// 현재까지의 메시지를 회의록(transcript) 형태로 변환
function buildTranscript() {
  const { messages } = getState();
  return messages.map((m) => ({
    speaker: m.role === "user" ? "우리 측(제안자)" : PERSONA_BY_ID[m.personaId]?.name || "참석자",
    text: m.text,
  }));
}

// 선택된 모든 페르소나가 한 명씩(순차) 최신 발언에 대응하는 한 라운드 진행(라이브 전용)
async function runRound() {
  const { selectedIds } = getState();
  setState({ negotiating: true, pendingIds: [...selectedIds] });

  let hadError = "";
  for (const id of selectedIds) {
    const persona = PERSONA_BY_ID[id];
    const kb = KB_BY_PERSONA[id] || [];
    const transcript = buildTranscript(); // 앞 페르소나의 이번 라운드 발언까지 포함
    const { reply, error } = await generateReply({ persona, kb, transcript });
    if (error || !reply) {
      hadError = error || "응답 생성 실패";
      break;
    }
    const st = getState();
    setState({
      messages: [...st.messages, { id: nextId(), ...reply }],
      acceptability: { ...st.acceptability, [id]: reply.acceptability },
      pendingIds: st.pendingIds.filter((x) => x !== id),
    });
  }

  setState({
    negotiating: false,
    pendingIds: [],
    notice: hadError ? `⚠️ ${hadError} — API 키와 네트워크를 확인하세요.` : "",
  });
}

// 시드(오프라인) 모드: 오프닝에 대한 초기 반응을 1회만 미리보기로 채움
function seedFirstRound() {
  const { selectedIds, draftText } = getState();
  const msgs = [];
  const acc = {};
  for (const id of selectedIds) {
    const persona = PERSONA_BY_ID[id];
    const r = seedReplyFor(persona, draftText);
    msgs.push({ id: nextId(), ...r });
    acc[id] = r.acceptability;
  }
  const st = getState();
  setState({ messages: [...st.messages, ...msgs], acceptability: acc });
}

// 화면 ①에서 '모의 협상 시작' — 오프닝(초안)을 첫 발언으로 넣고 1라운드 진행
export async function startNegotiation() {
  const { selectedIds, draftText } = getState();
  if (selectedIds.length === 0) return;

  resetNegotiation();
  const opening = (draftText || "").trim() || "(초안 내용 없음)";
  setState({
    screen: "chat",
    round: 1,
    messages: [{ id: nextId(), role: "user", text: opening }],
    notice: "",
  });

  if (!isLiveMode()) {
    seedFirstRound();
    setState({
      notice: "시드(오프라인) 미리보기입니다 — 대화를 이어가려면 상단에 Anthropic API 키를 입력하세요.",
    });
    return;
  }
  await runRound();
}

// 사용자가 협상 중 발언을 보냄 → 한 라운드 진행(라이브 전용)
export async function sendMessage(text) {
  const clean = (text || "").trim();
  if (!clean) return;
  if (getState().negotiating) return;

  if (!isLiveMode()) {
    setState({ notice: "대화형 협상은 API 키가 필요합니다. 상단에 키를 입력한 뒤 다시 시도하세요." });
    return;
  }

  const st = getState();
  setState({
    messages: [...st.messages, { id: nextId(), role: "user", text: clean }],
    round: st.round + 1,
    chatInput: "",
  });
  await runRound();
}

// 협상 종료 → 리포트
export function endNegotiation() {
  setState({ screen: "report" });
  ensureReport();
}
