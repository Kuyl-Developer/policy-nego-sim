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
  draftText: DEFAULT_DRAFT,
  reactions: {}, // personaId -> reaction
  generating: false,
  notice: "", // 상단 배너 안내(오류 등)
};

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

export { DEFAULT_DRAFT };
