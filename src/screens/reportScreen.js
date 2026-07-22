// 화면 ③ 평가·개선 리포트 (총평 + 서브스코어 + 수용성 + 의견 요약 + Pain Point + 더 나은 전략)

import { h } from "../lib/dom.js";
import { getState, setState } from "../lib/store.js";
import { PERSONA_BY_ID } from "../data/personas.js";
import { avatar, accentVars, stanceBadge } from "../components/common.js";
import { deriveReactions } from "../lib/reactions.js";
import { goToSelect } from "../actions.js";

const SUBSCORE_LABEL = {
  persuasiveness: "설득력",
  riskManagement: "리스크 관리",
  clarity: "메시지 명확성",
  evidence: "근거 충실도",
};

function subscoreCard(key, sub) {
  const score = sub?.score ?? 0;
  return h(
    "div",
    { class: "card subscore" },
    h(
      "div",
      { class: "subscore__head" },
      h("span", { class: "subscore__label" }, SUBSCORE_LABEL[key]),
      h("span", { class: "subscore__num" }, String(score))
    ),
    h("div", { class: "bar" }, h("div", { class: "bar__fill", style: { width: `${score}%` } })),
    sub?.note ? h("div", { class: "subscore__note" }, sub.note) : null
  );
}

function acceptabilityRow(persona, r) {
  return h(
    "div",
    { class: "accept-row", style: accentVars(persona) },
    h(
      "div",
      { class: "accept-row__id" },
      avatar(persona, { sm: true }),
      h(
        "div",
        {},
        h("div", { class: "accept-row__name" }, persona.name),
        h("div", { class: "accept-row__role" }, persona.org)
      )
    ),
    h("div", { class: "bar" }, h("div", { class: "bar__fill", style: { width: `${r.acceptability}%` } })),
    h("div", { class: "accept-row__pct" }, `${r.acceptability}%`),
    stanceBadge(r.stance)
  );
}

function opinionCard(persona, opinion, stance) {
  return h(
    "div",
    { class: "card opinion-card", style: accentVars(persona) },
    h(
      "div",
      { class: "opinion-card__head" },
      avatar(persona, { sm: true }),
      h(
        "div",
        {},
        h("div", { class: "accept-row__name" }, persona.name),
        h("div", { class: "accept-row__role" }, persona.org)
      ),
      stance ? stanceBadge(stance) : null
    ),
    h("p", { class: "opinion-card__body" }, opinion || "(의견 요약 없음)")
  );
}

function improvementItem(it, i) {
  const persona = it.personaId ? PERSONA_BY_ID[it.personaId] : null;
  const tag = persona ? `→ ${persona.name}의 ${it.issue || "이슈"} 대응` : "";
  return h(
    "div",
    { class: "improve" },
    h("div", { class: "improve__num" }, String(i + 1)),
    h(
      "div",
      {},
      h(
        "div",
        { class: "improve__title" },
        it.title,
        tag ? h("span", { class: "improve__tag" }, `  · ${tag}`) : null
      ),
      h("div", { class: "improve__body" }, it.body)
    )
  );
}

function loadingCard() {
  return h(
    "div",
    { class: "card", style: { padding: "32px", textAlign: "center", color: "var(--ink-2)" } },
    "리포트를 생성하는 중입니다…"
  );
}

function emptyCard() {
  return h(
    "div",
    { class: "card", style: { padding: "32px", textAlign: "center", color: "var(--ink-2)" } },
    "협상 대화가 없어 리포트를 생성할 수 없습니다. 먼저 모의 협상을 진행해 주세요."
  );
}

export function renderReportScreen() {
  const { selectedIds, messages, acceptability, round, report, reportLoading } = getState();
  const reactions = deriveReactions(messages, acceptability);
  const ids = selectedIds.filter((id) => reactions[id]);

  const head = h(
    "div",
    { class: "screen-head" },
    h("div", { class: "eyebrow" }, "STEP 3 · 평가·개선 리포트"),
    h("h1", {}, "협상 결과 평가"),
    h("p", {}, `${round}라운드 협상 결과입니다. 총평, 항목별 점수, 이해관계자별 반응과 초안 개선 전략을 확인하세요.`)
  );

  const toolbar = h(
    "div",
    { class: "toolbar toolbar--between" },
    h("button", { class: "btn btn--ghost", onClick: () => setState({ screen: "chat" }) }, "← 협상으로 돌아가기"),
    h("button", { class: "btn btn--primary", onClick: () => goToSelect() }, "새 시뮬레이션 시작")
  );

  if (reportLoading) {
    return h("div", { class: "fade-in" }, head, loadingCard(), toolbar);
  }
  if (!report || !ids.length) {
    return h("div", { class: "fade-in" }, head, emptyCard(), toolbar);
  }

  const overallCard = h(
    "div",
    { class: "card", style: { padding: "20px 22px" } },
    h("div", { class: "block-label" }, "총평"),
    h("p", { style: { margin: "8px 0 0", lineHeight: 1.6 } }, report.overallSummary)
  );

  const subscores = h(
    "div",
    { class: "subscore-grid" },
    Object.keys(SUBSCORE_LABEL).map((key) => subscoreCard(key, report.subscores?.[key]))
  );

  const acceptCard = h(
    "div",
    { class: "card", style: { padding: "18px 22px" } },
    h("div", { class: "block-label" }, "이해관계자별 수용성"),
    ids.map((id) => acceptabilityRow(PERSONA_BY_ID[id], reactions[id]))
  );

  const opinions = h(
    "div",
    { class: "opinion-grid" },
    ids.map((id) => opinionCard(PERSONA_BY_ID[id], report.stakeholderOpinions?.[id], reactions[id]?.stance))
  );

  const painPoints = h(
    "div",
    { class: "card", style: { padding: "18px 22px" } },
    h("div", { class: "block-label" }, "현재 Pain Point"),
    h(
      "ul",
      { class: "pain-list" },
      (report.painPoints || []).map((p) => h("li", {}, p))
    )
  );

  const improveList = h(
    "div",
    { class: "improve-list" },
    (report.strategyImprovements || []).map((it, i) => improvementItem(it, i))
  );

  return h(
    "div",
    { class: "fade-in" },
    head,
    overallCard,
    h("div", { class: "section-title" }, "항목별 점수"),
    subscores,
    acceptCard,
    h("div", { class: "section-title" }, "페르소나별 의견 요약"),
    opinions,
    painPoints,
    h("div", { class: "section-title" }, "더 나은 전략 · 초안 개선 제안"),
    improveList,
    toolbar
  );
}
