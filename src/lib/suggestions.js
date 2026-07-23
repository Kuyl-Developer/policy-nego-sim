// 리포트 → "제안 반영해 초안 수정" 화면에서 쓰는 파생 데이터
// - buildSuggestions: 개선 제안/페르소나 의견/Pain Point를 체크박스 가능한 평탄 목록으로 합침
// - buildProposalTimeline: 우리 측 발언(user)마다 페르소나별 수용도를 묶어 타임라인으로 변환

// report: {strategyImprovements, stakeholderOpinions, painPoints, ...}
// ids: 협상에 참여한(반응이 있는) personaId 목록
// personaById: PERSONA_BY_ID
export function buildSuggestions(report, ids, personaById) {
  const out = [];

  (report.strategyImprovements || []).forEach((it, i) => {
    const p = it.personaId ? personaById[it.personaId] : null;
    out.push({
      id: `imp-${i}`,
      group: "더 나은 전략",
      personaId: it.personaId || "",
      text: `${it.title}${p ? ` (대상: ${p.name})` : ""} — ${it.body}`,
    });
  });

  ids.forEach((id) => {
    const opinion = report.stakeholderOpinions?.[id];
    if (!opinion) return;
    out.push({
      id: `sum-${id}`,
      group: "페르소나 피드백",
      personaId: id,
      text: `${personaById[id].name}의 의견: ${opinion}`,
    });
  });

  (report.painPoints || []).forEach((pp, i) => {
    out.push({ id: `pain-${i}`, group: "페르소나 피드백", personaId: "", text: `해소할 우려: ${pp}` });
  });

  return out;
}

// messages: store의 대화 로그. user 발언마다 새 턴을 열고, 그 뒤 이어지는 persona 응답의
// acceptability를 모아 담는다. system(합류 안내) 메시지는 턴 구분에 관여하지 않는다.
export function buildProposalTimeline(messages) {
  const turns = [];
  let current = null;
  for (const m of messages) {
    if (m.role === "user") {
      if (current) turns.push(current);
      current = { text: m.text, acc: {} };
    } else if (m.role === "persona" && current) {
      current.acc[m.personaId] = m.acceptability;
    }
  }
  if (current) turns.push(current);
  return turns;
}
