// 화면 간 상태 저장소 (아주 단순한 pub/sub)

// 더미 초안: BESS(배터리 에너지저장장치) 보급 확대를 위한 정책 제언 예시.
// 4개 페르소나 모두에게서 서로 다른 반응을 끌어내도록 구성 — 자유롭게 수정하세요.
const DEFAULT_DRAFT = `## 제언 배경
- 대규모 재생에너지 보급을 위한 신규 송전선로 건설은 장기간 소요되므로, 현시점에는 계통 유연성을 제공할 BESS 외 대안 부재
- 단기간 내 대규모 설치가 가능하고 실시간 충·방전을 통해 출력 제어 최소화 및 전력망 계통 부담 완화에 즉각 기여
- 비용 부담주체인 한전의 재무 우려는 인정하나, 과도한 저가 입찰은 신산업 창출과 지역경제 활성화에 기여하기 어려움

## 제언 내용
- 배터리사간 과도한 저가 입찰로 인한 출혈경쟁 방지를 위해 가격평가 비중을 완화하고 기술·안전성 평가를 강화
- 사업 초기 시장 수요를 창출하고 관련 기업들의 규모의 경제 실현을 지원하기 위해 초기 보급 물량 대폭 확대
- 화재 안전성 및 장기 성능 보증 기준을 강화하여 비가격 요소 중심의 고품질 BESS 보급 및 장기 운영 기반 구축

## 기대 효과
- 가격 중심에서 기술·안전 중심의 건전한 경쟁구도를 형성하여 관련 산업의 지속 가능한 적정 투자를 유인
- 저품질 배터리 배제로 화재 위험을 최소화하고, 10년 이상 안정적인 장기 운영을 담보할 수 있는 시스템 인프라를 확보
- 국내 배터리 생태계 활성화 및 기술 고도화에 기여하여 국내 기업의 글로벌 경쟁력 확보 가능`;

const state = {
  screen: "select", // "select" | "chat" | "report"
  selectedIds: [], // 선택된 페르소나 id 목록
  draftText: DEFAULT_DRAFT, // 협상의 오프닝(우리 측 첫 발언)

  // ── 다자 협상(라운드테이블) 상태 ──────────────────────────────────
  messages: [], // {id, role:"user"|"persona"|"system", personaId?, text, stance?, acceptability?, citationIds?, concerns?, limitation?, source?} — system은 합류 등 중앙 안내
  acceptability: {}, // personaId -> 최신 수용도(0~100)
  round: 0, // 진행된 라운드 수(우리 측 발언 횟수)
  negotiating: false, // 라운드 생성 중 여부
  pendingIds: [], // 이번 라운드에서 아직 답변 전인 페르소나(타이핑 표시용)
  chatInput: "", // 입력창 임시 값(리렌더와 무관하게 유지)

  // ── 평가·리포트(화면 ③) 상태 ──────────────────────────────────────
  report: null, // 생성된 리포트 객체(overallSummary/subscores/stakeholderOpinions/painPoints/strategyImprovements)
  reportLoading: false, // 리포트 생성(라이브 호출) 진행 중 여부

  // ── "제안 반영해 초안 수정" 상태 ───────────────────────────────────
  reviseSelected: {}, // suggestionId -> true/false (리포트 준비 시 전체 선택으로 초기화)
  revising: false, // 초안 수정(라이브 호출) 진행 중 여부
  revisedDraft: "", // 수정된 초안 결과
  reviseError: "", // 초안 수정 실패 안내

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
  state.report = null;
  state.reportLoading = false;
  state.reviseSelected = {};
  state.revising = false;
  state.revisedDraft = "";
  state.reviseError = "";
}

export { DEFAULT_DRAFT };
