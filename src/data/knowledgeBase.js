// 지식 베이스(Knowledge Base) — 시드/샘플 데이터
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ 중요: 아래 출처는 데모용 "샘플(seed)" 항목입니다. 실제 크롤링 데이터로
//    교체되기 전까지는 대표성 있는 예시로만 사용하며, 페르소나 답변에서
//    인용될 때 UI에 '샘플 출처'임이 드러나도록 처리합니다.
//
// 신뢰도 티어(reliability tier) — 디자인 문서 기준:
//   t1: 기고·논문 (op-ed / paper)       → 가장 높은 신뢰도
//   t2: 보도자료 (press release)
//   t3: 일반 기사 (general article)     → 가장 낮은 신뢰도
//
// 각 항목: { id, personaId, title, org, date, url, tier, summary, sample }

export const TIER_LABEL = {
  t1: "기고·논문",
  t2: "보도자료",
  t3: "일반기사",
};

export const KNOWLEDGE_BASE = [
  // ── 기후부 ──────────────────────────────────────────────────────────
  {
    id: "kb-climate-1",
    personaId: "climate",
    title: "2035 NDC 상향 로드맵 기고",
    org: "정책 저널(샘플)",
    date: "3월 12일",
    url: "#",
    tier: "t1",
    summary: "2035년 온실가스 감축목표 상향과 재생에너지 발전 비중 확대 필요성을 논함.",
    sample: true,
  },
  {
    id: "kb-climate-2",
    personaId: "climate",
    title: "재생에너지 보급 확대 대책 보도자료",
    org: "기후에너지환경부(샘플)",
    date: "5월 3일",
    url: "#",
    tier: "t2",
    summary: "재생에너지 인허가 간소화 및 계통 연계 확대 방안 발표.",
    sample: true,
  },
  {
    id: "kb-climate-3",
    personaId: "climate",
    title: "정의로운 전환 기금 관련 기사",
    org: "일간지(샘플)",
    date: "6월 20일",
    url: "#",
    tier: "t3",
    summary: "석탄발전 감축 지역의 고용·산업 전환 지원 논의 동향.",
    sample: true,
  },

  // ── 산업부 ──────────────────────────────────────────────────────────
  {
    id: "kb-industry-1",
    personaId: "industry",
    title: "에너지 수급 안정과 산업경쟁력 기고",
    org: "산업 연구지(샘플)",
    date: "2월 28일",
    url: "#",
    tier: "t1",
    summary: "급격한 전환 시 전력 수급 리스크와 제조업 원가 부담을 지적.",
    sample: true,
  },
  {
    id: "kb-industry-2",
    personaId: "industry",
    title: "전력수급기본계획 보도자료",
    org: "산업통상자원부(샘플)",
    date: "4월 15일",
    url: "#",
    tier: "t2",
    summary: "안정적 전력 공급을 위한 전원 믹스 및 예비력 확보 방안.",
    sample: true,
  },
  {
    id: "kb-industry-3",
    personaId: "industry",
    title: "산업계 전기요금 부담 관련 기사",
    org: "경제지(샘플)",
    date: "6월 8일",
    url: "#",
    tier: "t3",
    summary: "요금 인상이 에너지 다소비 업종에 미치는 영향 취재.",
    sample: true,
  },

  // ── 한전 ────────────────────────────────────────────────────────────
  {
    id: "kb-kepco-1",
    personaId: "kepco",
    title: "요금 원가주의와 재무 정상화 기고",
    org: "전력경제 저널(샘플)",
    date: "1월 30일",
    url: "#",
    tier: "t1",
    summary: "누적적자 해소를 위한 원가 연동형 요금 체계의 필요성 논의.",
    sample: true,
  },
  {
    id: "kb-kepco-2",
    personaId: "kepco",
    title: "재무구조 개선 자구책 보도자료",
    org: "한국전력공사(샘플)",
    date: "5월 21일",
    url: "#",
    tier: "t2",
    summary: "자산 매각·비용 절감 등 재무 건전화 자구 노력 발표.",
    sample: true,
  },
  {
    id: "kb-kepco-3",
    personaId: "kepco",
    title: "송배전 계통 투자 관련 기사",
    org: "일간지(샘플)",
    date: "6월 2일",
    url: "#",
    tier: "t3",
    summary: "재생에너지 확대에 따른 계통 보강 투자 소요 보도.",
    sample: true,
  },

  // ── 가스공사 ────────────────────────────────────────────────────────
  {
    id: "kb-kogas-1",
    personaId: "kogas",
    title: "전환기 천연가스의 브릿지 역할 기고",
    org: "에너지 정책지(샘플)",
    date: "2월 10일",
    url: "#",
    tier: "t1",
    summary: "재생에너지 간헐성 보완을 위한 가스발전의 과도기 역할 강조.",
    sample: true,
  },
  {
    id: "kb-kogas-2",
    personaId: "kogas",
    title: "미수금 및 요금 정산 보도자료",
    org: "한국가스공사(샘플)",
    date: "4월 27일",
    url: "#",
    tier: "t2",
    summary: "원료비 미수금 회수 계획과 정산 단가 조정 방안 발표.",
    sample: true,
  },
  {
    id: "kb-kogas-3",
    personaId: "kogas",
    title: "LNG 도입 계약·수급 관련 기사",
    org: "산업지(샘플)",
    date: "5월 30일",
    url: "#",
    tier: "t3",
    summary: "중장기 LNG 도입 물량과 가격 변동성 대응 동향.",
    sample: true,
  },
];

export const KB_BY_PERSONA = KNOWLEDGE_BASE.reduce((acc, s) => {
  (acc[s.personaId] ||= []).push(s);
  return acc;
}, {});

export const KB_BY_ID = Object.fromEntries(KNOWLEDGE_BASE.map((s) => [s.id, s]));
