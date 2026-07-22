// 화면 ② 다자 채팅형 모의 협상 (페르소나별 반응 + 근거 인용)

import { h } from "../lib/dom.js";
import { getState } from "../lib/store.js";
import { PERSONA_BY_ID } from "../data/personas.js";
import { avatar, accentVars, stanceBadge, citationChips } from "../components/common.js";
import { goToSelect, goToReport, regenerate } from "../actions.js";

function typingBubble(persona) {
  return h(
    "div",
    { class: "chat-msg" },
    avatar(persona, { sm: false }),
    h(
      "div",
      { class: "chat-msg__body" },
      h(
        "div",
        { class: "bubble", style: accentVars(persona) },
        h(
          "div",
          { class: "bubble__head" },
          h("span", { class: "bubble__name" }, persona.name),
          h("span", { class: "bubble__role" }, persona.org)
        ),
        h("div", { class: "typing" }, h("span", {}), h("span", {}), h("span", {}))
      )
    )
  );
}

function reactionBubble(persona, r) {
  const body = [
    h(
      "div",
      { class: "bubble__head" },
      h("span", { class: "bubble__name" }, persona.name),
      h("span", { class: "bubble__role" }, persona.org),
      stanceBadge(r.stance)
    ),
    h("p", { class: "bubble__summary" }, r.summary),
  ];

  if (r.risks && r.risks.length) {
    body.push(h("div", { class: "block-label" }, "Concern / Risk"));
    body.push(
      h(
        "ul",
        { class: "risk-list" },
        r.risks.map((x) => h("li", {}, x))
      )
    );
  }

  if (r.citationIds && r.citationIds.length) {
    body.push(h("div", { class: "block-label" }, "근거 · Evidence"));
    body.push(citationChips(r.citationIds));
  }

  if (r.limitation) {
    body.push(
      h(
        "div",
        { class: "limitation" },
        h("b", {}, "공개자료 기반 추정·한계 — "),
        r.limitation
      )
    );
  }

  return h(
    "div",
    { class: "chat-msg fade-in" },
    avatar(persona),
    h("div", { class: "chat-msg__body" }, h("div", { class: "bubble", style: accentVars(persona) }, body))
  );
}

export function renderChatScreen() {
  const { selectedIds, reactions, generating, draftText } = getState();

  const head = h(
    "div",
    { class: "screen-head" },
    h("div", { class: "eyebrow" }, "STEP 2 · 모의 협상"),
    h("h1", {}, "이해관계자 반응"),
    h("p", {}, "각 페르소나가 전략 초안에 대해 입장·우려·근거를 제시합니다. 근거는 지식 베이스 출처로 인용됩니다.")
  );

  // 사용자(전략 초안) 메시지 요약 표시
  const userMsg = h(
    "div",
    { class: "callout", style: { marginBottom: "18px" } },
    h("span", {}, "📝"),
    h("span", {}, `전략 초안 (${draftText.trim().length}자) 을(를) ${selectedIds.length}명에게 전달했습니다.`)
  );

  const bubbles = selectedIds.map((id) => {
    const persona = PERSONA_BY_ID[id];
    const r = reactions[id];
    return r ? reactionBubble(persona, r) : typingBubble(persona);
  });

  const chat = h("div", { class: "chat" }, bubbles);

  const allDone = selectedIds.every((id) => reactions[id]);

  const toolbar = h(
    "div",
    { class: "toolbar toolbar--between" },
    h(
      "div",
      { class: "toolbar" },
      h("button", { class: "btn btn--ghost", onClick: () => goToSelect() }, "← 다시 선택"),
      h("button", { class: "btn", disabled: generating, onClick: () => regenerate() }, "↻ 다시 생성")
    ),
    h(
      "button",
      { class: "btn btn--primary btn--lg", disabled: !allDone, onClick: () => goToReport() },
      allDone ? "평가·개선 리포트 보기 →" : "반응 생성 중…"
    )
  );

  return h("div", { class: "fade-in" }, head, userMsg, chat, toolbar);
}
