// 화면 간 상태 저장소 (아주 단순한 pub/sub)

// 더미 초안: SK이노베이션 E&S 사업(LNG 밸류체인·재생에너지·수소·CCUS)을 반영한 예시.
// 4개 페르소나 모두에게서 서로 다른 반응을 끌어내도록 구성 — 자유롭게 수정하세요.
const DEFAULT_DRAFT = `## 제안 배경
- 국가 온실가스 감축목표(NDC) 상향과 에너지 전환이 가속되는 국면에서, SK이노베이션 E&S는 LNG 직수입·발전·도시가스 밸류체인에 더해 재생에너지·청정수소·CCUS 사업을 함께 보유하고 있습니다.
- 급격한 화석연료 퇴출 논의 속에서도 전력수급 안정과 감축을 동시에 달성하려면, 가스의 '전환기 교량(bridge)' 역할과 청정에너지로의 단계적 이행 경로를 명확히 제시할 필요가 있습니다.
- 이에 저탄소 LNG와 청정수소를 축으로 한 전환 로드맵을 대외 발표하여 정책·시장의 신뢰를 확보하고자 합니다.

## 정책 제언
- LNG를 2040년까지 '전환기 교량 연료'로 공식 인정하고, CCUS와 결합한 저탄소 LNG에 대해 배출계수 반영과 인센티브를 마련해 주십시오.
- 청정수소(블루→그린) 전환을 위해 수소발전 입찰시장(CHPS)과 차액계약(CfD)을 확대하고, 수소 혼소·전소 인프라 전환 비용의 분담 방안을 함께 설계해 주십시오.
- 재생에너지 계통 접속·출력제어 보상을 제도화하고, 장기 전력구매계약(PPA)을 활성화해 투자 예측 가능성을 높여 주십시오.
- 도시가스 요금 체계를 합리화하되, 전환 비용이 특정 주체(한전·소비자)에게 일방적으로 전가되지 않도록 회수 방안을 병행해 주십시오.

## 기대 효과
- 감축 목표에 부합하는 현실적 전환 경로를 제시해 좌초자산 리스크를 완화합니다.
- 전력수급 안정성을 확보하면서 온실가스 감축을 병행할 수 있습니다.
- 청정수소 경제를 선도하고 국내 청정에너지 투자·일자리를 창출합니다.
- 대외 발표 시 이해관계자 신뢰를 확보하고 규제 불확실성을 축소합니다.`;

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
