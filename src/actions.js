// 화면 전환 및 다자 협상(라운드테이블) 실행 액션

import { getState, setState, nextId, resetNegotiation } from "./lib/store.js";
import { PERSONA_BY_ID } from "./data/personas.js";
import { KB_BY_PERSONA } from "./data/knowledgeBase.js";
import {
  generateReply,
  seedReplyFor,
  generateReport,
  seedReportFor,
  generateRevision,
  seedReviseFor,
  isLiveMode,
} from "./lib/anthropic.js";
import { deriveReactions } from "./lib/reactions.js";
import { buildSuggestions } from "./lib/suggestions.js";

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
    const report = seedReportFor({ draftText, personas, reactions });
    setState({ report, reviseSelected: initialSelection(report, ids) });
    return;
  }

  setState({ reportLoading: true });
  const transcript = buildTranscript();
  const { report, error } = await generateReport({ draftText, personas, reactions, transcript });
  const finalReport = report || seedReportFor({ draftText, personas, reactions });
  setState({
    reportLoading: false,
    report: finalReport,
    reviseSelected: initialSelection(finalReport, ids),
    notice: error ? `⚠️ 리포트 생성 실패 — 시드 데이터로 대체했습니다. (${error})` : getState().notice,
  });
}

// 리포트가 준비되면 도출된 모든 제안을 기본 전체 선택 상태로 초기화한다.
function initialSelection(report, ids) {
  const suggestions = buildSuggestions(report, ids, PERSONA_BY_ID);
  const sel = {};
  for (const s of suggestions) sel[s.id] = true;
  return sel;
}

// 개선 제안 체크박스 토글
export function toggleSuggestion(id) {
  const { reviseSelected } = getState();
  setState({ reviseSelected: { ...reviseSelected, [id]: !reviseSelected[id] } });
}

// 사용자가 선택한 개선 제안만 반영해 전략 초안을 다시 작성한다.
export async function reviseDraft() {
  const st = getState();
  if (!st.report || st.revising) return;

  const { selectedIds, messages, acceptability, draftText, reviseSelected } = st;
  const reactions = deriveReactions(messages, acceptability);
  const ids = selectedIds.filter((id) => reactions[id]);
  const personas = ids.map((id) => PERSONA_BY_ID[id]);

  const suggestions = buildSuggestions(st.report, ids, PERSONA_BY_ID);
  const chosen = suggestions.filter((s) => reviseSelected[s.id]);
  if (!chosen.length) {
    setState({ reviseError: "반영할 제안을 하나 이상 선택하세요." });
    return;
  }

  setState({ revising: true, reviseError: "", revisedDraft: "" });

  if (!isLiveMode()) {
    setState({ revising: false, revisedDraft: seedReviseFor({ draftText, suggestions: chosen }) });
    return;
  }

  const { draft, error } = await generateRevision({ draftText, personas, suggestions: chosen });
  setState({
    revising: false,
    revisedDraft: draft || "",
    reviseError: error ? `⚠️ ${error}` : "",
  });
}

// 수정된 초안을 채택해 새 시뮬레이션을 준비한다(선택 화면으로 이동, 협상 상태 초기화).
export function applyRevisedDraft() {
  const { revisedDraft } = getState();
  if (!revisedDraft) return;
  setDraft(revisedDraft);
  resetNegotiation();
  setState({ screen: "select", notice: "수정된 초안이 반영되었습니다." });
}

// 현재까지의 메시지를 회의록(transcript) 형태로 변환.
// 시스템 안내(role:"system", 예: 합류 알림)는 회의록/LLM 입력에서 제외한다.
function buildTranscript() {
  const { messages } = getState();
  return messages
    .filter((m) => m.role === "user" || m.role === "persona")
    .map((m) => ({
      speaker: m.role === "user" ? "우리 측(제안자)" : PERSONA_BY_ID[m.personaId]?.name || "참석자",
      text: m.text,
    }));
}

// 한 페르소나의 응답을 생성해 상태에 반영한다(라이브 전용).
// 주어진 회의록 스냅샷을 근거로 generateReply 호출 → 성공 시 메시지 append +
// 수용도 갱신 + pendingIds에서 제거. runRound와 invitePersona가 공유한다.
async function replyForPersona(id, transcript) {
  const persona = PERSONA_BY_ID[id];
  const kb = KB_BY_PERSONA[id] || [];
  const { reply, error } = await generateReply({ persona, kb, transcript });
  // 응답이 도착하는 즉시 개별 반영(점진적 렌더링).
  if (reply) {
    const st = getState();
    setState({
      messages: [...st.messages, { id: nextId(), ...reply }],
      acceptability: { ...st.acceptability, [id]: reply.acceptability },
      pendingIds: st.pendingIds.filter((x) => x !== id),
    });
  }
  return { id, error: reply ? "" : error || "응답 생성 실패" };
}

// 선택된 모든 페르소나가 최신 발언에 대응하는 한 라운드 진행(라이브 전용).
// 지연을 줄이기 위해 모든 페르소나 응답을 병렬로 호출한다. 병렬화 특성상 이번 라운드의
// 회의록은 라운드 시작 시점으로 한 번만 스냅샷하며(같은 라운드 내 상호 참조는 없음),
// 각 응답이 도착하는 대로 화면에 점진적으로 반영한다.
async function runRound() {
  const { selectedIds } = getState();
  setState({ negotiating: true, pendingIds: [...selectedIds] });

  const transcript = buildTranscript(); // 라운드 시작 시점 회의록 스냅샷(모든 페르소나 공유)

  const results = await Promise.all(selectedIds.map((id) => replyForPersona(id, transcript)));

  const hadError = results.find((r) => r.error)?.error || "";
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

// 협상 중 아직 참여하지 않은 페르소나를 테이블로 초대한다.
// 합류 시스템 메시지를 남기고, 신규 참여자 1명만 지금까지의 회의록을 반영해 즉시 발언한다.
// (기존 참석자는 다음 사용자 발언 라운드에서 자연스럽게 반응)
export async function invitePersona(id) {
  const st = getState();
  if (st.negotiating) return; // 라운드 진행 중에는 초대 불가
  if (st.selectedIds.includes(id)) return; // 이미 참여 중
  const persona = PERSONA_BY_ID[id];
  if (!persona) return;

  // 참여자 목록에 추가 + 합류 안내 시스템 메시지
  setState({
    selectedIds: [...st.selectedIds, id],
    messages: [
      ...st.messages,
      { id: nextId(), role: "system", text: `🔔 ${persona.name} 님이 협상에 합류했습니다.` },
    ],
  });

  // 시드(오프라인) 모드: 신규 참여자의 초기 반응을 즉시 미리보기로 채움
  if (!isLiveMode()) {
    const r = seedReplyFor(persona, getState().draftText);
    const s = getState();
    setState({
      messages: [...s.messages, { id: nextId(), ...r }],
      acceptability: { ...s.acceptability, [id]: r.acceptability },
    });
    return;
  }

  // 라이브 모드: 신규 참여자만 회의록 맥락을 반영해 1회 응답
  setState({ negotiating: true, pendingIds: [id] });
  const transcript = buildTranscript(); // 시스템 메시지는 제외된 스냅샷
  const { error } = await replyForPersona(id, transcript);
  setState({
    negotiating: false,
    pendingIds: [],
    notice: error ? `⚠️ ${error} — API 키와 네트워크를 확인하세요.` : "",
  });
}

// 협상 종료 → 리포트
export function endNegotiation() {
  setState({ screen: "report" });
  ensureReport();
}
