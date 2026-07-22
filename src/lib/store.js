// 화면 간 상태 저장소 (아주 단순한 pub/sub)

const DEFAULT_DRAFT = `## 제안 배경
(현재 상황과 이 커뮤니케이션이 필요한 이유를 적어주세요)

## 정책 제언
(핵심 메시지와 제안하는 방향을 적어주세요)

## 기대 효과
(이 전략이 성공했을 때 기대되는 효과를 적어주세요)`;

const state = {
  screen: "select", // "select" | "chat" | "report"
  selectedIds: [], // 선택된 페르소나 id 목록
  draftText: DEFAULT_DRAFT, // 협상의 오프닝(우리 측 첫 발언)

  // ── 다자 협상(라운드테이블) 상태 ──────────────────────────────────
  messages: [], // {id, role:"user"|"persona", personaId?, text, stance?, acceptability?, citationIds?, concerns?, limitation?, source?}
  acceptability: {}, // personaId -> 최신 수용도(0~100)
  round: 0, // 진행된 라운드 수(우리 측 발언 횟수)
  negotiating: false, // 라운드 생성 중 여부
  pendingIds: [], // 이번 라운드에서 아직 답변 전인 페르소나(타이핑 표시용)
  chatInput: "", // 입력창 임시 값(리렌더와 무관하게 유지)

  notice: "", // 상단 배너 안내(오류 등)
};

let _seq = 0;
export function nextId() {
  _seq += 1;
  return `m${_seq}`;
}

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// 협상 상태 초기화(새 시뮬레이션 시작 시)
export function resetNegotiation() {
  state.messages = [];
  state.acceptability = {};
  state.round = 0;
  state.negotiating = false;
  state.pendingIds = [];
  state.chatInput = "";
}

export { DEFAULT_DRAFT };
