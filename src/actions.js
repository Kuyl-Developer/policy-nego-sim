// 화면 전환 및 시뮬레이션 실행 액션

import { getState, setState } from "./lib/store.js";
import { PERSONA_BY_ID } from "./data/personas.js";
import { KB_BY_PERSONA } from "./data/knowledgeBase.js";
import { generateReaction, isLiveMode } from "./lib/anthropic.js";

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

export function goToSelect() {
  setState({ screen: "select", notice: "" });
}

export function goToReport() {
  setState({ screen: "report" });
}

// 선택된 페르소나별 반응을 생성하며 채팅 화면으로 이동
export async function startSimulation() {
  const { selectedIds, draftText } = getState();
  if (selectedIds.length === 0) return;

  setState({
    screen: "chat",
    generating: true,
    reactions: {},
    notice: isLiveMode() ? "" : "시드(오프라인) 모드 — API 키를 입력하면 라이브 반응이 생성됩니다.",
  });

  let liveError = "";
  // 페르소나별로 순차 생성(진행감 있게 하나씩 표시)
  for (const id of selectedIds) {
    const persona = PERSONA_BY_ID[id];
    const kb = KB_BY_PERSONA[id] || [];
    const { reaction, error } = await generateReaction({ persona, kb, draftText });
    if (error) liveError = error;
    const state = getState();
    setState({ reactions: { ...state.reactions, [id]: reaction } });
  }

  setState({
    generating: false,
    notice: liveError ? `⚠️ ${liveError}` : getState().notice,
  });
}

export async function regenerate() {
  await startSimulation();
}
