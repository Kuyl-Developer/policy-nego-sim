// 화면 ③ 평가·개선 리포트 (총평 + 서브스코어 + 수용성 + 의견 요약 + Pain Point + 더 나은 전략)

import { h } from "../lib/dom.js";
import { getState, setState } from "../lib/store.js";
import { PERSONA_BY_ID } from "../data/personas.js";
import { avatar, accentVars, stanceBadge } from "../components/common.js";
import { deriveReactions } from "../lib/reactions.js";
import { buildSuggestions, buildProposalTimeline } from "../lib/suggestions.js";
import { goToSelect, toggleSuggestion, reviseDraft, applyRevisedDraft } from "../actions.js";

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
  const celebrate = r.acceptability >= 70;
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
    h(
      "div",
      { class: "accept-row__pct" + (celebrate ? " pct-celebrate" : "") },
      `${r.acceptability}%`,
      celebrate ? h("span", { class: "pct-sparkle" }, "✨") : null
    ),
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

// 체크박스 한 항목 — 대상 페르소나가 있으면 아바타를 함께 표시
function suggestionItem(s, selected, revising) {
  const persona = s.personaId ? PERSONA_BY_ID[s.personaId] : null;
  return h(
    "label",
    { class: `revise-item${selected ? " on" : ""}` },
    h("input", {
      type: "checkbox",
      checked: selected,
      disabled: revising,
      onChange: () => toggleSuggestion(s.id),
    }),
    persona ? avatar(persona, { sm: true }) : null,
    h("span", {}, s.text)
  );
}

// "제안 반영해 초안 수정" 카드 — 리포트의 개선 제안·페르소나 의견·Pain Point를
// 체크박스로 묶어 보여주고, 선택한 제안만 반영해 초안을 다시 쓰는 액션을 제공한다.
function reviseCard(report, ids, draftText, reviseSelected, revising, revisedDraft, reviseError) {
  const suggestions = buildSuggestions(report, ids, PERSONA_BY_ID);
  if (!suggestions.length) return null;

  const groups = ["더 나은 전략", "페르소나 피드백"];
  const groupBlocks = groups
    .map((g) => {
      const items = suggestions.filter((s) => s.group === g);
      if (!items.length) return null;
      return h(
        "div",
        { class: "revise-group" },
        h("div", { class: "block-label" }, g),
        items.map((s) => suggestionItem(s, !!reviseSelected[s.id], revising))
      );
    })
    .filter(Boolean);

  const selectedCount = suggestions.filter((s) => reviseSelected[s.id]).length;

  const compare =
    revising || revisedDraft
      ? h(
          "div",
          { class: "revise-compare" },
          h(
            "div",
            { class: "revise-col" },
            h("div", { class: "revise-col-head" }, "원본 초안"),
            h("div", { class: "revise-col-body" }, draftText)
          ),
          h(
            "div",
            { class: "revise-col" },
            h("div", { class: "revise-col-head" }, revising ? "수정본 · 작성 중…" : "수정본"),
            h("div", { class: "revise-col-body" }, revisedDraft || "…")
          )
        )
      : null;

  const applyRow =
    revisedDraft && !revising
      ? h(
          "div",
          { class: "toolbar", style: { marginTop: "10px" } },
          h(
            "button",
            { class: "btn btn--primary", onClick: () => applyRevisedDraft() },
            "이 초안으로 다시 시뮬레이션 시작 →"
          )
        )
      : null;

  return h(
    "div",
    { class: "card", style: { padding: "18px 22px" } },
    h("div", { class: "block-label" }, "✍️ 제안 반영해 초안 수정"),
    h(
      "p",
      { style: { margin: "6px 0 14px", color: "var(--ink-2)", fontSize: "13px" } },
      "반영할 제안을 선택하세요. 선택한 항목만 수정 초안에 반영됩니다."
    ),
    h("div", { class: "revise-suggestions" }, groupBlocks),
    reviseError ? h("div", { class: "callout", style: { marginTop: "12px" } }, reviseError) : null,
    h(
      "div",
      { class: "toolbar", style: { marginTop: "12px" } },
      h(
        "button",
        {
          class: "btn btn--primary",
          disabled: revising || selectedCount === 0,
          onClick: () => reviseDraft(),
        },
        revising ? "초안 수정 중…" : `선택한 ${selectedCount}개 제안으로 초안 수정`
      )
    ),
    compare,
    applyRow
  );
}

