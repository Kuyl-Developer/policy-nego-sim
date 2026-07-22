// 화면 ① 페르소나 선택 + 전략 초안 입력

import { h } from "../lib/dom.js";
import { PERSONAS } from "../data/personas.js";
import { getState } from "../lib/store.js";
import { avatar, accentVars } from "../components/common.js";
import { togglePersona, setDraft, startSimulation } from "../actions.js";

function personaCard(persona, selected) {
  return h(
    "div",
    {
      class: "persona-card" + (selected ? " is-selected" : ""),
      style: accentVars(persona),
      onClick: () => togglePersona(persona.id),
      role: "button",
    },
    h("div", { class: "persona-card__check" }, selected ? "✓" : ""),
    avatar(persona),
    h(
      "div",
      { class: "persona-card__body" },
      h("div", { class: "persona-card__name" }, persona.name),
      h("div", { class: "persona-card__role" }, `${persona.org} · ${persona.role}`),
      h("div", { class: "persona-card__desc" }, persona.stanceBias),
      h(
        "div",
        { class: "tag-row" },
        persona.tags.map((t) => h("span", { class: "tag", style: accentVars(persona) }, t))
      )
    )
  );
}

export function renderSelectScreen() {
  const { selectedIds, draftText } = getState();

  const head = h(
    "div",
    { class: "screen-head" },
    h("div", { class: "eyebrow" }, "STEP 1 · 페르소나 선택"),
    h("h1", {}, "반응을 확인할 이해관계자를 선택하세요"),
    h(
      "p",
      {},
      "대외 발표 전, 선택한 이해관계자 페르소나로 커뮤니케이션 전략 초안의 반응과 리스크를 미리 점검합니다. 여러 명을 선택할 수 있습니다."
    )
  );

  const grid = h(
    "div",
    { class: "grid grid--2" },
    PERSONAS.map((p) => personaCard(p, selectedIds.includes(p.id)))
  );

  const draftCard = h(
    "div",
    { class: "card draft", style: { marginTop: "24px" } },
    h("label", { for: "draft" }, "커뮤니케이션 전략 초안 (Markdown)"),
    h("textarea", {
      id: "draft",
      value: draftText,
      spellcheck: "false",
      oninput: (e) => setDraft(e.target.value),
    }),
    h(
      "div",
      { class: "draft__hint" },
      "기본 3단 구성: 제안 배경 · 정책 제언 · 기대 효과. 자유롭게 수정하세요."
    )
  );

  const startBtn = h(
    "button",
    {
      class: "btn btn--primary btn--lg",
      disabled: selectedIds.length === 0,
      onClick: () => startSimulation(),
    },
    selectedIds.length === 0
      ? "페르소나를 선택하세요"
      : `모의 협상 시작 (${selectedIds.length}명) →`
  );

  const toolbar = h(
    "div",
    { class: "toolbar toolbar--between" },
    h(
      "div",
      { class: "mode-note" },
      `${selectedIds.length}명 선택됨 · 초안 ${draftText.trim().length}자`
    ),
    startBtn
  );

  return h("div", { class: "fade-in" }, head, grid, draftCard, toolbar);
}
