// 화면 ③ 평가·개선 리포트 (스코어카드 + 수용도 바 + 개선 전략)

import { h } from "../lib/dom.js";
import { getState, setState } from "../lib/store.js";
import { PERSONA_BY_ID } from "../data/personas.js";
import { avatar, accentVars, stanceBadge } from "../components/common.js";
import { goToSelect } from "../actions.js";

// 대화 메시지에서 페르소나별 '최종 입장'을 도출(마지막 발언 기준)
function deriveReactions(messages, acceptability) {
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

function overallScore(reactions, ids) {
  if (!ids.length) return 0;
  const sum = ids.reduce((a, id) => a + (reactions[id]?.acceptability || 0), 0);
  return Math.round(sum / ids.length);
}

function scoreVerdict(score) {
  if (score >= 70) return { label: "대체로 수용 가능", tone: "긍정적", desc: "핵심 이해관계자 다수가 우호적입니다. 잔여 우려만 보완하면 대외 발표 리스크가 낮습니다." };
  if (score >= 50) return { label: "조건부 수용", tone: "보완 필요", desc: "방향성엔 공감하나 조건이 붙습니다. 아래 개선 전략을 반영해 재점검하세요." };
  return { label: "수용 곤란", tone: "리스크 높음", desc: "핵심 이해관계자의 반발이 예상됩니다. 발표 전 메시지·근거 보완이 필요합니다." };
}

function scorecard(score) {
  const v = scoreVerdict(score);
  const ring = h(
    "div",
    { class: "score-ring", style: { "--v": String(score) } },
    h(
      "div",
      { class: "score-ring__inner" },
      h("div", { class: "score-ring__num" }, String(score)),
      h("div", { class: "score-ring__label" }, "종합 수용도")
    )
  );
  return h(
    "div",
    { class: "card scorecard" },
    ring,
    h(
      "div",
      { class: "scorecard__summary" },
      h("h2", {}, v.label),
      h("p", {}, v.desc)
    )
  );
}

function metrics(reactions, ids) {
  const count = (s) => ids.filter((id) => reactions[id]?.stance === s).length;
  const items = [
    { k: "찬성", v: count("support") },
    { k: "조건부", v: count("conditional") },
    { k: "우려", v: count("concern") },
  ];
  return h(
    "div",
    { class: "metrics" },
    items.map((m) => h("div", { class: "metric" }, h("div", { class: "metric__v" }, String(m.v)), h("div", { class: "metric__k" }, m.k)))
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

// 개선 전략: 페르소나별 대표 우려 + 한계 안내를 실행 제언으로 정리
function improvementItems(reactions, ids) {
  const items = [];
  // 수용도 낮은 순으로 정렬해 우선순위 부여
  const sorted = [...ids].sort((a, b) => (reactions[a]?.acceptability || 0) - (reactions[b]?.acceptability || 0));
  for (const id of sorted) {
    const persona = PERSONA_BY_ID[id];
    const r = reactions[id];
    if (!r) continue;
    const topRisk = r.risks?.[0];
    if (topRisk) {
      items.push({
        title: `${persona.name} 우려 해소`,
        body: `${topRisk} — 해당 지점을 초안에 명시적으로 보완하세요.`,
        tag: r.stance === "concern" ? "우선순위 높음" : "",
      });
    }
    if (r.limitation) {
      items.push({
        title: `${persona.name} 근거 보강`,
        body: r.limitation,
        tag: "데이터 필요",
      });
    }
  }
  if (!items.length) {
    items.push({ title: "추가 보완 사항 없음", body: "주요 이해관계자 우려가 낮습니다. 현행 초안 유지 가능.", tag: "" });
  }
  return items;
}

export function renderReportScreen() {
  const { selectedIds, messages, acceptability, round } = getState();
  const reactions = deriveReactions(messages, acceptability);
  // 대화가 있었던 페르소나만 평가 대상에 포함
  const ids = selectedIds.filter((id) => reactions[id]);
  const score = overallScore(reactions, ids);

  const head = h(
    "div",
    { class: "screen-head" },
    h("div", { class: "eyebrow" }, "STEP 3 · 평가·개선 리포트"),
    h("h1", {}, "협상 결과 평가"),
    h("p", {}, `${round}라운드 협상 결과입니다. 종합 수용도, 이해관계자별 최종 입장, 그리고 후속 협상에 반영할 개선 전략입니다.`)
  );

  const rows = ids.map((id) => acceptabilityRow(PERSONA_BY_ID[id], reactions[id]));
  const acceptCard = h(
    "div",
    { class: "card", style: { padding: "18px 22px", marginTop: "16px" } },
    h("div", { class: "block-label" }, "이해관계자별 수용도"),
    rows
  );

  const improvements = improvementItems(reactions, ids);
  const improveList = h(
    "div",
    { class: "improve-list" },
    improvements.map((it, i) =>
      h(
        "div",
        { class: "improve" },
        h("div", { class: "improve__num" }, String(i + 1)),
        h(
          "div",
          {},
          h("div", { class: "improve__title" }, it.title, it.tag ? h("span", { class: "improve__tag" }, `  · ${it.tag}`) : null),
          h("div", { class: "improve__body" }, it.body)
        )
      )
    )
  );

  const toolbar = h(
    "div",
    { class: "toolbar toolbar--between" },
    h("button", { class: "btn btn--ghost", onClick: () => setState({ screen: "chat" }) }, "← 협상으로 돌아가기"),
    h("button", { class: "btn btn--primary", onClick: () => goToSelect() }, "새 시뮬레이션 시작")
  );

  return h(
    "div",
    { class: "fade-in" },
    head,
    scorecard(score),
    metrics(reactions, ids),
    acceptCard,
    h("div", { class: "section-title" }, "개선 전략 · Improvement"),
    improveList,
    toolbar
  );
}