// "내가 제안한 내용 · 수용도 변화" 카드 — 우리 측 발언마다 페르소나별 수용도와
// 직전 발언 대비 변화를 타임라인으로 보여준다.
function timelineCard(messages, ids) {
  const turns = buildProposalTimeline(messages);
  if (!turns.length) return null;

  const rows = turns.map((t, i) => {
    const pills = ids.map((id) => {
      const persona = PERSONA_BY_ID[id];
      const cur = t.acc[id];
      let prev = null;
      for (let k = i - 1; k >= 0 && prev == null; k--) {
        if (Number.isFinite(turns[k].acc[id])) prev = turns[k].acc[id];
      }
      const has = Number.isFinite(cur);
      const delta = has && Number.isFinite(prev) ? cur - prev : null;
      return h(
        "span",
        { class: "accept-pill", style: accentVars(persona), title: persona.name },
        avatar(persona, { sm: true }),
        has ? h("strong", {}, `${cur}%`) : h("span", { class: "pill-na" }, "–"),
        delta != null && delta !== 0
          ? h("em", { class: delta > 0 ? "up" : "down" }, `${delta > 0 ? "▲" : "▼"}${Math.abs(delta)}`)
          : null
      );
    });
    return h(
      "li",
      {},
      h("div", { class: "proposal-index" }, i === 0 ? "전략 초안" : `후속 ${i}`),
      h("div", { class: "proposal-text" }, t.text),
      h("div", { class: "proposal-accept" }, pills)
    );
  });

  return h(
    "div",
    { class: "card", style: { padding: "18px 22px", marginTop: "16px" } },
    h("div", { class: "block-label" }, "🗣 내가 제안한 내용 · 수용도 변화"),
    h(
      "p",
      { style: { margin: "6px 0 14px", color: "var(--ink-2)", fontSize: "13px" } },
      "각 발언이 이해관계자 수용도를 어떻게 움직였는지 비교해 보세요."
    ),
    h("ol", { class: "proposal-timeline" }, rows)
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
  const {
    selectedIds,
    messages,
    acceptability,
    round,
    report,
    reportLoading,
    draftText,
    reviseSelected,
    revising,
    revisedDraft,
    reviseError,
  } = getState();
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

  // 4개 서브스코어 평균으로 종합 점수 산출 (없으면 0)
  const subVals = Object.keys(SUBSCORE_LABEL)
    .map((key) => report.subscores?.[key]?.score)
    .filter((v) => typeof v === "number");
  const overallScore = subVals.length
    ? Math.round(subVals.reduce((a, b) => a + b, 0) / subVals.length)
    : 0;

  const overallCard = h(
    "div",
    { class: "card hero-score", style: { "--val": String(overallScore) } },
    h(
      "div",
      { class: "hero-score__ring" },
      h(
        "div",
        { class: "hero-score__val" },
        h("div", { class: "hero-score__num" }, String(overallScore), h("span", {}, "/100")),
        h("div", { class: "hero-score__caption" }, "종합 점수")
      )
    ),
    h(
      "div",
      { class: "hero-score__body" },
      h("div", { class: "hero-score__label" }, "총평"),
      h("p", { class: "hero-score__summary" }, report.overallSummary)
    )
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

  const revise = reviseCard(report, ids, draftText, reviseSelected, revising, revisedDraft, reviseError);
  const timeline = timelineCard(messages, ids);

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
    revise,
    timeline,
    toolbar
  );
}
