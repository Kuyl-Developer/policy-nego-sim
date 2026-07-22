// 페르소나 반응 생성용 프롬프트 구성
// 디자인 문서의 제약을 시스템 프롬프트에 명시적으로 반영한다.

// 페르소나 반응 JSON 스키마(참고용) — 모델이 이 형태로만 응답하도록 지시
export const REACTION_SCHEMA = {
  type: "object",
  properties: {
    stance: { type: "string", enum: ["support", "conditional", "concern"] },
    acceptability: { type: "integer", minimum: 0, maximum: 100 },
    summary: { type: "string", description: "입장 요약, 2~3문장" },
    risks: {
      type: "array",
      items: { type: "string" },
      minItems: 2,
      maxItems: 4,
    },
    citationIds: {
      type: "array",
      items: { type: "string" },
      description: "반드시 제공된 지식 베이스 id 중에서만 선택",
    },
    limitation: {
      type: "string",
      description: "근거가 부족할 때만 '공개자료 기반 추정·한계' 안내. 없으면 빈 문자열.",
    },
  },
  required: ["stance", "acceptability", "summary", "risks", "citationIds", "limitation"],
  additionalProperties: false,
};

export function buildSystemPrompt() {
  return [
    "당신은 대한민국 에너지·기후 정책 이해관계자를 연기하는 시뮬레이션 에이전트입니다.",
    "사용자가 작성한 'E&S(환경·사회) 대외 커뮤니케이션 전략 초안'에 대해,",
    "해당 이해관계자의 입장에서 현실적인 반응과 리스크를 제시하십시오.",
    "",
    "[반드시 지켜야 할 제약]",
    "1. 비공개·내부 미승인 정보를 절대 포함하지 마십시오.",
    "2. 확인되지 않은 발언을 사실처럼 단정(사실화)하지 마십시오.",
    "3. 근거는 반드시 아래 '지식 베이스'로 제공된 항목의 id 로만 인용하십시오.",
    "   제공되지 않은 출처를 지어내지 마십시오.",
    "4. 지식 베이스에 충분한 근거가 없으면, 답을 지어내지 말고 limitation 필드에",
    "   '공개자료 기반 추정·한계'임을 명시하고, 어떤 가정과 추가 데이터가 필요한지 안내하십시오.",
    "5. summary(입장 요약)와 risks(우려/리스크)를 합쳐 대략 250~400자 분량으로 간결하게.",
    "6. 응답은 지정된 JSON 객체 '하나'로만 출력하고, 그 외 어떤 텍스트도 덧붙이지 마십시오.",
  ].join("\n");
}

export function buildUserPrompt({ persona, kb, draftText }) {
  const kbLines = kb
    .map(
      (s) =>
        `- id: ${s.id} | [${s.tier}] ${s.title} (${s.org}, ${s.date}) — ${s.summary}`
    )
    .join("\n");

  return [
    "## 연기할 이해관계자",
    `- 이름/직위: ${persona.name} (${persona.org})`,
    `- 역할: ${persona.role}`,
    `- 우선순위: ${persona.priorities.join(", ")}`,
    `- 성향: ${persona.stanceBias}`,
    "",
    "## 인용 가능한 지식 베이스 (이 id 들만 citationIds 에 사용)",
    kbLines,
    "",
    "## 사용자의 커뮤니케이션 전략 초안",
    "```",
    (draftText || "").trim() || "(초안 내용 없음)",
    "```",
    "",
    "## 출력 형식 (JSON 객체 하나만)",
    "{",
    '  "stance": "support | conditional | concern",',
    '  "acceptability": 0~100 정수(이 이해관계자의 수용도),',
    '  "summary": "입장 요약 2~3문장",',
    '  "risks": ["우려/리스크 2~4개"],',
    '  "citationIds": ["제공된 지식 베이스 id"],',
    '  "limitation": "근거 부족 시 공개자료 기반 추정·한계 안내, 없으면 빈 문자열"',
    "}",
  ].join("\n");
}
