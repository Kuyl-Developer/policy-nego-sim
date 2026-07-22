// 대화 메시지 → 페르소나별 최종 입장 파생 (리포트 화면 · 리포트 생성 공용)

// 대화 메시지에서 페르소나별 '최종 입장'을 도출(마지막 발언 기준)
export function deriveReactions(messages, acceptability) {
  const byId = {};
  for (const m of messages) {
    if (m.role !== "persona") continue;
    byId[m.personaId] = {
      personaId: m.personaId,
      stance: m.stance,
      acceptability: Number.isFinite(acceptability[m.personaId]) ? acceptability[m.personaId] : m.acceptability,
      summary: m.text,
      risks: m.concerns || [],
      citationIds: m.citationIds || [],
      limitation: m.limitation || "",
    };
  }
  return byId;
}

export function overallScore(reactions, ids) {
  if (!ids.length) return 0;
  const sum = ids.reduce((a, id) => a + (reactions[id]?.acceptability || 0), 0);
  return Math.round(sum / ids.length);
}
