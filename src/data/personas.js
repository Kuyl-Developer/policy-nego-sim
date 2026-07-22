// 4개 이해관계자 페르소나 시드 데이터
// 디자인 가이드: 페르소나별 파스텔 강조색은 아이콘/말풍선 테두리에만 적용
//   산업부(Industry)=blue, 기후부(Climate)=green, 한전(KEPCO)=yellow, 가스공사(KOGAS)=sky blue
//
// avatar: 인물 사진 아이콘 자리. 실제 이미지가 준비되면 `photo` 경로를 채우면 되고,
//         비어 있으면 이모지 플레이스홀더(`emoji`)로 대체 렌더링한다.

export const PERSONAS = [
  {
    id: "climate",
    name: "기후부 장관",
    org: "기후에너지환경부",
    role: "온실가스 감축·에너지 전환 총괄",
    accent: "var(--p-climate)",
    accentBg: "var(--p-climate-bg)",
    emoji: "🌱",
    photo: "",
    // 핵심 관점 / 이 페르소나가 전략 초안을 볼 때 우선 점검하는 축
    priorities: [
      "NDC(국가 온실가스 감축목표) 정합성",
      "재생에너지 확대 속도",
      "정의로운 전환(고용·지역)",
    ],
    stanceBias: "감축 목표에 부합하면 우호적이나, 화석연료 존치 신호에는 강하게 우려",
    tags: ["감축목표", "재생에너지", "정의로운 전환"],
  },
  {
    id: "industry",
    name: "산업부 장관",
    org: "산업통상자원부",
    role: "산업경쟁력·에너지 수급 안정 총괄",
    accent: "var(--p-industry)",
    accentBg: "var(--p-industry-bg)",
    emoji: "🏭",
    photo: "",
    priorities: [
      "전력·에너지 수급 안정",
      "산업계 부담(전기요금·원가)",
      "공급망·투자 예측 가능성",
    ],
    stanceBias: "전환 방향엔 동의하나 수급 안정과 산업 비용 영향에 조건부",
    tags: ["수급안정", "산업경쟁력", "전기요금"],
  },
  {
    id: "kepco",
    name: "한전 사장",
    org: "한국전력공사",
    role: "전력 계통 운영·재무 건전성 책임",
    accent: "var(--p-kepco)",
    accentBg: "var(--p-kepco-bg)",
    emoji: "⚡",
    photo: "",
    priorities: [
      "재무구조 개선(누적적자)",
      "요금 정상화(원가주의)",
      "계통 안정·송배전 투자",
    ],
    stanceBias: "요금·재무 회수 방안이 명확할 때만 수용, 비용 전가 우려 민감",
    tags: ["재무건전성", "요금정상화", "계통투자"],
  },
  {
    id: "kogas",
    name: "가스공사 사장",
    org: "한국가스공사",
    role: "천연가스 도입·공급, 미수금 관리",
    accent: "var(--p-kogas)",
    accentBg: "var(--p-kogas-bg)",
    emoji: "🔥",
    photo: "",
    priorities: [
      "LNG 도입·수급 안정",
      "미수금 회수",
      "전환기 가스 역할(브릿지)",
    ],
    stanceBias: "가스의 전환기 교량 역할 인정을 원하며, 급격한 탈가스에 우려",
    tags: ["LNG수급", "미수금", "브릿지연료"],
  },
];

export const PERSONA_BY_ID = Object.fromEntries(PERSONAS.map((p) => [p.id, p]));
