// 다자 협상(라운드테이블) 대화용 프롬프트 구성
// ─────────────────────────────────────────────────────────────────────────
// 각 페르소나는 회의록(transcript) 전체를 보고, '우리 측(제안자)'의 최신 발언에
// 대해 자기 입장에서 대화체로 대응한다. 동시에 협상 상태(입장·수용도·근거)를
// 구조화해 함께 반환한다. 디자인 문서의 제약(비공개정보 금지·미확인 사실화 금지·
// 근거 인용·근거부족 시 한계 명시)을 시스템 프롬프트에 명시한다.

// 페르소나 응답 JSON 스키마(참고용)
export const REPLY_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "대화체 답변(2~5문장). 상대 논리에 반응." },
    stance: { type: "string", enum: ["support", "conditional", "concern"] },
    acceptability: { type: "integer", minimum: 0, maximum: 100 },
    citationIds: { type: "array", items: { type: "string" } },
    concerns: { type: "array", items: { type: "string" }, maxItems: 3 },
    limitation: { type: "string" },
  },
  required: ["reply", "stance", "acceptability", "citationIds", "concerns", "limitation"],
  additionalProperties: false,
};

export function buildChatSystemPrompt(persona) {
  return [
    `당신은 대한민국 에너지·기후 정책 협상 테이블에 앉은 "${persona.name}"(${persona.org}) 역할을 연기합니다.`,
    "'우리 측(제안자)'은 SK이노베이션 E&S(민간 기업)의 담당자이며, 당신과 같은 정부·공기업 소속이 아닙니다.",
    "당신은 그 자리의 다른 참석자(정부·공기업 인사)들과 함께, 자신의 소속과 이해관계에 충실하게 실시간으로 대응합니다.",
    "",
    "[연기 지침]",
    "- 1인칭으로, 실제 고위 책임자가 회의에서 말하듯 자연스러운 대화체(존댓말)로 답하십시오.",
    "- 상대의 '최신 발언'에 직접 반응하십시오. 설득력이 있으면 인정하고, 미흡하면 구체적으로 반박·조건을 제시하십시오.",
    "- 다른 참석자의 발언도 회의록에 있으면 참고해 견제하거나 동조할 수 있습니다.",
    "- 매번 같은 말을 반복하지 말고 대화를 진전시키십시오. 납득되면 입장을 실제로 바꾸십시오.",
    "- '우리 측(제안자)'을 부를 때는 '장관님'처럼 정부·공기업 동료를 부르는 호칭을 절대 쓰지 마십시오. 반드시 'E&S 담당자님' 또는 무호칭으로 답하십시오.",
    "",
    "[반드시 지켜야 할 제약]",
    "1. 비공개·내부 미승인 정보를 절대 포함하지 마십시오.",
    "2. 확인되지 않은 발언을 사실처럼 단정(사실화)하지 마십시오.",
    "3. 근거는 반드시 아래 '지식 베이스'로 제공된 항목의 id 로만 인용(citationIds)하십시오. 없는 출처를 지어내지 마십시오.",
    "4. 근거가 부족하면 지어내지 말고 limitation 에 '공개자료 기반 추정·한계'임을 밝히고 필요한 추가 자료를 안내하십시오.",
    "5. acceptability(0~100)는 '지금까지의 대화로 이 제안을 수용할 수 있는 정도'입니다. 설득되면 올리고, 우려가 남으면 낮게 유지하십시오.",
    "",
    "[출력 형식] 반드시 emit_reply 도구를 호출해 구조화된 값으로만 반환하십시오. 자유 텍스트로 답하지 마십시오.",
    "- reply: 대화체 답변 2~5문장.",
    "- stance: support | conditional | concern 중 하나.",
    "- acceptability: 0~100 정수.",
    "- citationIds: 제공된 지식 베이스 id 만.",
    "- concerns: 아직 남은 우려 0~3개.",
    "- limitation: 근거 부족 시 안내, 없으면 빈 문자열.",
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────
// 화면 ③ 평가·리포트 생성 프롬프트
// 협상 종료 시 1회 호출해 총평·서브스코어·페르소나별 의견·Pain Point·개선 전략을
// 한 번에 구조화된 JSON 으로 받는다. "더 나은 전략"은 반드시 최초 작성된
// draftText 의 구체적 문구를 지목해 어떻게 고칠지 제안해야 한다(사용자 요구사항).

export const REPORT_SCHEMA = {
  type: "object",
  properties: {
    overallSummary: { type: "string" },
    subscores: {
      type: "object",
      properties: {
        persuasiveness: { type: "object", properties: { score: { type: "integer" }, note: { type: "string" } } },
        riskManagement: { type: "object", properties: { score: { type: "integer" }, note: { type: "string" } } },
        clarity: { type: "object", properties: { score: { type: "integer" }, note: { type: "string" } } },
        evidence: { type: "object", properties: { score: { type: "integer" }, note: { type: "string" } } },
      },
    },
    stakeholderOpinions: {
      type: "array",
      items: {
        type: "object",
        properties: { personaId: { type: "string" }, opinion: { type: "string" } },
        required: ["personaId", "opinion"],
      },
    },
    painPoints: { type: "array", items: { type: "string" } },
    // 개선 제안은 (제목/이해관계자/이슈/본문) 4요소를 '같은 길이의 평행 배열' 4개로 나눠 받는다.
    // i번째 항목끼리 하나의 제안을 이룬다. 다필드 객체 배열로 두면 모델이 이 필드를 통째로
    // JSON 문자열로 직렬화하며 본문 속 따옴표를 깨뜨리는 사례가 있어, 단순 문자열 배열로 평탄화한다.
    improvementTitles: { type: "array", items: { type: "string" } },
    improvementPersonaIds: { type: "array", items: { type: "string" } },
    improvementIssues: { type: "array", items: { type: "string" } },
    improvementBodies: { type: "array", items: { type: "string" } },
  },
  required: [
    "overallSummary",
    "subscores",
    "stakeholderOpinions",
    "painPoints",
    "improvementTitles",
    "improvementPersonaIds",
    "improvementIssues",
    "improvementBodies",
  ],
  additionalProperties: false,
};

export function buildReportSystemPrompt() {
  return [
    "당신은 대외 커뮤니케이션 전략을 평가하는 시니어 컨설턴트입니다.",
    "방금 끝난 다자 이해관계자 모의 협상(라운드테이블) 회의록을 검토하고, 발표 전 위험도를 평가한 리포트를 작성합니다.",
    "",
    "[반드시 지켜야 할 제약]",
    "1. 비공개·내부 미승인 정보를 절대 포함하지 마십시오.",
    "2. 확인되지 않은 내용을 사실처럼 단정(사실화)하지 마십시오. 근거는 제공된 회의록·이해관계자 발언에만 기반하십시오.",
    "3. 과장하거나 근거 없는 낙관/비관을 제시하지 마십시오.",
    "",
    "[서브스코어 채점 기준] 각 0~100 정수, note 는 1문장 근거.",
    "- persuasiveness(설득력): 초안 논리가 이해관계자를 얼마나 설득했는가.",
    "- riskManagement(리스크 관리): 남은 우려·반발 리스크가 얼마나 통제됐는가(우려가 많고 강할수록 낮게).",
    "- clarity(메시지 명확성): 제안이 명확하고 구체적으로 전달됐는가.",
    "- evidence(근거 충실도): 제안이 공개자료·근거로 뒷받침되는가(한계 표명이 많을수록 낮게).",
    "",
    "[더 나은 전략 — strategyImprovements, 가장 중요]",
    "- 반드시 아래 사용자 메시지에 포함된 '원본 커뮤니케이션 전략 초안(draftText)'의 실제 문장·항목을 지목하고,",
    "  그 문장을 회의록에서 드러난 우려에 맞춰 '이렇게 수정/추가하십시오' 식으로 구체적으로 다시 쓰십시오.",
    "- 일반론(예: '근거를 보강하세요')이 아니라 초안을 실제로 고친 대체 문장 또는 추가 문단을 제시하십시오.",
    "- title 은 짧은 제목, personaId 는 이 개선이 겨냥하는 이해관계자 id, issue 는 그 이해관계자의 핵심 이슈 한 단어/구.",
    "- 우선순위(수용도 낮은 이해관계자, 강한 우려)가 높은 순으로 3~5개 제시하십시오.",
    "- 원본 문구를 인용할 때는 자연스럽게 따옴표를 사용해도 됩니다(예: '이 문장' 또는 \"이 문장\").",
    "",
    "[personaId 규칙 — 반드시 준수]",
    "- stakeholderOpinions 와 strategyImprovements 의 personaId 는 반드시 아래 사용자 메시지에 명시된",
    "  이해관계자 id(예: climate/industry/kepco/kogas) 중 하나를 그대로 사용하십시오. 이름·소속이 아니라 id 값입니다.",
    "- stakeholderOpinions 는 협상에 참여한 모든 이해관계자에 대해 각각 한 항목씩 빠짐없이 포함하십시오.",
    "",
    "[출력 형식] 반드시 emit_report 도구를 호출해 구조화된 값으로만 반환하십시오. 자유 텍스트로 답하지 마십시오.",
    "- overallSummary: 회의 전체를 요약하는 2~4문장 총평.",
    "- subscores: persuasiveness/riskManagement/clarity/evidence 각각 {score:0~100, note:'1문장 근거'}.",
    "- stakeholderOpinions: [{personaId, opinion: 이 이해관계자의 최종 입장을 요약한 2~3문장}] — 참여한 모든 이해관계자.",
    "- painPoints: 현재 초안의 문제점 3~5개(짧은 문장).",
    "- 개선 제안은 아래 4개의 '평행 배열'로 나눠 담으십시오. 네 배열의 길이는 반드시 같고,",
    "  같은 인덱스(i번째) 항목끼리 하나의 개선 제안을 이룹니다. 3~5개 항목을 권장합니다.",
    "  · improvementTitles[i]: 짧은 제목.",
    "  · improvementPersonaIds[i]: 이 개선이 겨냥하는 이해관계자 id(위 personaId 규칙 준수).",
    "  · improvementIssues[i]: 그 이해관계자의 핵심 이슈 한 단어/구.",
    "  · improvementBodies[i]: 초안의 어느 문구를 어떻게 고칠지 구체적으로 다시 쓴 본문(원문 인용 포함).",
  ].join("\n");
}

// reactions: { [personaId]: {stance, acceptability, summary, risks, limitation} }
export function buildReportUserPrompt({ draftText, personas, reactions, transcript }) {
  const personaLines = personas
    .map((p) => {
      const r = reactions[p.id];
      if (!r) return null;
      return [
        `### ${p.name} (${p.org}) — personaId: ${p.id}`,
        `- 최종 입장: ${r.stance} / 수용도: ${r.acceptability}%`,
        `- 최근 발언 요지: ${r.summary}`,
        r.risks?.length ? `- 남은 우려: ${r.risks.join(" / ")}` : null,
        r.limitation ? `- 근거 한계: ${r.limitation}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .filter(Boolean)
    .join("\n\n");

  const log = transcript.map((t) => `${t.speaker}: ${t.text}`).join("\n\n");

  return [
    "## 원본 커뮤니케이션 전략 초안(draftText) — '더 나은 전략'에서 이 원문을 직접 인용해 수정 제안하십시오",
    draftText,
    "",
    "## 이해관계자별 최종 입장",
    personaLines,
    "",
    "## 전체 협상 회의록",
    log,
    "",
    "지정된 JSON 객체 하나만 출력하십시오.",
  ].join("\n");
}

// transcript: [{ speaker, text }] — speaker 는 "우리 측(제안자)" 또는 페르소나 이름
export function buildChatUserPrompt({ persona, kb, transcript }) {
  const kbLines = kb.length
    ? kb
        .map((s) => `- id: ${s.id} | [${s.tier}] ${s.title} (${s.org}, ${s.date}) — ${s.summary}`)
        .join("\n")
    : "(제공된 지식 베이스 없음 — 이 경우 근거 인용 없이 신중히 답하고 limitation 에 한계를 밝히십시오.)";

  const log = transcript
    .map((t) => `${t.speaker}: ${t.text}`)
    .join("\n\n");

  return [
    "## 당신(연기할 이해관계자)",
    `- 이름/직위: ${persona.name} (${persona.org})`,
    `- 역할: ${persona.role}`,
    `- 우선순위: ${persona.priorities.join(", ")}`,
    `- 기본 성향: ${persona.stanceBias}`,
    "",
    "## 인용 가능한 지식 베이스 (이 id 들만 citationIds 에 사용)",
    kbLines,
    "",
    "## 지금까지의 협상 회의록",
    log,
    "",
    `이제 "${persona.name}"로서, 회의록에서 '우리 측(제안자)'의 가장 최근 발언에 답하십시오.`,
    "지정된 JSON 객체 하나만 출력하십시오.",
  ].join("\n");
}
