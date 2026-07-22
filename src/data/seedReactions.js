// 시드(오프라인·목업) 반응 데이터
// ─────────────────────────────────────────────────────────────────────────
// API 키 없이도 데모가 완결되도록, 각 페르소나의 "일반적인 E&S 대외 커뮤니케이션
// 전략 초안"에 대한 기본 입장을 손으로 작성해 둔 것.
// 실제 라이브 모드에서는 lib/anthropic.js 가 전략 초안 내용을 반영해 동적으로 생성한다.
//
// 형식(디자인 문서 기준):
//   stance        : "support" | "conditional" | "concern"  (찬성/조건부/우려)
//   acceptability : 0~100 수용도 점수
//   summary       : 입장 요약 (2~3문장)
//   risks         : Concern/Risk 불릿 (2~4개)
//   citationIds   : 근거 출처(지식 베이스 id) — UI에서 출처 칩+링크로 렌더
//   limitation    : (선택) 근거 부족 시 '공개자료 기반 추정·한계' 안내

export const SEED_REACTIONS = {
  climate: {
    personaId: "climate",
    stance: "conditional",
    acceptability: 62,
    summary:
      "감축 목표와 재생에너지 확대라는 방향성에는 원칙적으로 공감합니다. 다만 이번 초안이 화석연료 발전의 존치 기간을 명확히 하지 않아, 2035 NDC 경로와의 정합성이 약해 보입니다. 감축 이행 지표와 연도별 이정표가 함께 제시되어야 대외적으로 신뢰를 얻을 수 있습니다.",
    risks: [
      "연도별 감축 이정표·재생에너지 비중 목표가 불명확해 NDC 후퇴로 해석될 여지",
      "정의로운 전환(고용·지역 지원) 재원과 대상이 빠져 형평성 논란 가능",
      "가스·석탄 브릿지 표현이 과도하면 국제 사회에 잘못된 신호",
    ],
    citationIds: ["kb-climate-1", "kb-climate-2"],
  },

  industry: {
    personaId: "industry",
    stance: "conditional",
    acceptability: 55,
    summary:
      "전환의 필요성에는 동의하나, 산업 현장의 수급 안정과 원가 부담을 먼저 짚어야 합니다. 초안은 전원 믹스 조정의 속도만 강조하고, 예비력 확보와 전기요금 영향에 대한 완충 장치가 보이지 않습니다. 산업계 예측 가능성을 높일 이행 로드맵이 필요합니다.",
    risks: [
      "재생에너지 간헐성에 대한 백업·예비력 확보 방안 부재",
      "전기요금 인상이 에너지 다소비 업종 경쟁력에 미칠 영향 미검토",
      "투자·공급망 전환에 필요한 리드타임과 지원책 미제시",
    ],
    citationIds: ["kb-industry-1", "kb-industry-2"],
  },

  kepco: {
    personaId: "kepco",
    stance: "concern",
    acceptability: 41,
    summary:
      "방향에는 반대하지 않지만, 비용 회수 구조가 빠진 전환 메시지는 수용하기 어렵습니다. 계통 보강과 재생에너지 연계에는 대규모 투자가 필요한데, 원가주의 요금 정상화와 재무 회수 경로가 초안에 담겨 있지 않습니다. 자칫 부담이 공기업에 전가되는 구조로 읽힙니다.",
    risks: [
      "계통 보강·송배전 투자 재원 조달 방안 부재로 재무 부담 가중 우려",
      "요금 정상화(원가 연동) 언급이 없어 누적적자 해소 경로 불투명",
      "비용의 공기업 전가 프레임으로 해석될 대외 리스크",
    ],
    citationIds: ["kb-kepco-1", "kb-kepco-2"],
    limitation:
      "요금·재무 영향의 정량 추정은 공개된 요금 산정 근거가 제한적이라 확정할 수 없습니다. 추가로 최근 요금 산정 내역과 투자계획 자료가 필요합니다.",
  },

  kogas: {
    personaId: "kogas",
    stance: "conditional",
    acceptability: 58,
    summary:
      "재생에너지 확대 기조에 협력하되, 전환기 천연가스의 교량 역할이 초안에 반영되길 바랍니다. 급격한 탈가스 신호는 도입 계약과 수급 안정에 부담이 됩니다. 아울러 미수금 회수와 정산 구조에 대한 언급이 없어, 재무 지속가능성 측면의 보완이 필요합니다.",
    risks: [
      "브릿지 연료로서 가스 역할이 빠져 수급·계약 안정성 저해 우려",
      "원료비 미수금 회수 경로 미반영으로 재무 지속가능성 불확실",
      "LNG 가격 변동성 대응 전략 부재",
    ],
    citationIds: ["kb-kogas-1", "kb-kogas-2"],
  },
};

// 전략 초안의 키워드를 가볍게 반영해 수용도를 미세 조정(데모용 휴리스틱).
// 라이브 모드가 아닐 때 초안 내용이 반응에 "조금은" 반영되도록 하는 장치.
export function adjustAcceptability(base, draftText, personaId) {
  const t = (draftText || "").toLowerCase();
  const has = (...kws) => kws.some((k) => t.includes(k));
  let delta = 0;
  const map = {
    climate: () => {
      if (has("재생", "감축", "ndc", "탄소중립")) delta += 8;
      if (has("정의로운 전환", "고용", "지역")) delta += 6;
      if (has("석탄", "화석")) delta -= 4;
    },
    industry: () => {
      if (has("수급", "예비력", "안정")) delta += 8;
      if (has("요금", "원가", "부담 완화", "지원")) delta += 5;
      if (has("급격", "즉시 중단")) delta -= 5;
    },
    kepco: () => {
      if (has("요금 정상화", "원가주의", "재무", "회수")) delta += 10;
      if (has("계통", "투자 재원", "송배전")) delta += 5;
      if (has("동결", "전가")) delta -= 5;
    },
    kogas: () => {
      if (has("브릿지", "교량", "전환기 가스", "lng")) delta += 8;
      if (has("미수금", "정산")) delta += 6;
      if (has("탈가스", "가스 퇴출")) delta -= 6;
    },
  };
  map[personaId]?.();
  return Math.max(5, Math.min(95, base + delta));
}
