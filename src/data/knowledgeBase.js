// 지식 베이스(Knowledge Base) — 앱이 사용하는 안정적 인터페이스 계층
// ─────────────────────────────────────────────────────────────────────────
// 데이터 배열 자체는 `knowledgeBase.data.js` 에 있고, 그 파일은
// `scripts/build_kb.py` 가 data/collected/*.csv 를 병합해 생성/덮어씁니다.
// 이 파일은 데이터가 어디서 오든 앱이 쓰는 export(파생 인덱스·라벨)를
// 고정으로 제공하므로, 데이터가 교체돼도 앱 코드는 바뀌지 않습니다.
//
// 신뢰도 티어(reliability tier) — 디자인 문서 기준:
//   t1: 기고·논문 (op-ed / paper)       → 가장 높은 신뢰도
//   t2: 보도자료 (press release)
//   t3: 일반 기사 (general article)     → 가장 낮은 신뢰도
//
// 각 항목: { id, personaId, title, org, date, url, tier, summary, sample }

import { KNOWLEDGE_BASE } from "./knowledgeBase.data.js";

export const TIER_LABEL = {
  t1: "기고·논문",
  t2: "보도자료",
  t3: "일반기사",
};

export { KNOWLEDGE_BASE };

export const KB_BY_PERSONA = KNOWLEDGE_BASE.reduce((acc, s) => {
  (acc[s.personaId] ||= []).push(s);
  return acc;
}, {});

export const KB_BY_ID = Object.fromEntries(KNOWLEDGE_BASE.map((s) => [s.id, s]));
